//! Atualização do APK pelo GitHub Releases (só Android usa; o desktop usa o tauri-plugin-updater).
//! Consulta a API pública de releases deste repositório, baixa o `*_android.apk` e confere o SHA-256
//! publicado ao lado. Nada é enviado.

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

pub const URL_ULTIMA: &str = "https://api.github.com/repos/lucaslsm8/prontuario-de-casa/releases/latest";
const PREFIXO_DOWNLOAD: &str = "https://github.com/lucaslsm8/prontuario-de-casa/releases/download/";
const LIMITE_APK: u64 = 200 * 1024 * 1024;

#[derive(Debug, PartialEq, Serialize)]
pub struct Nova {
    pub versao: String,
    pub notas: String,
    pub url: String,
    pub sha256: String,
}

/// "0.4.0" / "v0.5.1" → [0, 4, 0]. Parte não numérica vira 0.
fn partes(v: &str) -> Vec<u64> {
    v.trim().trim_start_matches('v').split('.').map(|p| p.chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0)).collect()
}

/// true se `nova` é maior que `atual`.
pub fn mais_nova(nova: &str, atual: &str) -> bool {
    let (a, b) = (partes(nova), partes(atual));
    let n = a.len().max(b.len());
    for i in 0..n {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y {
            return x > y;
        }
    }
    false
}

/// Do JSON da release: versão, notas e os endereços do APK e do .sha256 (nessa ordem).
/// None se a release não traz os dois arquivos do Android.
pub fn ler_release(json: &Value) -> Option<(String, String, String, String)> {
    let versao = json.get("tag_name")?.as_str()?.trim_start_matches('v').to_string();
    let notas = json.get("body").and_then(|b| b.as_str()).unwrap_or("").to_string();
    let ativos = json.get("assets")?.as_array()?;
    let achar = |sufixo: &str| {
        ativos.iter().find_map(|a| {
            let nome = a.get("name")?.as_str()?;
            if nome.ends_with(sufixo) {
                a.get("browser_download_url")?.as_str().map(String::from)
            } else {
                None
            }
        })
    };
    Some((versao, notas, achar("_android.apk")?, achar("_android.apk.sha256")?))
}

/// "<hex>  <arquivo>" (formato do sha256sum) → hex minúsculo de 64 dígitos.
pub fn ler_sha256(texto: &str) -> Option<String> {
    let h = texto.split_whitespace().next()?.to_ascii_lowercase();
    (h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit())).then_some(h)
}

pub fn hash_confere(calculado: &str, esperado: &str) -> bool {
    calculado.eq_ignore_ascii_case(esperado.trim())
}

fn erro_http(e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(c, _) => format!("o GitHub respondeu {c}"),
        _ => "sem conexão com o GitHub".to_string(),
    }
}

fn pegar_texto(url: &str, limite: u64) -> Result<String, String> {
    let resp = ureq::get(url)
        .set("User-Agent", "prontuario-de-casa")
        .set("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(20))
        .call()
        .map_err(erro_http)?;
    let mut t = String::new();
    resp.into_reader().take(limite).read_to_string(&mut t).map_err(|_| "resposta inválida".to_string())?;
    Ok(t)
}

/// Consulta a última release. Some(Nova) só se for mais nova que `instalada`.
pub fn verificar(instalada: &str) -> Result<Option<Nova>, String> {
    let json: Value = serde_json::from_str(&pegar_texto(URL_ULTIMA, 2 * 1024 * 1024)?).map_err(|_| "resposta inválida do GitHub".to_string())?;
    let Some((versao, notas, url, url_hash)) = ler_release(&json) else { return Ok(None) };
    if !mais_nova(&versao, instalada) {
        return Ok(None);
    }
    let sha256 = ler_sha256(&pegar_texto(&url_hash, 4096)?).ok_or("o arquivo de conferência (SHA-256) está inválido")?;
    Ok(Some(Nova { versao, notas, url, sha256 }))
}

/// Baixa o APK para `destino`, confere o SHA-256 e apaga o arquivo se não bater.
pub fn baixar(url: &str, sha256: &str, destino: &Path) -> Result<(), String> {
    if !url.starts_with(PREFIXO_DOWNLOAD) {
        return Err("endereço de download não permitido".into());
    }
    let resp = ureq::get(url).set("User-Agent", "prontuario-de-casa").timeout(Duration::from_secs(120)).call().map_err(erro_http)?;
    let resultado = (|| -> Result<(), String> {
        let mut arq = std::fs::File::create(destino).map_err(|e| format!("não foi possível salvar: {e}"))?;
        let mut leitor = resp.into_reader().take(LIMITE_APK + 1);
        let (mut h, mut total, mut buf) = (Sha256::new(), 0u64, [0u8; 64 * 1024]);
        loop {
            let n = leitor.read(&mut buf).map_err(|_| "o download foi interrompido".to_string())?;
            if n == 0 {
                break;
            }
            total += n as u64;
            h.update(&buf[..n]);
            arq.write_all(&buf[..n]).map_err(|e| format!("não foi possível salvar: {e}"))?;
        }
        if total > LIMITE_APK {
            return Err("o arquivo é grande demais".into());
        }
        let calculado: String = h.finalize().iter().map(|b| format!("{b:02x}")).collect();
        if !hash_confere(&calculado, sha256) {
            return Err("o arquivo baixado não confere com o SHA-256 publicado".into());
        }
        Ok(())
    })();
    if resultado.is_err() {
        let _ = std::fs::remove_file(destino);
    }
    resultado
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn compara_versoes() {
        assert!(mais_nova("0.5.0", "0.4.0"));
        assert!(mais_nova("v0.4.1", "0.4.0"));
        assert!(mais_nova("1.0", "0.9.9"));
        assert!(mais_nova("0.10.0", "0.9.0"));
        assert!(!mais_nova("0.4.0", "0.4.0"));
        assert!(!mais_nova("0.3.9", "0.4.0"));
        assert!(!mais_nova("0.4", "0.4.0"));
    }

    fn exemplo() -> Value {
        json!({
            "tag_name": "v0.5.0",
            "body": "## Novidades\n- Lembretes\n- Atualização no Android",
            "assets": [
                { "name": "Prontuario.de.Casa_0.5.0_x64-setup.exe", "browser_download_url": "https://github.com/x/releases/download/v0.5.0/setup.exe" },
                { "name": "Prontuario.de.Casa_0.5.0_android.apk", "browser_download_url": "https://github.com/x/releases/download/v0.5.0/a.apk" },
                { "name": "Prontuario.de.Casa_0.5.0_android.apk.sha256", "browser_download_url": "https://github.com/x/releases/download/v0.5.0/a.apk.sha256" }
            ]
        })
    }

    #[test]
    fn le_a_release() {
        let (v, notas, apk, sha) = ler_release(&exemplo()).unwrap();
        assert_eq!(v, "0.5.0");
        assert!(notas.contains("- Lembretes"));
        assert!(apk.ends_with("/a.apk"));
        assert!(sha.ends_with("/a.apk.sha256"));
    }

    #[test]
    fn release_sem_apk_vira_none() {
        let mut j = exemplo();
        j["assets"] = json!([{ "name": "setup.exe", "browser_download_url": "https://x/setup.exe" }]);
        assert!(ler_release(&j).is_none());
        assert!(ler_release(&json!({})).is_none());
    }

    #[test]
    fn le_o_arquivo_sha256() {
        let h = "A".repeat(64);
        assert_eq!(ler_sha256(&format!("{h}  Prontuario.apk\n")), Some("a".repeat(64)));
        assert_eq!(ler_sha256("curto  x.apk"), None);
        assert_eq!(ler_sha256(""), None);
    }

    #[test]
    fn confere_o_hash() {
        let h: String = Sha256::digest(b"abc").iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(h, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert!(hash_confere(&h, &h.to_uppercase()));
        assert!(!hash_confere(&h, &"0".repeat(64)));
    }

    #[test]
    fn so_baixa_do_repositorio() {
        let d = std::env::temp_dir().join("apk_teste_nao_existe.apk");
        assert!(baixar("https://exemplo.com/a.apk", &"0".repeat(64), &d).is_err());
        assert!(!d.exists());
    }
}
