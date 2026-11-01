//! Arquivo de backup `.fsaude`.
//!
//! Formato: `FSAUDE` + versão (1 byte) | sal Argon2 (16 bytes) | nonce (24) | texto cifrado.
//! O conteúdo decifrado é um JSON com o log de eventos completo.
//! A chave vem só da senha do backup, então o arquivo abre em qualquer aparelho.

use crate::cripto::{aleatorio, derivar_chave, Cofre};
use serde_json::{json, Value};

const MAGICA: &[u8; 6] = b"FSAUDE";
const VERSAO: u8 = 1;
const TAM_SAL: usize = 16;

pub fn gerar(eventos: &[Value], senha: &str, versao_app: &str) -> Result<Vec<u8>, String> {
    if senha.chars().count() < 6 {
        return Err("A senha do backup precisa ter pelo menos 6 caracteres.".into());
    }
    let conteudo = json!({
        "formato": "fsaude",
        "versao": VERSAO,
        "app": versao_app,
        "criadoEm": chrono::Local::now().to_rfc3339(),
        "eventos": eventos,
    });
    let sal = aleatorio::<TAM_SAL>();
    let chave = derivar_chave(senha, &sal).map_err(|e| e.to_string())?;
    let mut cabecalho = Vec::with_capacity(MAGICA.len() + 1);
    cabecalho.extend_from_slice(MAGICA);
    cabecalho.push(VERSAO);
    let cifrado = Cofre::new(&chave)
        .cifrar(&serde_json::to_vec(&conteudo).map_err(|e| e.to_string())?, &cabecalho)
        .map_err(|e| e.to_string())?;
    let mut out = cabecalho;
    out.extend_from_slice(&sal);
    out.extend_from_slice(&cifrado);
    Ok(out)
}

pub fn abrir(bytes: &[u8], senha: &str) -> Result<Vec<Value>, String> {
    let cab = MAGICA.len() + 1;
    if bytes.len() < cab + TAM_SAL || &bytes[..MAGICA.len()] != MAGICA {
        return Err("Este arquivo não é um backup do Prontuário de Casa.".into());
    }
    if bytes[MAGICA.len()] != VERSAO {
        return Err("Backup de uma versão mais nova do app. Atualize o app e tente de novo.".into());
    }
    let sal = &bytes[cab..cab + TAM_SAL];
    let chave = derivar_chave(senha, sal).map_err(|e| e.to_string())?;
    let claro = Cofre::new(&chave)
        .decifrar(&bytes[cab + TAM_SAL..], &bytes[..cab])
        .map_err(|_| "Senha incorreta ou arquivo danificado.".to_string())?;
    let v: Value = serde_json::from_slice(&claro).map_err(|_| "Backup danificado.".to_string())?;
    v.get("eventos").and_then(Value::as_array).cloned().ok_or_else(|| "Backup sem dados.".into())
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn backup_ida_e_volta() {
        let evs = vec![json!({"id": "1", "tipo": "addRemedio", "dados": {"nome": "Losartana 50 mg"}})];
        let b = gerar(&evs, "senha-forte", "0.2.0").unwrap();
        assert!(b.starts_with(b"FSAUDE"));
        assert!(!b.windows(9).any(|w| w == b"Losartana"));
        assert_eq!(abrir(&b, "senha-forte").unwrap(), evs);
        assert_eq!(abrir(&b, "outra-senha").unwrap_err(), "Senha incorreta ou arquivo danificado.");
        assert!(abrir(b"qualquer coisa", "x").is_err());
        assert!(gerar(&evs, "123", "0.2.0").is_err());
    }
}
