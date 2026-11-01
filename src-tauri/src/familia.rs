//! A família: repositório, token e chave (tudo no kv cifrado do aparelho) e o convite em texto.

use crate::cripto::aleatorio;
use crate::remoto::Remoto;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

type R<T> = Result<T, String>;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Familia {
    pub familia_id: String,
    pub repo: String,
    pub token: String,
    /// 32 bytes em hex.
    pub chave: String,
}

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
        Self { familia_id: hex(&aleatorio::<8>()), repo: repo.trim().to_string(), token: token.trim().to_string(), chave: hex(&aleatorio::<32>()) }
    }
    pub fn chave_bytes(&self) -> R<[u8; 32]> {
        let mut out = [0u8; 32];
        if self.chave.len() != 64 {
            return Err("chave da família inválida".into());
        }
        for i in 0..32 {
            out[i] = u8::from_str_radix(&self.chave[i * 2..i * 2 + 2], 16).map_err(|_| "chave da família inválida".to_string())?;
        }
        Ok(out)
    }
}

pub fn convite(f: &Familia) -> String {
    let j = json!({ "v": 1, "f": f.familia_id, "r": f.repo, "t": f.token, "k": f.chave });
    format!("{PREFIXO}{}", base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(j.to_string()))
}

pub fn ler_convite(texto: &str) -> R<Familia> {
    let invalido = || "convite inválido: copie o texto inteiro, começando por PCASA1:".to_string();
    let corpo = texto.trim().strip_prefix(PREFIXO).ok_or_else(invalido)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(corpo).map_err(|_| invalido())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(|_| invalido())?;
    let s = |k: &str| v.get(k).and_then(Value::as_str).map(String::from).ok_or_else(invalido);
    let f = Familia { familia_id: s("f")?, repo: s("r")?, token: s("t")?, chave: s("k")? };
    if !repo_valido(&f.repo) {
        return Err(invalido());
    }
    f.chave_bytes().map_err(|_| invalido())?;
    Ok(f)
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
        assert_eq!(ler_convite(&convite(&f)).unwrap(), f);
        assert!(ler_convite("PCASA1:@@@").is_err());
        assert!(ler_convite("qualquer coisa").is_err());
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
}
