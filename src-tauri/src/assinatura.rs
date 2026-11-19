//! Assinatura dos eventos por aparelho (Ed25519). A chave privada nasce na primeira vez e fica no `kv`
//! cifrado (`chave_ed25519`, semente em hex); a pública vai no evento `aparelho` (`chaveAssinatura`).
//! O front assina o texto canônico de cada evento (`textoAssinado` em src/data/assinatura.ts) e confere
//! os eventos dos outros aparelhos com `verificar`.

use crate::banco::Banco;
use crate::cripto::aleatorio;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::Deserialize;
use serde_json::{json, Value};

pub const CHAVE_KV: &str = "chave_ed25519";

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

/// A chave de assinatura deste aparelho; cria e guarda uma se ainda não existe.
pub fn chave(b: &Banco) -> R<SigningKey> {
    if let Some(Value::String(s)) = b.kv_get(CHAVE_KV)? {
        return de_hex(&s).map(|x| SigningKey::from_bytes(&x)).ok_or_else(|| "chave de assinatura inválida".to_string());
    }
    let semente = aleatorio::<32>();
    b.kv_set(CHAVE_KV, &json!(hex(&semente)))?;
    Ok(SigningKey::from_bytes(&semente))
}

/// A chave pública (base64) deste aparelho.
pub fn publica(b: &Banco) -> R<String> {
    Ok(B64.encode(chave(b)?.verifying_key().as_bytes()))
}

/// Assina o texto (UTF-8) e devolve a assinatura em base64.
pub fn assinar(b: &Banco, texto: &str) -> R<String> {
    Ok(B64.encode(chave(b)?.sign(texto.as_bytes()).to_bytes()))
}

/// Um item a conferir: o texto canônico do evento, a assinatura e a chave pública de quem diz ter assinado.
#[derive(Deserialize)]
pub struct ItemVerificar {
    pub texto: String,
    pub sig: String,
    pub chave: String,
}

/// Confere a assinatura; qualquer erro de formato vale como inválida.
pub fn verificar(i: &ItemVerificar) -> bool {
    let Ok(chave) = B64.decode(&i.chave) else { return false };
    let Ok(chave) = <[u8; 32]>::try_from(chave.as_slice()) else { return false };
    let Ok(chave) = VerifyingKey::from_bytes(&chave) else { return false };
    let Ok(sig) = B64.decode(&i.sig) else { return false };
    let Ok(sig) = <[u8; 64]>::try_from(sig.as_slice()) else { return false };
    chave.verify(i.texto.as_bytes(), &Signature::from_bytes(&sig)).is_ok()
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn assina_e_confere() {
        let dir = tempfile::tempdir().unwrap();
        let b = Banco::abrir(&dir.path().join("t.db"), &aleatorio::<32>()).unwrap();
        let chave = publica(&b).unwrap();
        assert_eq!(chave, publica(&b).unwrap(), "a mesma chave nas próximas vezes");
        let sig = assinar(&b, "[\"ev1\",\"x\"]").unwrap();
        assert!(verificar(&ItemVerificar { texto: "[\"ev1\",\"x\"]".into(), sig: sig.clone(), chave: chave.clone() }));
        // Texto mexido, outra chave ou lixo: não confere.
        assert!(!verificar(&ItemVerificar { texto: "[\"ev1\",\"y\"]".into(), sig: sig.clone(), chave: chave.clone() }));
        let outro = Banco::abrir(&dir.path().join("o.db"), &aleatorio::<32>()).unwrap();
        assert!(!verificar(&ItemVerificar { texto: "[\"ev1\",\"x\"]".into(), sig: sig.clone(), chave: publica(&outro).unwrap() }));
        assert!(!verificar(&ItemVerificar { texto: "x".into(), sig: "não é base64".into(), chave }));
    }

    #[test]
    fn semente_nao_fica_em_claro() {
        let dir = tempfile::tempdir().unwrap();
        let arq = dir.path().join("t.db");
        let b = Banco::abrir(&arq, &aleatorio::<32>()).unwrap();
        let s = hex(&chave(&b).unwrap().to_bytes());
        drop(b);
        let bytes = std::fs::read(&arq).unwrap();
        assert!(!bytes.windows(s.len()).any(|w| w == s.as_bytes()));
    }
}
