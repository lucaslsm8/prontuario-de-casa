//! A família: repositório, token e chave (tudo no kv cifrado do aparelho) e o convite em texto.
//! A chave muda quando um aparelho é removido (época nova, `epoca.rs`); as das épocas anteriores ficam em
//! `chaves_antigas:<familiaId>` para ler os pacotes antigos, e vão no convite.

use crate::cripto::aleatorio;
use crate::remoto::Remoto;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;

type R<T> = Result<T, String>;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Familia {
    pub familia_id: String,
    pub repo: String,
    pub token: String,
    /// 32 bytes em hex: a chave da época atual.
    pub chave: String,
    /// Época da chave (0 = a original; sobe a cada aparelho removido). Famílias antigas não têm o campo.
    #[serde(default)]
    pub epoca: u32,
}

/// Chaves das épocas anteriores (época → chave em hex).
pub type Antigas = BTreeMap<u32, String>;

const PREFIXO: &str = "PCASA1:";

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

pub fn repo_valido(repo: &str) -> bool {
    let partes: Vec<&str> = repo.split('/').collect();
    partes.len() == 2 && partes.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c)))
}

impl Familia {
    pub fn nova(repo: &str, token: &str) -> Self {
        Self { familia_id: hex(&aleatorio::<8>()), repo: repo.trim().to_string(), token: token.trim().to_string(), chave: hex(&aleatorio::<32>()), epoca: 0 }
    }
    pub fn chave_bytes(&self) -> R<[u8; 32]> {
        chave_de_hex(&self.chave)
    }
}

/// 64 dígitos hex → 32 bytes.
pub fn chave_de_hex(s: &str) -> R<[u8; 32]> {
    let mut out = [0u8; 32];
    if s.len() != 64 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("chave da família inválida".into());
    }
    for (dst, par) in out.iter_mut().zip(s.as_bytes().chunks(2)) {
        let par = std::str::from_utf8(par).map_err(|_| "chave da família inválida".to_string())?;
        *dst = u8::from_str_radix(par, 16).map_err(|_| "chave da família inválida".to_string())?;
    }
    Ok(out)
}

pub fn chave_hex(b: &[u8; 32]) -> String {
    hex(b)
}

/// `expira_ms`: instante (ms desde 1970) em que o convite vence; `None` = sem prazo.
/// Depois de uma troca de chave, o convite leva a época e as chaves antigas (quem entra lê o histórico todo).
pub fn convite(f: &Familia, antigas: &Antigas, expira_ms: Option<u64>) -> String {
    let mut j = json!({ "v": 1, "f": f.familia_id, "r": f.repo, "t": f.token, "k": f.chave });
    if f.epoca > 0 {
        j["e"] = json!(f.epoca);
    }
    let antigas: BTreeMap<String, &String> = antigas.iter().filter(|(e, _)| **e < f.epoca).map(|(e, k)| (e.to_string(), k)).collect();
    if !antigas.is_empty() {
        j["ka"] = json!(antigas);
    }
    if let Some(x) = expira_ms {
        j["x"] = json!(x);
    }
    format!("{PREFIXO}{}", base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(j.to_string()))
}

/// `agora_ms`: instante atual (ms desde 1970), para conferir o prazo. Convite sem época = época 0.
pub fn ler_convite(texto: &str, agora_ms: u64) -> R<(Familia, Antigas)> {
    let invalido = || "convite inválido: copie o texto inteiro, começando por PCASA1:".to_string();
    let corpo = texto.trim().strip_prefix(PREFIXO).ok_or_else(invalido)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(corpo).map_err(|_| invalido())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(|_| invalido())?;
    if v.get("x").and_then(Value::as_u64).is_some_and(|x| agora_ms > x) {
        return Err("convite vencido; gere outro".into());
    }
    let s = |k: &str| v.get(k).and_then(Value::as_str).map(String::from).ok_or_else(invalido);
    let epoca = match v.get("e") {
        None => 0,
        Some(e) => e.as_u64().and_then(|e| u32::try_from(e).ok()).ok_or_else(invalido)?,
    };
    let f = Familia { familia_id: s("f")?, repo: s("r")?, token: s("t")?, chave: s("k")?, epoca };
    if !repo_valido(&f.repo) {
        return Err(invalido());
    }
    f.chave_bytes().map_err(|_| invalido())?;
    let mut antigas = Antigas::new();
    if let Some(ka) = v.get("ka") {
        for (e, k) in ka.as_object().ok_or_else(invalido)? {
            let e: u32 = e.parse().map_err(|_| invalido())?;
            let k = k.as_str().ok_or_else(invalido)?;
            chave_de_hex(k).map_err(|_| invalido())?;
            if e < epoca {
                antigas.insert(e, k.to_string());
            }
        }
    }
    Ok((f, antigas))
}

/// Confere (ou cria, se `criar`) o familia.json do repositório.
pub fn conferir_familia_json(remoto: &dyn Remoto, familia_id: &str, criar: bool) -> R<()> {
    match remoto.baixar("familia.json")? {
        Some(b) => {
            let v: Value = serde_json::from_slice(&b).map_err(|_| "familia.json inválido no repositório".to_string())?;
            if v.get("familiaId").and_then(Value::as_str) == Some(familia_id) {
                Ok(())
            } else if criar {
                Err("esse repositório já é de outra família; use \"Entrar com convite\"".into())
            } else {
                Err("o convite não é da família desse repositório".into())
            }
        }
        None if criar => remoto.gravar("familia.json", json!({ "familiaId": familia_id, "versao": 1 }).to_string().as_bytes()),
        None => Err("o repositório ainda não tem uma família; peça um convite novo".into()),
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::remoto::Memoria;

    #[test]
    fn convite_ida_e_volta() {
        let f = Familia::nova("lucas/prontuario-sync", "github_pat_x");
        assert_eq!(ler_convite(&convite(&f, &Antigas::new(), None), 0).unwrap(), (f, Antigas::new()));
        assert!(ler_convite("PCASA1:@@@", 0).is_err());
        assert!(ler_convite("qualquer coisa", 0).is_err());
    }

    #[test]
    fn convite_com_prazo() {
        let f = Familia::nova("lucas/prontuario-sync", "github_pat_x");
        let c = convite(&f, &Antigas::new(), Some(1_000));
        assert_eq!(ler_convite(&c, 999).unwrap().0, f);
        assert_eq!(ler_convite(&c, 1_000).unwrap().0, f);
        let e = ler_convite(&c, 1_001).unwrap_err();
        assert!(e.contains("vencido"), "{e}");
        // Convite antigo (sem "x") nunca vence.
        assert_eq!(ler_convite(&convite(&f, &Antigas::new(), None), u64::MAX).unwrap().0, f);
    }

    #[test]
    fn convite_leva_epoca_e_chaves_antigas() {
        let mut f = Familia::nova("lucas/prontuario-sync", "github_pat_x");
        let antigas = Antigas::from([(0, hex(&aleatorio::<32>())), (1, hex(&aleatorio::<32>()))]);
        f.epoca = 2;
        assert_eq!(ler_convite(&convite(&f, &antigas, None), 0).unwrap(), (f.clone(), antigas.clone()));
        // Família antiga, guardada sem o campo `epoca`: época 0.
        let v = json!({"familiaId": "f1", "repo": "a/b", "token": "t", "chave": f.chave});
        assert_eq!(serde_json::from_value::<Familia>(v).unwrap().epoca, 0);
        // Chave antiga inválida invalida o convite.
        let ruim = Antigas::from([(0, "zz".to_string())]);
        assert!(ler_convite(&convite(&f, &ruim, None), 0).is_err());
    }

    #[test]
    fn repo_no_formato_dono_nome() {
        assert!(repo_valido("lucas/prontuario-sync"));
        for ruim in ["lucas", "lucas/", "/x", "a/b/c", "a b/c", "https://github.com/a/b"] {
            assert!(!repo_valido(ruim), "{ruim}");
        }
    }

    #[test]
    fn familia_json_cria_confere_e_recusa_outra() {
        let m = Memoria::default();
        assert!(conferir_familia_json(&m, "f1", false).is_err());
        conferir_familia_json(&m, "f1", true).unwrap();
        conferir_familia_json(&m, "f1", false).unwrap();
        assert!(conferir_familia_json(&m, "f2", true).is_err());
        assert!(conferir_familia_json(&m, "f2", false).is_err());
    }

    #[test]
    fn chave_invalida_vira_erro_sem_panico() {
        let mut f = Familia::nova("lucas/prontuario-sync", "github_pat_x");
        // 64 bytes com caracteres multibyte: fatiar em i*2 cairia no meio de um caractere.
        f.chave = "é".repeat(32);
        assert_eq!(f.chave.len(), 64);
        assert!(f.chave_bytes().is_err());
        assert!(ler_convite(&convite(&f, &Antigas::new(), None), 0).is_err());
        f.chave = "€".repeat(21) + "a";
        assert_eq!(f.chave.len(), 64);
        assert!(f.chave_bytes().is_err());
        // u8::from_str_radix aceita "+f": a chave precisa ser só dígitos hex.
        f.chave = "+f".repeat(32);
        assert_eq!(f.chave.len(), 64);
        assert!(f.chave_bytes().is_err());
        assert!(ler_convite(&convite(&f, &Antigas::new(), None), 0).is_err());
    }
}
