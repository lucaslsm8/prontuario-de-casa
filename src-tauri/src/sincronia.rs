//! Envio e recebimento de pacotes. Sem banco nem rede aqui dentro além do `Remoto`:
//! quem chama (lib.rs) lê e grava o kv e os eventos, e faz a rede fora do lock do banco.

use crate::familia::Familia;
use crate::pacote;
use crate::remoto::Remoto;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

type R<T> = Result<T, String>;

/// Kv "sync_envio:<familiaId>": a época e o último número de pacote enviado nela, e o id do último evento que subiu.
/// O formato antigo `{n, enviados}` é lido com `ultimo_id: None` (o front reenvia tudo; duplicatas são inofensivas).
/// Sem `epoca` = época 0. Quando a família troca de época, a numeração recomeça em 1 (`proximo_n`).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pendencia {
    pub n: u32,
    #[serde(default)]
    pub ultimo_id: Option<String>,
    #[serde(default, skip_serializing_if = "zero")]
    pub epoca: u32,
}

fn zero(e: &u32) -> bool {
    *e == 0
}

impl Pendencia {
    /// O próximo número de pacote na época `epoca` (a atual da família).
    pub fn proximo_n(&self, epoca: u32) -> u32 {
        if self.epoca == epoca { self.n + 1 } else { 1 }
    }
}

/// Até onde cada pasta já foi lida, por época: kv "sync_lidos:<familiaId>" (época 0, formato de antes)
/// e "sync_lidos_epocas:<familiaId>" (épocas ≥ 1). Cada (aparelho, época) é uma sequência contínua própria:
/// quem lê sonda todas as épocas cuja chave conhece, cada uma a partir do próprio cursor, e nunca pula um pacote.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Lidos {
    pub zero: BTreeMap<String, u32>,
    pub epocas: BTreeMap<String, BTreeMap<u32, u32>>,
}

impl Lidos {
    pub fn ultimo(&self, dono: &str, epoca: u32) -> u32 {
        if epoca == 0 {
            self.zero.get(dono).copied().unwrap_or(0)
        } else {
            self.epocas.get(dono).and_then(|m| m.get(&epoca)).copied().unwrap_or(0)
        }
    }
    pub fn marcar(&mut self, dono: &str, epoca: u32, n: u32) {
        if epoca == 0 {
            self.zero.insert(dono.to_string(), n);
        } else {
            self.epocas.entry(dono.to_string()).or_default().insert(epoca, n);
        }
    }
    fn aparelhos(&self) -> impl Iterator<Item = &String> {
        self.zero.keys().chain(self.epocas.keys())
    }
}

fn id_de(ev: &Value) -> Option<&str> {
    ev.get("id").and_then(Value::as_str)
}

/// Grava os eventos em pacotes numerados a partir de `prox_n`, fatiando aos poucos; para no primeiro erro.
/// Devolve (último número de pacote presente no remoto, eventos contados como enviados, id do último deles).
/// Com `eventos` vazio devolve (0, 0, None): quem chama mantém a `Pendencia` anterior intacta.
/// Se nada avançou e a primeira gravação falhou, devolve o erro.
/// Pacote `n` que já existe no remoto e abre com a nossa chave (escrita incerta, cursor perdido, recorte que mudou):
/// se os ids dele são o começo dos pendentes, conta esses como enviados; se não, ele já está publicado e o mesmo
/// lote vai para `n + 1` (sem consumir nada). Assim o envio nunca trava num número ocupado.
/// Os pacotes vão na época atual da família (`f.epoca`, com `f.chave`).
pub fn enviar(remoto: &dyn Remoto, f: &Familia, aparelho: &str, eventos: &[Value], prox_n: u32) -> R<(u32, usize, Option<String>)> {
    let chave = f.chave_bytes()?;
    let (mut ultimo, mut enviados, mut ultimo_id) = (0, 0, None);
    let mut resto = eventos;
    let mut n = prox_n;
    while !resto.is_empty() {
        let lote = &resto[..pacote::primeira_fatia(resto)];
        let bytes = pacote::empacotar(&chave, &f.familia_id, f.epoca, aparelho, n, lote)?;
        let tam = match remoto.gravar(&pacote::nome(aparelho, f.epoca, n), &bytes) {
            Ok(()) => lote.len(),
            Err(e) => match ja_gravado(remoto, f, &chave, aparelho, n, resto) {
                Some(k) => k,
                None if ultimo == 0 => return Err(e),
                None => break,
            },
        };
        ultimo = n;
        if tam > 0 {
            enviados += tam;
            ultimo_id = id_de(&resto[tam - 1]).map(String::from);
            resto = &resto[tam..];
        }
        n += 1;
    }
    Ok((ultimo, enviados, ultimo_id))
}

/// O remoto já tem o pacote `n` e ele abre com a nossa chave? Devolve quantos dos `pendentes` ele já leva:
/// o tamanho dele, se os ids são o começo dos pendentes (mesmos ids, mesma ordem); 0, se é outro conteúdo
/// (o número está ocupado, segue para o próximo). Falha ao checar, ausente ou ilegível = None.
fn ja_gravado(remoto: &dyn Remoto, f: &Familia, chave: &[u8; 32], aparelho: &str, n: u32, pendentes: &[Value]) -> Option<usize> {
    let bytes = remoto.baixar(&pacote::nome(aparelho, f.epoca, n)).ok()??;
    let remotos = pacote::desempacotar(chave, &f.familia_id, f.epoca, aparelho, n, &bytes).ok()?;
    let prefixo = !remotos.is_empty() && remotos.len() <= pendentes.len() && remotos.iter().zip(pendentes).all(|(a, b)| id_de(a).is_some() && id_de(a) == id_de(b));
    Some(if prefixo { remotos.len() } else { 0 })
}

/// Os outros aparelhos com pasta em `eventos/`. A pasta de cada um não é listada (o GitHub corta em 1000 itens):
/// quem lê sonda `baixar_proximo(n)`, `n + 1`, … até o primeiro que não existe.
pub fn donos(remoto: &dyn Remoto, aparelho: &str) -> R<Vec<String>> {
    Ok(remoto.listar("eventos")?.into_iter().filter(|d| d != aparelho).collect())
}

pub enum Baixado {
    Eventos(Vec<Value>),
    /// Baixou, mas não decifra (outra chave, corrompido): quem chama pula o pacote.
    Ilegivel,
}

/// O pacote `n` da época `epoca` de `dono` (com a chave dessa época), se já existe. Ausente = Ok(None): fim da
/// sequência sem buracos por enquanto. Erro de rede = Err (a rodada para e tenta de novo no próximo ciclo);
/// só falha ao decifrar vira `Ilegivel`.
pub fn baixar_proximo(remoto: &dyn Remoto, familia_id: &str, chave: &[u8; 32], epoca: u32, dono: &str, n: u32) -> R<Option<Baixado>> {
    let Some(bytes) = remoto.baixar(&pacote::nome(dono, epoca, n))? else { return Ok(None) };
    Ok(Some(match pacote::desempacotar(chave, familia_id, epoca, dono, n, &bytes) {
        Ok(evs) => Baixado::Eventos(evs),
        Err(_) => Baixado::Ilegivel,
    }))
}

/// Quantas rodadas um pacote que não decifra é tentado de novo antes de ser pulado.
pub const TENTATIVAS_ILEGIVEL: u32 = 5;

/// Pacote baixado que não decifrou. Antes ele era pulado na hora, e um download ruim (resposta incompleta)
/// perdia os eventos dele para sempre neste aparelho. Agora conta as tentativas por "dono|época|n":
/// devolve `true` (pular e seguir) só a partir da `TENTATIVAS_ILEGIVEL`-ésima; senão a sequência para e tenta na próxima rodada.
pub fn pular_ilegivel(tentativas: &mut BTreeMap<String, u32>, dono: &str, epoca: u32, n: u32) -> bool {
    let chave = format!("{dono}|{epoca}|{n}");
    let t = tentativas.entry(chave.clone()).or_insert(0);
    *t += 1;
    if *t >= TENTATIVAS_ILEGIVEL {
        tentativas.remove(&chave);
        return true;
    }
    false
}

/// "Baixar tudo de novo": zera o que já foi lido (relê todos os pacotes; o que já está no banco é ignorado).
/// Os aparelhos lidos passam para `vistos`, para os eventos deles continuarem sem subir daqui.
pub fn reler(lidos: &mut Lidos, vistos: &mut std::collections::BTreeSet<String>) {
    vistos.extend(lidos.aparelhos().cloned());
    *lidos = Lidos::default();
}

/// Eventos de um pacote que podem entrar em `aparelho` (este): `id` e `aparelho` em texto, e `aparelho` diferente
/// deste (ninguém escreve em nome do aparelho que recebe; o `config` dele vale por inteiro só aqui).
/// Eventos de outros aparelhos, da família ou de fora (backup restaurado), passam. Os malformados são ignorados.
pub fn aceitaveis<'a>(evs: &'a [Value], aparelho: &'a str) -> impl Iterator<Item = &'a Value> + 'a {
    evs.iter().filter(move |e| id_de(e).is_some() && e.get("aparelho").and_then(Value::as_str).is_some_and(|de| de != aparelho))
}

/// Aparelhos cujos eventos não sobem daqui: os lidos (`sync_lidos`) e os vistos em eventos recebidos (`sync_vistos`).
pub fn recebidos(lidos: &Lidos, vistos: &BTreeSet<String>) -> Vec<String> {
    lidos.aparelhos().chain(vistos).cloned().collect::<BTreeSet<_>>().into_iter().collect()
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::remoto::Memoria;
    use serde_json::json;

    fn evs(ids: &[&str]) -> Vec<Value> {
        ids.iter().map(|i| json!({"id": i, "aparelho": "pc-a"})).collect()
    }

    /// Remoto que recusa listar a pasta de um aparelho (o GitHub corta em 1000 itens): a leitura tem de sondar.
    struct SemListarPasta(Memoria);
    impl Remoto for SemListarPasta {
        fn listar(&self, pasta: &str) -> R<Vec<String>> {
            if pasta != "eventos" {
                panic!("não deveria listar {pasta}");
            }
            self.0.listar(pasta)
        }
        fn baixar(&self, caminho: &str) -> R<Option<Vec<u8>>> {
            self.0.baixar(caminho)
        }
        fn gravar(&self, caminho: &str, bytes: &[u8]) -> R<()> {
            self.0.gravar(caminho, bytes)
        }
        fn conferir(&self) -> R<()> {
            Ok(())
        }
    }

    /// Lê tudo o que é novo de cada dono, em cada época de `chaves`, sondando n = ja + 1, ja + 2… como o sync_receber.
    pub fn ler_epocas(m: &dyn Remoto, fid: &str, chaves: &[(u32, [u8; 32])], aparelho: &str, lidos: &mut Lidos) -> Vec<(String, u32, u32, Vec<Value>)> {
        let mut out = Vec::new();
        for dono in donos(m, aparelho).unwrap() {
            for (epoca, chave) in chaves {
                let mut n = lidos.ultimo(&dono, *epoca) + 1;
                while let Some(b) = baixar_proximo(m, fid, chave, *epoca, &dono, n).unwrap() {
                    let evs = match b {
                        Baixado::Eventos(e) => e,
                        Baixado::Ilegivel => vec![],
                    };
                    out.push((dono.clone(), *epoca, n, evs));
                    lidos.marcar(&dono, *epoca, n);
                    n += 1;
                }
            }
        }
        out
    }

    /// Só a época atual de `f`, com a chave dela (os testes de antes das épocas).
    fn ler_tudo(m: &dyn Remoto, f: &Familia, aparelho: &str, lidos: &mut Lidos) -> Vec<(String, u32, Vec<Value>)> {
        ler_epocas(m, &f.familia_id, &[(f.epoca, f.chave_bytes().unwrap())], aparelho, lidos).into_iter().map(|(d, _, n, e)| (d, n, e)).collect()
    }

    #[test]
    fn envia_so_o_recorte_e_o_outro_aparelho_recebe() {
        let m = SemListarPasta(Memoria::default());
        let f = Familia::nova("a/b", "t");
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["1", "2"]), 1).unwrap(), (1, 2, Some("2".into())));
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["3"]), 2).unwrap(), (2, 1, Some("3".into())));
        assert_eq!(enviar(&m, &f, "pc-a", &[], 3).unwrap(), (0, 0, None));

        let mut lidos = Lidos::default();
        let lido = ler_tudo(&m, &f, "cel-b", &mut lidos);
        assert_eq!(lido.iter().map(|(d, n, _)| (d.as_str(), *n)).collect::<Vec<_>>(), [("pc-a", 1), ("pc-a", 2)]);
        assert_eq!(lido.into_iter().flat_map(|(_, _, e)| e).collect::<Vec<_>>(), evs(&["1", "2", "3"]));
        assert!(ler_tudo(&m, &f, "cel-b", &mut lidos).is_empty());
        assert!(ler_tudo(&m, &f, "pc-a", &mut Lidos::default()).is_empty(), "não lê a própria pasta");
    }

    #[test]
    fn muitos_eventos_viram_varios_pacotes_numerados() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let muitos: Vec<Value> = (0..450).map(|i| json!({"id": i.to_string(), "aparelho": "pc-a"})).collect();
        assert_eq!(enviar(&m, &f, "pc-a", &muitos, 5).unwrap(), (7, 450, Some("449".into())));
        assert_eq!(m.listar("eventos/pc-a").unwrap(), ["000005.bin", "000006.bin", "000007.bin"]);
    }

    #[test]
    fn pacote_de_outra_familia_nao_abre() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &evs(&["1"]), 1).unwrap();
        let g = Familia::nova("a/b", "t");
        assert!(matches!(baixar_proximo(&m, &f.familia_id, &g.chave_bytes().unwrap(), 0, "pc-a", 1), Ok(Some(Baixado::Ilegivel))));
        // Outra época: outro nome de arquivo, nada encontrado.
        assert!(matches!(baixar_proximo(&m, &f.familia_id, &f.chave_bytes().unwrap(), 1, "pc-a", 1), Ok(None)));
    }

    #[test]
    fn pacote_ausente_e_o_fim_da_sequencia() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        assert!(matches!(baixar_proximo(&m, &f.familia_id, &f.chave_bytes().unwrap(), 0, "pc-a", 1), Ok(None)));
    }

    #[test]
    fn numero_ocupado_com_outro_conteudo_vai_para_o_proximo() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &evs(&["1"]), 1).unwrap();
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["9"]), 1).unwrap(), (2, 1, Some("9".into())));
    }

    #[test]
    fn ilegivel_e_tentado_de_novo_antes_de_pular() {
        let mut t = BTreeMap::new();
        for _ in 1..TENTATIVAS_ILEGIVEL {
            assert!(!pular_ilegivel(&mut t, "cel-a", 0, 8));
        }
        assert!(pular_ilegivel(&mut t, "cel-a", 0, 8));
        assert!(t.is_empty());
        // Cada pacote conta separado.
        assert!(!pular_ilegivel(&mut t, "cel-a", 0, 9));
        assert!(!pular_ilegivel(&mut t, "pc-b", 0, 8));
    }

    #[test]
    fn reler_zera_lidos_e_guarda_os_aparelhos_em_vistos() {
        let mut l = Lidos::default();
        l.marcar("cel-a", 0, 8);
        l.marcar("pc-b", 2, 3);
        let mut v = std::collections::BTreeSet::new();
        reler(&mut l, &mut v);
        assert_eq!(l.ultimo("cel-a", 0), 0);
        assert_eq!(l.ultimo("pc-b", 2), 0);
        assert_eq!(v.into_iter().collect::<Vec<_>>(), ["cel-a", "pc-b"]);
        assert_eq!(recebidos(&l, &["cel-a".to_string()].into_iter().collect()), ["cel-a"]);
    }

    #[test]
    fn pacote_ilegivel_no_numero_e_erro() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        m.gravar("eventos/pc-a/000001.bin", b"lixo").unwrap();
        assert!(enviar(&m, &f, "pc-a", &evs(&["1"]), 1).is_err());
    }

    #[test]
    fn escrita_que_chegou_mas_sem_resposta_conta_como_enviada() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["1"]), 1).unwrap(), (1, 1, Some("1".into())));
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["1"]), 1).unwrap(), (1, 1, Some("1".into())));
    }

    #[test]
    fn escrita_incerta_seguida_de_eventos_novos_nao_trava() {
        // O pacote 1 com [1, 2] chegou ao remoto, mas o cursor não avançou (resposta e checagem perdidas).
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &evs(&["1", "2"]), 1).unwrap();
        // Próxima rodada: o mesmo recorte e mais um evento, de novo a partir do pacote 1.
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["1", "2", "3"]), 1).unwrap(), (2, 3, Some("3".into())));
        assert_eq!(m.listar("eventos/pc-a").unwrap(), ["000001.bin", "000002.bin"]);
        let mut lidos = Lidos::default();
        let lido: Vec<Value> = ler_tudo(&m, &f, "cel-b", &mut lidos).into_iter().flat_map(|(_, _, e)| e).collect();
        assert_eq!(lido, evs(&["1", "2", "3"]));
    }

    #[test]
    fn lacuna_na_numeracao_para_a_leitura() {
        let m = SemListarPasta(Memoria::default());
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &evs(&["1"]), 1).unwrap();
        enviar(&m, &f, "pc-a", &evs(&["2"]), 2).unwrap();
        enviar(&m, &f, "pc-a", &evs(&["4"]), 4).unwrap();
        let mut lidos = Lidos::default();
        let lido = ler_tudo(&m, &f, "cel-b", &mut lidos);
        assert_eq!(lido.iter().map(|(_, n, _)| *n).collect::<Vec<_>>(), [1, 2]);
        assert_eq!(lidos.ultimo("pc-a", 0), 2);
    }

    #[test]
    fn so_aceita_eventos_com_id_e_aparelho_texto_e_que_nao_sejam_deste_aparelho() {
        let evs = vec![
            json!({"id": "a", "aparelho": "pc-a"}),
            json!({"id": 7, "aparelho": "pc-a"}),
            json!({"aparelho": "pc-a"}),
            json!({"id": "b", "aparelho": "cel-b"}),
            json!({"id": "c"}),
            json!({"id": "d", "aparelho": "pc-a"}),
            json!({"id": "e", "aparelho": "tab-c"}),
            json!({"id": "f", "aparelho": "pc-x"}),
        ];
        // Lendo em cel-b: tab-c (da família, vindo de um backup) e pc-x (de fora) passam; só cel-b não.
        let ok: Vec<&str> = aceitaveis(&evs, "cel-b").filter_map(|e| e.get("id")?.as_str()).collect();
        assert_eq!(ok, ["a", "d", "e", "f"]);
    }

    #[test]
    fn recebidos_junta_lidos_e_vistos() {
        let mut lidos = Lidos { zero: BTreeMap::from([("cel-b".to_string(), 3), ("tab-c".to_string(), 1)]), ..Default::default() };
        lidos.marcar("cel-d", 1, 2);
        let vistos = std::collections::BTreeSet::from(["pc-x".to_string(), "cel-b".to_string()]);
        assert_eq!(recebidos(&lidos, &vistos), ["cel-b", "cel-d", "pc-x", "tab-c"]);
    }

    #[test]
    fn escrita_incerta_e_recorte_que_encolheu_nao_trava() {
        // O pacote 1 com [1, 2, 3] chegou, mas o cursor não avançou; depois o 2 saiu do recorte (aparelho lido).
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &evs(&["1", "2", "3"]), 1).unwrap();
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["1", "3"]), 1).unwrap(), (2, 2, Some("3".into())));
        assert_eq!(m.listar("eventos/pc-a").unwrap(), ["000001.bin", "000002.bin"]);
    }

    #[test]
    fn recorte_recomecado_pula_o_pacote_ja_publicado() {
        // O pacote 1 já tem outros eventos (cursor perdido ao sair e voltar): o mesmo lote vai no 2, livre.
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &evs(&["x", "y"]), 1).unwrap();
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["a"]), 1).unwrap(), (2, 1, Some("a".into())));
        let mut lidos = Lidos::default();
        let lido: Vec<Value> = ler_tudo(&m, &f, "cel-b", &mut lidos).into_iter().flat_map(|(_, _, e)| e).collect();
        assert_eq!(lido, evs(&["x", "y", "a"]));
    }

    #[test]
    fn pendencia_antiga_vira_cursor_sem_ultimo_id() {
        let p: Pendencia = serde_json::from_value(json!({"n": 4, "enviados": 37})).unwrap();
        assert_eq!(p, Pendencia { n: 4, ultimo_id: None, epoca: 0 });
        let nova = Pendencia { n: 5, ultimo_id: Some("x".into()), epoca: 0 };
        assert_eq!(serde_json::to_value(&nova).unwrap(), json!({"n": 5, "ultimoId": "x"}));
        let e2 = Pendencia { n: 3, ultimo_id: None, epoca: 2 };
        assert_eq!(serde_json::from_value::<Pendencia>(serde_json::to_value(&e2).unwrap()).unwrap(), e2);
    }

    #[test]
    fn epoca_nova_recomeca_a_numeracao() {
        let p = Pendencia { n: 7, ultimo_id: Some("x".into()), epoca: 0 };
        assert_eq!(p.proximo_n(0), 8);
        assert_eq!(p.proximo_n(1), 1);
        assert_eq!(Pendencia { n: 2, ultimo_id: None, epoca: 1 }.proximo_n(1), 3);
    }

    #[test]
    fn cursor_por_aparelho_e_epoca_nao_pula_pacote() {
        // pc-a escreve na época 0, troca de chave e escreve na época 1; pc-c, atrasado, ainda escreve na época 0.
        let m = SemListarPasta(Memoria::default());
        let f = Familia::nova("a/b", "t");
        let k0 = f.chave_bytes().unwrap();
        let k1 = crate::cripto::aleatorio::<32>();
        let f1 = Familia { epoca: 1, chave: crate::familia::chave_hex(&k1), ..f.clone() };
        let chaves = [(0, k0), (1, k1)];
        let ids = |l: Vec<(String, u32, u32, Vec<Value>)>| {
            let mut v: Vec<_> = l.into_iter().map(|(d, e, n, _)| (d, e, n)).collect();
            v.sort();
            v
        };
        let t = |d: &str, e: u32, n: u32| (d.to_string(), e, n);
        enviar(&m, &f, "pc-a", &evs(&["1"]), 1).unwrap();
        let mut lidos = Lidos::default();
        assert_eq!(ids(ler_epocas(&m, &f.familia_id, &chaves, "cel-b", &mut lidos)), [t("pc-a", 0, 1)]);
        // Entre duas leituras: o pacote 2 da época 0 e o 1 da época 1 de pc-a, e o 1 da época 0 de pc-c.
        enviar(&m, &f, "pc-a", &evs(&["2"]), 2).unwrap();
        assert_eq!(enviar(&m, &f1, "pc-a", &evs(&["3"]), 1).unwrap(), (1, 1, Some("3".into())));
        enviar(&m, &f, "pc-c", &evs(&["c1"]), 1).unwrap();
        assert_eq!(ids(ler_epocas(&m, &f.familia_id, &chaves, "cel-b", &mut lidos)), [t("pc-a", 0, 2), t("pc-a", 1, 1), t("pc-c", 0, 1)]);
        assert_eq!((lidos.ultimo("pc-a", 0), lidos.ultimo("pc-a", 1), lidos.ultimo("pc-c", 0)), (2, 1, 1));
        // Lacuna na época 1 (pacote 2 ausente): para só aquela sequência; a época 0 segue.
        enviar(&m, &f1, "pc-a", &evs(&["5"]), 3).unwrap();
        enviar(&m, &f, "pc-a", &evs(&["4"]), 3).unwrap();
        assert_eq!(ids(ler_epocas(&m, &f.familia_id, &chaves, "cel-b", &mut lidos)), [t("pc-a", 0, 3)]);
        assert_eq!(lidos.ultimo("pc-a", 1), 1);
        // Quem só tem a chave da época 0 não lê a época 1 (fica para quando tiver a chave).
        let mut so0 = Lidos::default();
        assert!(ids(ler_epocas(&m, &f.familia_id, &[(0, k0)], "cel-x", &mut so0)).iter().all(|(_, e, _)| *e == 0));
        assert_eq!(so0.ultimo("pc-a", 1), 0);
        // O pacote da época 1 com a chave da época 0 seria ilegível: sem a chave certa, nem se tenta.
        assert!(matches!(baixar_proximo(&m, &f.familia_id, &k0, 1, "pc-a", 1), Ok(Some(Baixado::Ilegivel))));
    }
}
