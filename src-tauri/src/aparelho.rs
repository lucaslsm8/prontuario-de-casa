//! Chave X25519 deste aparelho: criada na primeira vez, guardada no `kv` cifrado (`chave_x25519`,
//! chave privada em hex). A pública vai no evento `aparelho` e identifica o aparelho para os outros.

use crate::banco::Banco;
use crate::cripto::aleatorio;
use serde_json::{json, Value};
use x25519_dalek::{PublicKey, StaticSecret};

pub const CHAVE_KV: &str = "chave_x25519";

type R<T> = Result<T, String>;

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn de_hex(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let mut o = [0u8; 32];
    for (i, par) in o.iter_mut().enumerate() {
        *par = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(o)
}

/// A chave privada deste aparelho; cria e guarda uma se ainda não existe.
pub fn segredo(b: &Banco) -> R<StaticSecret> {
    if let Some(Value::String(s)) = b.kv_get(CHAVE_KV)? {
        return de_hex(&s).map(StaticSecret::from).ok_or_else(|| "chave do aparelho inválida".to_string());
    }
    let novo = StaticSecret::from(aleatorio::<32>());
    b.kv_set(CHAVE_KV, &json!(hex(&novo.to_bytes())))?;
    Ok(novo)
}

/// A chave pública (hex) deste aparelho.
pub fn chave_publica(b: &Banco) -> R<String> {
    Ok(hex(PublicKey::from(&segredo(b)?).as_bytes()))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn chave_publica_e_estavel() {
        let dir = tempfile::tempdir().unwrap();
        let arq = dir.path().join("t.db");
        let k = aleatorio::<32>();
        let a = {
            let b = Banco::abrir(&arq, &k).unwrap();
            let a = chave_publica(&b).unwrap();
            assert_eq!(a.len(), 64);
            assert_eq!(a, chave_publica(&b).unwrap());
            a
        };
        // Reabrindo o banco, a mesma chave.
        let b = Banco::abrir(&arq, &k).unwrap();
        assert_eq!(a, chave_publica(&b).unwrap());
        assert_ne!(a, chave_publica(&Banco::abrir(&dir.path().join("outro.db"), &k).unwrap()).unwrap());
    }

    #[test]
    fn chave_privada_nao_fica_em_claro() {
        let dir = tempfile::tempdir().unwrap();
        let arq = dir.path().join("t.db");
        let b = Banco::abrir(&arq, &aleatorio::<32>()).unwrap();
        let s = hex(&segredo(&b).unwrap().to_bytes());
        drop(b);
        let bytes = std::fs::read(&arq).unwrap();
        assert!(!bytes.windows(s.len()).any(|w| w == s.as_bytes()));
    }
}
