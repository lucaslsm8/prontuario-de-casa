//! Envio e recebimento de pacotes. Sem banco nem rede aqui dentro além do `Remoto`:
//! quem chama (lib.rs) lê e grava o kv e os eventos, e faz a rede fora do lock do banco.

use crate::familia::Familia;
use crate::pacote;
use crate::remoto::Remoto;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

type R<T> = Result<T, String>;

/// Kv "sync_envio:<familiaId>": o último número de pacote enviado e o id do último evento que subiu.
/// O formato antigo `{n, enviados}` é lido com `ultimo_id: None` (o front reenvia tudo; duplicatas são inofensivas).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pendencia {
    pub n: u32,
    #[serde(default)]
    pub ultimo_id: Option<String>,
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
pub fn enviar(remoto: &dyn Remoto, f: &Familia, aparelho: &str, eventos: &[Value], prox_n: u32) -> R<(u32, usize, Option<String>)> {
    let chave = f.chave_bytes()?;
    let (mut ultimo, mut enviados, mut ultimo_id) = (0, 0, None);
    let mut resto = eventos;
    let mut n = prox_n;
    while !resto.is_empty() {
        let lote = &resto[..pacote::primeira_fatia(resto)];
        let bytes = pacote::empacotar(&chave, &f.familia_id, aparelho, n, lote)?;
        let tam = match remoto.gravar(&pacote::nome(aparelho, n), &bytes) {
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
    let bytes = remoto.baixar(&pacote::nome(aparelho, n)).ok()??;
    let remotos = pacote::desempacotar(chave, &f.familia_id, aparelho, n, &bytes).ok()?;
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

/// O pacote `n` de `dono`, se já existe. Ausente = Ok(None): fim da sequência sem buracos por enquanto.
/// Erro de rede = Err (a rodada para e tenta de novo no próximo ciclo); só falha ao decifrar vira `Ilegivel`.
pub fn baixar_proximo(remoto: &dyn Remoto, f: &Familia, dono: &str, n: u32) -> R<Option<Baixado>> {
    let Some(bytes) = remoto.baixar(&pacote::nome(dono, n))? else { return Ok(None) };
    let chave = f.chave_bytes()?;
    Ok(Some(match pacote::desempacotar(&chave, &f.familia_id, dono, n, &bytes) {
        Ok(evs) => Baixado::Eventos(evs),
        Err(_) => Baixado::Ilegivel,
    }))
}

/// Eventos de um pacote que podem entrar em `aparelho` (este): `id` e `aparelho` em texto, e `aparelho` diferente
/// deste (ninguém escreve em nome do aparelho que recebe; o `config` dele vale por inteiro só aqui).
/// Eventos de outros aparelhos, da família ou de fora (backup restaurado), passam. Os malformados são ignorados.
pub fn aceitaveis<'a>(evs: &'a [Value], aparelho: &'a str) -> impl Iterator<Item = &'a Value> + 'a {
    evs.iter().filter(move |e| id_de(e).is_some() && e.get("aparelho").and_then(Value::as_str).is_some_and(|de| de != aparelho))
}

/// Aparelhos cujos eventos não sobem daqui: os lidos (`sync_lidos`) e os vistos em eventos recebidos (`sync_vistos`).
pub fn recebidos(lidos: &BTreeMap<String, u32>, vistos: &BTreeSet<String>) -> Vec<String> {
    lidos.keys().chain(vistos).cloned().collect::<BTreeSet<_>>().into_iter().collect()
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

    /// Lê tudo o que é novo de cada dono, sondando n = ja + 1, ja + 2… como o sync_receber.
    fn ler_tudo(m: &dyn Remoto, f: &Familia, aparelho: &str, lidos: &mut BTreeMap<String, u32>) -> Vec<(String, u32, Vec<Value>)> {
        let mut out = Vec::new();
        for dono in donos(m, aparelho).unwrap() {
            let mut n = lidos.get(&dono).copied().unwrap_or(0) + 1;
            while let Some(b) = baixar_proximo(m, f, &dono, n).unwrap() {
                let evs = match b {
                    Baixado::Eventos(e) => e,
                    Baixado::Ilegivel => vec![],
                };
                out.push((dono.clone(), n, evs));
                lidos.insert(dono.clone(), n);
                n += 1;
            }
        }
        out
    }

    #[test]
    fn envia_so_o_recorte_e_o_outro_aparelho_recebe() {
        let m = SemListarPasta(Memoria::default());
        let f = Familia::nova("a/b", "t");
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["1", "2"]), 1).unwrap(), (1, 2, Some("2".into())));
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["3"]), 2).unwrap(), (2, 1, Some("3".into())));
        assert_eq!(enviar(&m, &f, "pc-a", &[], 3).unwrap(), (0, 0, None));

        let mut lidos = BTreeMap::new();
        let lido = ler_tudo(&m, &f, "cel-b", &mut lidos);
        assert_eq!(lido.iter().map(|(d, n, _)| (d.as_str(), *n)).collect::<Vec<_>>(), [("pc-a", 1), ("pc-a", 2)]);
        assert_eq!(lido.into_iter().flat_map(|(_, _, e)| e).collect::<Vec<_>>(), evs(&["1", "2", "3"]));
        assert!(ler_tudo(&m, &f, "cel-b", &mut lidos).is_empty());
        assert!(ler_tudo(&m, &f, "pc-a", &mut BTreeMap::new()).is_empty(), "não lê a própria pasta");
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
        assert!(matches!(baixar_proximo(&m, &Familia::nova("a/b", "t"), "pc-a", 1), Ok(Some(Baixado::Ilegivel))));
    }

    #[test]
    fn pacote_ausente_e_o_fim_da_sequencia() {
        let m = Memoria::default();
        assert!(matches!(baixar_proximo(&m, &Familia::nova("a/b", "t"), "pc-a", 1), Ok(None)));
    }

    #[test]
    fn numero_ocupado_com_outro_conteudo_vai_para_o_proximo() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &evs(&["1"]), 1).unwrap();
        assert_eq!(enviar(&m, &f, "pc-a", &evs(&["9"]), 1).unwrap(), (2, 1, Some("9".into())));
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
        let mut lidos = BTreeMap::new();
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
        let mut lidos = BTreeMap::new();
        let lido = ler_tudo(&m, &f, "cel-b", &mut lidos);
        assert_eq!(lido.iter().map(|(_, n, _)| *n).collect::<Vec<_>>(), [1, 2]);
        assert_eq!(lidos.get("pc-a"), Some(&2));
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
        let lidos = BTreeMap::from([("cel-b".to_string(), 3), ("tab-c".to_string(), 1)]);
        let vistos = std::collections::BTreeSet::from(["pc-x".to_string(), "cel-b".to_string()]);
        assert_eq!(recebidos(&lidos, &vistos), ["cel-b", "pc-x", "tab-c"]);
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
        let mut lidos = BTreeMap::new();
        let lido: Vec<Value> = ler_tudo(&m, &f, "cel-b", &mut lidos).into_iter().flat_map(|(_, _, e)| e).collect();
        assert_eq!(lido, evs(&["x", "y", "a"]));
    }

    #[test]
    fn pendencia_antiga_vira_cursor_sem_ultimo_id() {
        let p: Pendencia = serde_json::from_value(json!({"n": 4, "enviados": 37})).unwrap();
        assert_eq!(p, Pendencia { n: 4, ultimo_id: None });
        let nova = Pendencia { n: 5, ultimo_id: Some("x".into()) };
        assert_eq!(serde_json::to_value(&nova).unwrap(), json!({"n": 5, "ultimoId": "x"}));
    }
}
