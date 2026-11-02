//! Criptografia do app: cofre simétrico (XChaCha20-Poly1305), derivação de chave
//! por senha (Argon2id) e a chave do aparelho, guardada no cofre do sistema.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use rand::rngs::OsRng;
use rand::RngCore;
use std::path::Path;

pub const TAM_NONCE: usize = 24;

#[derive(Debug)]
pub struct ErroCripto(pub String);
impl std::fmt::Display for ErroCripto {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}
impl std::error::Error for ErroCripto {}
type R<T> = Result<T, ErroCripto>;

/// Cifra e decifra blobs no formato `nonce (24 bytes) || texto cifrado + tag`.
pub struct Cofre {
    cifra: XChaCha20Poly1305,
}

impl Cofre {
    pub fn new(chave: &[u8; 32]) -> Self {
        Self { cifra: XChaCha20Poly1305::new(chave.into()) }
    }

    /// `aad` amarra o blob ao contexto (ex.: id do evento), impedindo trocar blobs de lugar.
    pub fn cifrar(&self, dados: &[u8], aad: &[u8]) -> R<Vec<u8>> {
        let mut nonce = [0u8; TAM_NONCE];
        OsRng.fill_bytes(&mut nonce);
        let ct = self
            .cifra
            .encrypt(XNonce::from_slice(&nonce), Payload { msg: dados, aad })
            .map_err(|_| ErroCripto("falha ao cifrar".into()))?;
        let mut out = Vec::with_capacity(TAM_NONCE + ct.len());
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ct);
        Ok(out)
    }

    pub fn decifrar(&self, blob: &[u8], aad: &[u8]) -> R<Vec<u8>> {
        if blob.len() < TAM_NONCE + 16 {
            return Err(ErroCripto("dado cifrado corrompido".into()));
        }
        let (nonce, ct) = blob.split_at(TAM_NONCE);
        self.cifra
            .decrypt(XNonce::from_slice(nonce), Payload { msg: ct, aad })
            .map_err(|_| ErroCripto("não foi possível decifrar (chave ou senha errada, ou arquivo corrompido)".into()))
    }
}

fn argon() -> Argon2<'static> {
    // 64 MiB, 3 passadas: lento o bastante contra força bruta, rápido no celular.
    let p = Params::new(64 * 1024, 3, 1, Some(32)).expect("parâmetros Argon2 válidos");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, p)
}

/// Deriva uma chave de 32 bytes a partir da senha do backup.
pub fn derivar_chave(senha: &str, sal: &[u8]) -> R<[u8; 32]> {
    let mut chave = [0u8; 32];
    argon()
        .hash_password_into(senha.as_bytes(), sal, &mut chave)
        .map_err(|e| ErroCripto(format!("falha ao derivar chave: {e}")))?;
    Ok(chave)
}

/// Hash da senha/PIN de desbloqueio (formato PHC, com sal próprio).
pub fn hash_senha(senha: &str) -> R<String> {
    let sal = SaltString::generate(&mut OsRng);
    argon()
        .hash_password(senha.as_bytes(), &sal)
        .map(|h| h.to_string())
        .map_err(|e| ErroCripto(format!("falha ao guardar senha: {e}")))
}

pub fn conferir_senha(senha: &str, phc: &str) -> bool {
    PasswordHash::new(phc).map(|h| argon().verify_password(senha.as_bytes(), &h).is_ok()).unwrap_or(false)
}

pub fn aleatorio<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    OsRng.fill_bytes(&mut b);
    b
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}
fn de_hex(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

const CONTA: &str = "chave-do-banco";

/// Chave do banco deste aparelho. Windows/macOS: cofre do sistema.
/// Outros (Linux, Android nesta etapa): arquivo na pasta privada do app.
/// `servico` é o identificador do app (`br.familia.arquivosaude` no app real), para um app de teste não tocar na chave do app real.
pub fn chave_do_aparelho(servico: &str, dir: &Path, criar: bool) -> R<[u8; 32]> {
    #[cfg(any(windows, target_os = "macos"))]
    {
        let _ = dir;
        let e = keyring::Entry::new(servico, CONTA).map_err(|e| ErroCripto(format!("cofre do sistema indisponível: {e}")))?;
        match e.get_password() {
            Ok(s) => de_hex(&s).ok_or_else(|| ErroCripto("chave do banco inválida no cofre do sistema".into())),
            Err(keyring::Error::NoEntry) if criar => {
                let k = aleatorio::<32>();
                e.set_password(&hex(&k)).map_err(|e| ErroCripto(format!("não foi possível guardar a chave: {e}")))?;
                Ok(k)
            }
            Err(keyring::Error::NoEntry) => Err(ErroCripto("chave do banco não encontrada neste aparelho".into())),
            Err(err) => Err(ErroCripto(format!("cofre do sistema: {err}"))),
        }
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = (servico, CONTA);
        let arq = dir.join("chave.bin");
        if let Ok(s) = std::fs::read_to_string(&arq) {
            return de_hex(s.trim()).ok_or_else(|| ErroCripto("chave do banco inválida".into()));
        }
        if !criar {
            return Err(ErroCripto("chave do banco não encontrada neste aparelho".into()));
        }
        let k = aleatorio::<32>();
        std::fs::write(&arq, hex(&k)).map_err(|e| ErroCripto(format!("não foi possível guardar a chave: {e}")))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&arq, std::fs::Permissions::from_mode(0o600));
        }
        Ok(k)
    }
}

/// Remove a chave do aparelho (usado em "Apagar todos os dados").
pub fn apagar_chave(servico: &str, dir: &Path) {
    #[cfg(any(windows, target_os = "macos"))]
    {
        let _ = dir;
        if let Ok(e) = keyring::Entry::new(servico, CONTA) {
            let _ = e.delete_credential();
        }
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = servico;
        let _ = std::fs::remove_file(dir.join("chave.bin"));
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn cofre_ida_e_volta() {
        let c = Cofre::new(&aleatorio::<32>());
        let blob = c.cifrar(b"Penicilina", b"ev-1").unwrap();
        assert_eq!(c.decifrar(&blob, b"ev-1").unwrap(), b"Penicilina");
        assert!(c.decifrar(&blob, b"ev-2").is_err(), "aad diferente deve falhar");
        assert!(!blob.windows(10).any(|w| w == b"Penicilina"), "texto não pode aparecer em claro");
    }

    #[test]
    fn senha_confere() {
        let h = hash_senha("123456").unwrap();
        assert!(conferir_senha("123456", &h));
        assert!(!conferir_senha("654321", &h));
    }
}
