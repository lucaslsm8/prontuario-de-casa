//! Épocas da chave da família. Remover um aparelho troca a chave: a família passa da época `b` para uma época
//! nova `t`, com uma chave nova selada para cada aparelho que fica, este incluído (`chaves/<t>/<aparelhoId>.bin`:
//! X25519 efêmero + HKDF-SHA256 + XChaCha20-Poly1305, AAD "<familiaId>|<t>|<aparelhoId>").
//!
//! Por último vai o marco `chaves/<b>/proxima.bin` (t em 4 bytes + manifesto cifrado com a chave nova). Ele é
//! gravado só se ainda não existe, então cada época tem no máximo uma sucessora: duas remoções ao mesmo tempo não
//! dividem a família, a que perder recebe um conflito. Sem o marco, nada mudou para ninguém: uma troca que caiu no
//! meio é retomada com os mesmos bytes (`Rotacao`, guardada no kv) ou abandonada (a próxima usa outra `t`).
//!
//! O sal do HKDF é a chave da época anterior: quem não é da família (ex.: só com o token) não fabrica uma chave nova.
//! Quem lê procura o marco da própria época; achando, abre o próprio arquivo, confere o marco e adota a chave.
//! Marco sem arquivo para este aparelho (ou com um arquivo que não confere) = este aparelho foi removido.

use crate::cripto::{aleatorio, Cofre};
use crate::familia::{chave_de_hex, chave_hex, Antigas, Familia};
use crate::remoto::Remoto;
use base64::Engine;
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use std::collections::BTreeMap;
use x25519_dalek::{PublicKey, StaticSecret};

type R<T> = Result<T, String>;

/// Prefixo do erro de quem perdeu a corrida para trocar a chave (o pedido guardado é descartado).
pub const CONFLITO: &str = "CONFLITO:";
/// Erro que o front reconhece para mostrar "Este aparelho foi removido da família".
pub const REMOVIDO: &str = "REMOVIDO: Este aparelho foi removido da família";

const INFO: &[u8] = b"prontuario-de-casa/selo/v1";
const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

fn derivar(dh: &[u8; 32], sal: &[u8; 32], efemera: &[u8; 32], destino: &[u8; 32]) -> [u8; 32] {
    let mut info = Vec::with_capacity(INFO.len() + 64);
    info.extend_from_slice(INFO);
    info.extend_from_slice(efemera);
    info.extend_from_slice(destino);
    let mut k = [0u8; 32];
    Hkdf::<Sha256>::new(Some(sal), dh).expand(&info, &mut k).expect("32 bytes cabem no HKDF-SHA256");
    k
}

/// Sela `conteudo` para a chave pública X25519 `chave_pub`. `sal` amarra o selo a um segredo comum (a chave da
/// época anterior). Formato: pública efêmera (32 bytes) || nonce (24) || cifrado + tag.
pub fn selar(chave_pub: &[u8; 32], conteudo: &[u8], aad: &[u8], sal: &[u8; 32]) -> R<Vec<u8>> {
    let efemera = StaticSecret::from(aleatorio::<32>());
    let pub_efemera = PublicKey::from(&efemera);
    let dh = efemera.diffie_hellman(&PublicKey::from(*chave_pub));
    if !dh.was_contributory() {
        return Err("chave pública do aparelho inválida".into());
    }
    let k = derivar(dh.as_bytes(), sal, pub_efemera.as_bytes(), chave_pub);
    let mut out = pub_efemera.as_bytes().to_vec();
    out.extend(Cofre::new(&k).cifrar(conteudo, aad).map_err(|e| e.to_string())?);
    Ok(out)
}

/// Abre o que `selar` fez para a pública desta `chave_priv`. Outra chave, outro AAD, outro sal ou bytes mexidos = Err.
pub fn abrir(chave_priv: &[u8; 32], selado: &[u8], aad: &[u8], sal: &[u8; 32]) -> R<Vec<u8>> {
    let erro = || "não foi possível abrir a chave selada".to_string();
    if selado.len() < 32 {
        return Err(erro());
    }
    let (efemera, resto) = selado.split_at(32);
    let efemera: [u8; 32] = efemera.try_into().map_err(|_| erro())?;
    let segredo = StaticSecret::from(*chave_priv);
    let dh = segredo.diffie_hellman(&PublicKey::from(efemera));
    if !dh.was_contributory() {
        return Err(erro());
    }
    let k = derivar(dh.as_bytes(), sal, &efemera, PublicKey::from(&segredo).as_bytes());
    Cofre::new(&k).decifrar(resto, aad).map_err(|_| erro())
}

pub fn arquivo(epoca: u32, aparelho: &str) -> String {
    format!("chaves/{epoca}/{aparelho}.bin")
}

fn marco(base: u32) -> String {
    format!("chaves/{base}/proxima.bin")
}

fn aad_selo(familia: &str, epoca: u32, aparelho: &str) -> Vec<u8> {
    format!("{familia}|{epoca}|{aparelho}").into_bytes()
}

fn aad_marco(familia: &str, base: u32, epoca: u32) -> Vec<u8> {
    format!("{familia}|{base}|proxima|{epoca}").into_bytes()
}

/// Id de aparelho que pode virar nome de arquivo ("pc-ab12cd", "cel-…").
pub fn id_valido(id: &str) -> bool {
    !id.is_empty() && id.len() <= 40 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') && id != "proxima"
}

/// Todas as chaves conhecidas, em ordem de época: as antigas e a atual.
pub fn chaves(f: &Familia, antigas: &Antigas) -> R<Vec<(u32, [u8; 32])>> {
    let mut m = BTreeMap::new();
    for (e, k) in antigas.iter().filter(|(e, _)| **e < f.epoca) {
        m.insert(*e, chave_de_hex(k)?);
    }
    m.insert(f.epoca, f.chave_bytes()?);
    Ok(m.into_iter().collect())
}

#[derive(Debug, PartialEq)]
pub enum Situacao {
    /// Nenhuma época nova.
    Igual,
    /// Adotou uma ou mais épocas novas: quem chama grava `antigas` e depois a família.
    Avancou,
    /// A família trocou de chave na época `t` sem este aparelho.
    Removido(u32),
}

/// Segue a cadeia de marcos a partir da época de `f`, adotando cada chave nova (e o token novo, se veio junto).
/// A chave que sai vai para `antigas`. Erro de rede ou arquivo que não abre = Err (tenta de novo depois).
pub fn atualizar(remoto: &dyn Remoto, f: &mut Familia, antigas: &mut Antigas, eu: &str, chave_priv: &[u8; 32]) -> R<Situacao> {
    let mut avancou = false;
    while let Some(m) = remoto.baixar(&marco(f.epoca))? {
        let base = f.epoca;
        let t = m.get(..4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]])).filter(|t| *t > base).ok_or_else(|| format!("marco da época {base} inválido"))?;
        let Some(selado) = remoto.baixar(&arquivo(t, eu))? else { return Ok(Situacao::Removido(t)) };
        let claro = abrir(chave_priv, &selado, &aad_selo(&f.familia_id, t, eu), &f.chave_bytes()?).map_err(|_| format!("a chave nova da família (época {t}) não abre neste aparelho"))?;
        let v: Value = serde_json::from_slice(&claro).map_err(|_| format!("chave nova da família (época {t}) inválida"))?;
        let nova = chave_de_hex(v.get("chave").and_then(Value::as_str).unwrap_or_default())?;
        // O arquivo pode ser de uma troca que perdeu a corrida: só vale se a chave confere com o marco.
        if Cofre::new(&nova).decifrar(&m[4..], &aad_marco(&f.familia_id, base, t)).is_err() {
            return Ok(Situacao::Removido(t));
        }
        antigas.insert(base, f.chave.clone());
        f.chave = chave_hex(&nova);
        f.epoca = t;
        if let Some(tk) = v.get("token").and_then(Value::as_str).map(str::trim).filter(|t| !t.is_empty()) {
            f.token = tk.to_string();
        }
        avancou = true;
    }
    Ok(if avancou { Situacao::Avancou } else { Situacao::Igual })
}

/// Uma troca de chave preparada: os arquivos já selados, na ordem de gravação (o marco por último).
/// Fica no kv cifrado (`rotacao:<familiaId>`) até terminar: tentar de novo grava os mesmos bytes.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rotacao {
    pub base: u32,
    pub epoca: u32,
    pub removido: String,
    pub token: Option<String>,
    /// aparelhoId → chave pública (hex), este aparelho incluído.
    pub destinatarios: BTreeMap<String, String>,
    /// Caminho no remoto → bytes em base64.
    pub arquivos: Vec<(String, String)>,
}

impl Rotacao {
    /// O mesmo pedido, a partir da mesma época: dá para retomar com os mesmos bytes.
    pub fn serve_para(&self, base: u32, removido: &str, token: &Option<String>, destinatarios: &BTreeMap<String, String>) -> bool {
        self.base == base && self.removido == removido && &self.token == token && &self.destinatarios == destinatarios
    }
}

/// Épocas com pasta em `chaves/`.
fn epocas_no_remoto(remoto: &dyn Remoto) -> R<Vec<u32>> {
    Ok(remoto.listar("chaves")?.iter().filter_map(|d| d.parse().ok()).collect())
}

/// Gera a chave nova e sela para cada destinatário (o removido nunca recebe). A época nova é maior que todas as
/// pastas que já existem: uma tentativa abandonada nunca ocupa os nomes da próxima.
pub fn preparar(remoto: &dyn Remoto, f: &Familia, removido: &str, destinatarios: BTreeMap<String, String>, token: Option<String>) -> R<Rotacao> {
    let base = f.epoca;
    let epoca = epocas_no_remoto(remoto)?.into_iter().max().unwrap_or(0).max(base) + 1;
    let sal = f.chave_bytes()?;
    let nova = aleatorio::<32>();
    let mut conteudo = json!({ "chave": chave_hex(&nova) });
    if let Some(t) = &token {
        conteudo["token"] = json!(t);
    }
    let conteudo = conteudo.to_string().into_bytes();
    let mut arquivos = Vec::new();
    for (id, publica) in destinatarios.iter().filter(|(id, _)| id.as_str() != removido) {
        if !id_valido(id) {
            return Err(format!("aparelho inválido: {id}"));
        }
        let pk = chave_de_hex(publica).map_err(|_| format!("chave pública inválida do aparelho {id}"))?;
        arquivos.push((arquivo(epoca, id), B64.encode(selar(&pk, &conteudo, &aad_selo(&f.familia_id, epoca, id), &sal)?)));
    }
    let manifesto = json!({ "removido": removido, "destinatarios": destinatarios.keys().filter(|id| id.as_str() != removido).collect::<Vec<_>>() });
    let mut m = epoca.to_le_bytes().to_vec();
    m.extend(Cofre::new(&nova).cifrar(manifesto.to_string().as_bytes(), &aad_marco(&f.familia_id, base, epoca)).map_err(|e| e.to_string())?);
    arquivos.push((marco(base), B64.encode(m)));
    Ok(Rotacao { base, epoca, removido: removido.to_string(), token, destinatarios, arquivos })
}

/// Grava os arquivos na ordem, o marco por último. Pode ser repetida: arquivo que já está lá com os mesmos bytes
/// (escrita que chegou sem resposta) conta como gravado. Com outro conteúdo, outro aparelho trocou a chave ao
/// mesmo tempo: devolve CONFLITO. Erro de rede: devolve o erro, nada fica valendo sem o marco.
pub fn publicar(remoto: &dyn Remoto, r: &Rotacao) -> R<()> {
    for (caminho, b64) in &r.arquivos {
        let bytes = B64.decode(b64).map_err(|_| "troca de chave guardada inválida".to_string())?;
        if let Err(e) = remoto.gravar(caminho, &bytes) {
            match remoto.baixar(caminho) {
                Ok(Some(b)) if b == bytes => {}
                Ok(Some(_)) => return Err(format!("{CONFLITO} outro aparelho trocou a chave da família ao mesmo tempo; sincronize e tente de novo")),
                _ => return Err(e),
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::remoto::Memoria;
    use crate::sincronia::{self, Baixado};
    use std::cell::Cell;

    struct Aparelho {
        id: &'static str,
        privada: [u8; 32],
        f: Familia,
        antigas: Antigas,
    }

    impl Aparelho {
        fn novo(id: &'static str, f: &Familia) -> Self {
            Self { id, privada: aleatorio::<32>(), f: f.clone(), antigas: Antigas::new() }
        }
        fn publica(&self) -> String {
            chave_hex(PublicKey::from(&StaticSecret::from(self.privada)).as_bytes())
        }
        fn atualizar(&mut self, m: &dyn Remoto) -> Situacao {
            atualizar(m, &mut self.f, &mut self.antigas, self.id, &self.privada).unwrap()
        }
    }

    fn dest(aps: &[&Aparelho]) -> BTreeMap<String, String> {
        aps.iter().map(|a| (a.id.to_string(), a.publica())).collect()
    }

    /// Remoto em que as `ok` primeiras gravações dão certo e as outras falham. Com `chega`, a primeira que falha
    /// chega ao remoto, mas a resposta se perde.
    struct Instavel<'a> {
        m: &'a Memoria,
        ok: usize,
        chega: bool,
        feitas: Cell<usize>,
    }
    impl Remoto for Instavel<'_> {
        fn listar(&self, p: &str) -> R<Vec<String>> {
            self.m.listar(p)
        }
        fn baixar(&self, c: &str) -> R<Option<Vec<u8>>> {
            self.m.baixar(c)
        }
        fn gravar(&self, c: &str, b: &[u8]) -> R<()> {
            self.feitas.set(self.feitas.get() + 1);
            if self.feitas.get() <= self.ok {
                return self.m.gravar(c, b);
            }
            if self.chega && self.feitas.get() == self.ok + 1 {
                self.m.gravar(c, b)?;
            }
            Err("sem conexão com o GitHub".into())
        }
        fn conferir(&self) -> R<()> {
            Ok(())
        }
    }

    #[test]
    fn selo_ida_e_volta() {
        let privada = aleatorio::<32>();
        let publica = *PublicKey::from(&StaticSecret::from(privada)).as_bytes();
        let sal = aleatorio::<32>();
        let s = selar(&publica, b"chave nova", b"f1|1|pc-a", &sal).unwrap();
        assert!(!s.windows(10).any(|w| w == b"chave nova"));
        assert_eq!(abrir(&privada, &s, b"f1|1|pc-a", &sal).unwrap(), b"chave nova");
        // Dois selos do mesmo conteúdo são diferentes (efêmera nova a cada vez).
        assert_ne!(s, selar(&publica, b"chave nova", b"f1|1|pc-a", &sal).unwrap());
    }

    #[test]
    fn outro_aparelho_nao_abre_e_aad_ou_sal_errados_falham() {
        let privada = aleatorio::<32>();
        let publica = *PublicKey::from(&StaticSecret::from(privada)).as_bytes();
        let sal = aleatorio::<32>();
        let s = selar(&publica, b"k", b"f1|1|pc-a", &sal).unwrap();
        assert!(abrir(&aleatorio::<32>(), &s, b"f1|1|pc-a", &sal).is_err());
        assert!(abrir(&privada, &s, b"f1|1|pc-b", &sal).is_err());
        assert!(abrir(&privada, &s, b"f1|2|pc-a", &sal).is_err());
        assert!(abrir(&privada, &s, b"f1|1|pc-a", &aleatorio::<32>()).is_err());
        let mut mexido = s.clone();
        *mexido.last_mut().unwrap() ^= 1;
        assert!(abrir(&privada, &mexido, b"f1|1|pc-a", &sal).is_err());
        let mut outra_efemera = s.clone();
        outra_efemera[0] ^= 1;
        assert!(abrir(&privada, &outra_efemera, b"f1|1|pc-a", &sal).is_err());
        assert!(abrir(&privada, &s[..20], b"f1|1|pc-a", &sal).is_err());
        // Pública de ordem baixa (zero) é recusada.
        assert!(selar(&[0u8; 32], b"k", b"x", &sal).is_err());
    }

    #[test]
    fn remover_troca_a_chave_e_o_removido_nao_recebe() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "token-velho");
        let (mut a, mut b, mut x) = (Aparelho::novo("pc-a", &f), Aparelho::novo("cel-b", &f), Aparelho::novo("pc-x", &f));
        let r = preparar(&m, &a.f, "pc-x", dest(&[&a, &b, &x]), Some("token-novo".into())).unwrap();
        assert_eq!((r.base, r.epoca), (0, 1));
        assert!(m.listar("chaves").unwrap().is_empty(), "preparar não grava nada");
        publicar(&m, &r).unwrap();
        assert!(m.baixar(&arquivo(1, "pc-x")).unwrap().is_none());

        assert_eq!(a.atualizar(&m), Situacao::Avancou);
        assert_eq!(b.atualizar(&m), Situacao::Avancou);
        assert_eq!(x.atualizar(&m), Situacao::Removido(1));
        assert_eq!((a.f.epoca, b.f.epoca, x.f.epoca), (1, 1, 0));
        assert_eq!(a.f.chave, b.f.chave);
        assert_ne!(a.f.chave, f.chave);
        assert_eq!((a.f.token.as_str(), b.f.token.as_str(), x.f.token.as_str()), ("token-novo", "token-novo", "token-velho"));
        assert_eq!(a.antigas, Antigas::from([(0, f.chave.clone())]));
        assert_eq!(chaves(&a.f, &a.antigas).unwrap().iter().map(|(e, _)| *e).collect::<Vec<_>>(), [0, 1]);
        // Nada mais novo: fica igual.
        assert_eq!(b.atualizar(&m), Situacao::Igual);

        // Uma segunda remoção sem token novo, a partir da época 1: o token continua.
        let mut c = Aparelho::novo("tab-c", &f);
        c.f = b.f.clone();
        c.antigas = b.antigas.clone();
        let r2 = preparar(&m, &b.f, "pc-a", dest(&[&b, &c]), None).unwrap();
        assert_eq!((r2.base, r2.epoca), (1, 2));
        publicar(&m, &r2).unwrap();
        assert_eq!(b.atualizar(&m), Situacao::Avancou);
        assert_eq!(c.atualizar(&m), Situacao::Avancou);
        assert_eq!(a.atualizar(&m), Situacao::Removido(2));
        assert_eq!(b.f.token, "token-novo");
        // Quem estava na época 0 e ficou nas duas segue a cadeia inteira de uma vez.
        let mut atrasado = Aparelho::novo("cel-d", &f);
        let r3 = preparar(&m, &c.f, "tab-zz", dest(&[&c, &atrasado]), None).unwrap();
        publicar(&m, &r3).unwrap();
        // cel-d não estava nas trocas 1 e 2: para ele, a família saiu sem ele na época 1.
        assert_eq!(atrasado.atualizar(&m), Situacao::Removido(1));
        assert_eq!(c.atualizar(&m), Situacao::Avancou);
        assert_eq!(c.f.epoca, 3);
        assert_eq!(chaves(&c.f, &c.antigas).unwrap().iter().map(|(e, _)| *e).collect::<Vec<_>>(), [0, 1, 2, 3]);
    }

    #[test]
    fn pacotes_de_epoca_zero_continuam_legiveis() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let (mut a, mut b, mut x) = (Aparelho::novo("pc-a", &f), Aparelho::novo("cel-b", &f), Aparelho::novo("pc-x", &f));
        let evs = |ids: &[&str], de: &str| ids.iter().map(|i| json!({"id": i, "aparelho": de})).collect::<Vec<_>>();
        sincronia::enviar(&m, &a.f, "pc-a", &evs(&["1", "2"], "pc-a"), 1).unwrap();
        publicar(&m, &preparar(&m, &a.f, "pc-x", dest(&[&a, &b]), None).unwrap()).unwrap();
        a.atualizar(&m);
        b.atualizar(&m);
        x.atualizar(&m);
        sincronia::enviar(&m, &a.f, "pc-a", &evs(&["3"], "pc-a"), 1).unwrap();
        assert!(m.baixar("eventos/pc-a/000001.bin").unwrap().is_some());
        assert!(m.baixar("eventos/pc-a/1-000001.bin").unwrap().is_some());

        let ler = |ap: &Aparelho| {
            let mut out = vec![];
            for (e, k) in chaves(&ap.f, &ap.antigas).unwrap() {
                let mut n = 1;
                while let Some(Baixado::Eventos(v)) = sincronia::baixar_proximo(&m, &f.familia_id, &k, e, "pc-a", n).unwrap() {
                    out.extend(v.into_iter().map(|e| e["id"].as_str().unwrap().to_string()));
                    n += 1;
                }
            }
            out
        };
        assert_eq!(ler(&b), ["1", "2", "3"]);
        // O removido lê o que já era dele (época 0), mas não o que veio depois.
        assert_eq!(ler(&x), ["1", "2"]);
        let k0 = f.chave_bytes().unwrap();
        assert!(matches!(sincronia::baixar_proximo(&m, &f.familia_id, &k0, 1, "pc-a", 1), Ok(Some(Baixado::Ilegivel))));
    }

    #[test]
    fn falha_no_meio_nao_muda_nada_e_repetir_termina() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let (mut a, mut b, mut c) = (Aparelho::novo("pc-a", &f), Aparelho::novo("cel-b", &f), Aparelho::novo("tab-c", &f));
        let r = preparar(&m, &a.f, "pc-x", dest(&[&a, &b, &c]), None).unwrap();
        // O primeiro arquivo sobe; o segundo chega ao remoto, mas a resposta se perde (conta como gravado);
        // o terceiro falha de vez.
        let instavel = Instavel { m: &m, ok: 1, chega: true, feitas: Cell::new(0) };
        assert_eq!(publicar(&instavel, &r).unwrap_err(), "sem conexão com o GitHub");
        assert!(m.baixar(&arquivo(1, "pc-a")).unwrap().is_some() && m.baixar(&arquivo(1, "tab-c")).unwrap().is_none());
        // Sem o marco, ninguém troca de chave (nem quem já tem o arquivo, nem quem remove).
        assert_eq!(b.atualizar(&m), Situacao::Igual);
        assert_eq!(a.atualizar(&m), Situacao::Igual);
        assert_eq!(b.f.epoca, 0);
        // Repetir com os mesmos bytes termina, mesmo com arquivos já lá.
        let r_guardada: Rotacao = serde_json::from_value(serde_json::to_value(&r).unwrap()).unwrap();
        assert!(r_guardada.serve_para(0, "pc-x", &None, &dest(&[&a, &b, &c])));
        assert!(!r_guardada.serve_para(0, "pc-x", &Some("t2".into()), &dest(&[&a, &b, &c])));
        assert!(!r_guardada.serve_para(1, "pc-x", &None, &dest(&[&a, &b, &c])));
        publicar(&m, &r_guardada).unwrap();
        publicar(&m, &r_guardada).unwrap();
        for ap in [&mut a, &mut b, &mut c] {
            assert_eq!(ap.atualizar(&m), Situacao::Avancou);
        }
        assert!(a.f.chave == b.f.chave && b.f.chave == c.f.chave);
    }

    #[test]
    fn troca_abandonada_nao_ocupa_a_proxima() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let (mut a, mut b) = (Aparelho::novo("pc-a", &f), Aparelho::novo("cel-b", &f));
        let r = preparar(&m, &a.f, "pc-x", dest(&[&a, &b]), None).unwrap();
        let _ = publicar(&Instavel { m: &m, ok: 1, chega: false, feitas: Cell::new(0) }, &r);
        // Outra tentativa (outro pedido): época nova, nomes livres.
        let r2 = preparar(&m, &a.f, "pc-x", dest(&[&a, &b]), Some("t2".into())).unwrap();
        assert_eq!(r2.epoca, 2);
        publicar(&m, &r2).unwrap();
        assert_eq!(a.atualizar(&m), Situacao::Avancou);
        assert_eq!(b.atualizar(&m), Situacao::Avancou);
        assert_eq!((a.f.epoca, b.f.epoca), (2, 2));
        // A abandonada não pode mais terminar: o marco da época 0 já é da outra.
        assert!(publicar(&m, &r).unwrap_err().starts_with(CONFLITO));
    }

    #[test]
    fn duas_remocoes_ao_mesmo_tempo_nao_dividem_a_familia() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let (mut a, mut b, mut c, mut x, mut y) =
            (Aparelho::novo("pc-a", &f), Aparelho::novo("cel-b", &f), Aparelho::novo("tab-c", &f), Aparelho::novo("pc-x", &f), Aparelho::novo("pc-y", &f));
        // A remove X e B remove Y a partir da mesma época, sem ver um ao outro.
        let ra = preparar(&m, &a.f, "pc-x", dest(&[&a, &b, &c, &y]), None).unwrap();
        let rb = preparar(&m, &b.f, "pc-y", dest(&[&a, &b, &c, &x]), None).unwrap();
        assert_eq!(ra.epoca, rb.epoca);
        // B começa e cai no meio (gravou o arquivo de cel-b); A tenta tudo e perde já no primeiro arquivo.
        let _ = publicar(&Instavel { m: &m, ok: 1, chega: false, feitas: Cell::new(0) }, &rb);
        assert!(publicar(&m, &ra).unwrap_err().starts_with(CONFLITO));
        // Ninguém mudou ainda.
        for ap in [&mut a, &mut b, &mut c, &mut x, &mut y] {
            assert_eq!(ap.atualizar(&m), Situacao::Igual);
        }
        // B termina; A, tentando de novo a mesma troca, perde de novo (o marco da época 0 é de B).
        publicar(&m, &rb).unwrap();
        assert!(publicar(&m, &ra).unwrap_err().starts_with(CONFLITO));
        // Todos seguem a mesma sucessora, a de B; Y foi removido.
        for ap in [&mut a, &mut b, &mut c, &mut x] {
            assert_eq!(ap.atualizar(&m), Situacao::Avancou, "{}", ap.id);
        }
        assert!([&b, &c, &x].iter().all(|ap| ap.f.chave == a.f.chave && ap.f.epoca == 1));
        assert_eq!(y.atualizar(&m), Situacao::Removido(1));
        // A pede de novo, agora a partir da época 1: época nova, sem conflito, e X sai.
        let ra2 = preparar(&m, &a.f, "pc-x", dest(&[&a, &b, &c]), None).unwrap();
        assert_eq!((ra2.base, ra2.epoca), (1, 2));
        publicar(&m, &ra2).unwrap();
        for ap in [&mut a, &mut b, &mut c] {
            assert_eq!(ap.atualizar(&m), Situacao::Avancou);
        }
        assert_eq!(x.atualizar(&m), Situacao::Removido(2));
    }

    #[test]
    fn arquivo_de_quem_perdeu_nao_vale() {
        // A remove X e B remove A, ao mesmo tempo. B grava o arquivo de X (com a chave de B) antes de A;
        // A grava o de B e o marco antes de B. X tem um arquivo, mas a chave dele não confere com o marco: removido.
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let (mut a, mut b, mut x) = (Aparelho::novo("pc-a", &f), Aparelho::novo("cel-b", &f), Aparelho::novo("pc-x", &f));
        let ra = preparar(&m, &a.f, "pc-x", dest(&[&a, &b]), None).unwrap();
        let rb = preparar(&m, &b.f, "pc-a", dest(&[&b, &x]), None).unwrap();
        let so = |r: &Rotacao, nome: &str| Rotacao { arquivos: r.arquivos.iter().filter(|(c, _)| c.ends_with(nome)).cloned().collect(), ..r.clone() };
        publicar(&m, &so(&rb, "pc-x.bin")).unwrap();
        publicar(&m, &ra).unwrap();
        assert!(publicar(&m, &rb).unwrap_err().starts_with(CONFLITO));
        assert_eq!(a.atualizar(&m), Situacao::Avancou);
        assert_eq!(b.atualizar(&m), Situacao::Avancou);
        assert_eq!(x.atualizar(&m), Situacao::Removido(1));
    }

    #[test]
    fn arquivo_mexido_e_erro_e_nao_troca_a_chave() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let (a, mut b) = (Aparelho::novo("pc-a", &f), Aparelho::novo("cel-b", &f));
        let r = preparar(&m, &a.f, "pc-x", dest(&[&a, &b]), None).unwrap();
        publicar(&m, &r).unwrap();
        m.arquivos.lock().unwrap().get_mut(&arquivo(1, "cel-b")).unwrap()[40] ^= 1;
        assert!(atualizar(&m, &mut b.f, &mut b.antigas, b.id, &b.privada).is_err());
        assert_eq!(b.f.epoca, 0);
        assert!(b.antigas.is_empty());
    }

    #[test]
    fn sem_familia_nao_se_fabrica_chave_nova() {
        // Quem só tem o token (sem a chave da época) sela com outro sal: o aparelho não aceita.
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let mut b = Aparelho::novo("cel-b", &f);
        let intruso = Familia::nova("a/b", "t");
        let falsa = Familia { familia_id: f.familia_id.clone(), ..intruso };
        publicar(&m, &preparar(&m, &falsa, "pc-a", dest(&[&b]), Some("token-do-intruso".into())).unwrap()).unwrap();
        assert!(atualizar(&m, &mut b.f, &mut b.antigas, b.id, &b.privada).is_err());
        assert_eq!((b.f.epoca, b.f.token.as_str()), (0, "t"));
    }

    #[test]
    fn ids_de_aparelho_seguros_para_caminho() {
        assert!(id_valido("pc-ab12cd") && id_valido("cel-000000"));
        for ruim in ["", "../x", "a/b", "proxima", "pc a", &"a".repeat(41)] {
            assert!(!id_valido(ruim), "{ruim}");
        }
    }
}
