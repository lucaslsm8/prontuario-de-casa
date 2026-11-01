//! Onde os pacotes ficam: um repositório privado no GitHub (Contents API).
//! Só bytes cifrados e o familia.json (sem dado pessoal) passam por aqui.

use base64::Engine;
use std::io::Read;
use std::time::Duration;

type R<T> = Result<T, String>;

pub trait Remoto {
    fn listar(&self, pasta: &str) -> R<Vec<String>>;
    fn baixar(&self, caminho: &str) -> R<Option<Vec<u8>>>;
    fn gravar(&self, caminho: &str, bytes: &[u8]) -> R<()>;
    fn conferir(&self) -> R<()>;
}

pub struct GitHub {
    repo: String,
    token: String,
    agente: ureq::Agent,
}

impl GitHub {
    pub fn new(repo: &str, token: &str) -> Self {
        let agente = ureq::AgentBuilder::new().timeout(Duration::from_secs(30)).build();
        Self { repo: repo.to_string(), token: token.to_string(), agente }
    }
    fn url(&self, resto: &str) -> String {
        format!("https://api.github.com/repos/{}{}", self.repo, resto)
    }
    fn req(&self, metodo: &str, url: &str) -> ureq::Request {
        self.agente
            .request(metodo, url)
            .set("Authorization", &format!("Bearer {}", self.token))
            .set("User-Agent", "prontuario-de-casa")
            .set("X-GitHub-Api-Version", "2022-11-28")
    }
}

/// Erro HTTP → texto. 401/403 viram "TOKEN: …" (o app mostra o aviso de token).
fn erro(e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(401, _) | ureq::Error::Status(403, _) => "TOKEN: o token do GitHub não tem acesso ou venceu".into(),
        ureq::Error::Status(c, _) => format!("o GitHub respondeu {c}"),
        _ => "sem conexão com o GitHub".into(),
    }
}

impl Remoto for GitHub {
    fn listar(&self, pasta: &str) -> R<Vec<String>> {
        match self.req("GET", &self.url(&format!("/contents/{pasta}"))).set("Accept", "application/vnd.github+json").call() {
            Ok(r) => {
                let v: serde_json::Value = serde_json::from_reader(r.into_reader()).map_err(|_| "resposta inválida do GitHub".to_string())?;
                Ok(v.as_array().map(|a| a.iter().filter_map(|x| x.get("name").and_then(|n| n.as_str()).map(String::from)).collect()).unwrap_or_default())
            }
            Err(ureq::Error::Status(404, _)) => Ok(vec![]),
            Err(e) => Err(erro(e)),
        }
    }
    fn baixar(&self, caminho: &str) -> R<Option<Vec<u8>>> {
        match self.req("GET", &self.url(&format!("/contents/{caminho}"))).set("Accept", "application/vnd.github.raw+json").call() {
            Ok(r) => {
                let mut b = Vec::new();
                r.into_reader().take(110 * 1024 * 1024).read_to_end(&mut b).map_err(|_| "download interrompido".to_string())?;
                Ok(Some(b))
            }
            Err(ureq::Error::Status(404, _)) => Ok(None),
            Err(e) => Err(erro(e)),
        }
    }
    fn gravar(&self, caminho: &str, bytes: &[u8]) -> R<()> {
        let corpo = serde_json::json!({
            "message": format!("sync {caminho}"),
            "content": base64::engine::general_purpose::STANDARD.encode(bytes),
        });
        self.req("PUT", &self.url(&format!("/contents/{caminho}"))).set("Accept", "application/vnd.github+json").set("Content-Type", "application/json").send_string(&corpo.to_string()).map(|_| ()).map_err(erro)
    }
    fn conferir(&self) -> R<()> {
        let v: serde_json::Value = serde_json::from_reader(self.req("GET", &self.url("")).set("Accept", "application/vnd.github+json").call().map_err(|e| match e {
            ureq::Error::Status(404, _) => "repositório não encontrado (confira o nome e o acesso do token)".to_string(),
            e => erro(e),
        })?.into_reader()).map_err(|_| "resposta inválida do GitHub".to_string())?;
        if v.get("private").and_then(|p| p.as_bool()) != Some(true) {
            return Err("o repositório precisa ser privado".into());
        }
        if v.pointer("/permissions/push").and_then(|p| p.as_bool()) == Some(false) {
            return Err("TOKEN: o token não tem permissão para gravar no repositório".into());
        }
        Ok(())
    }
}

/// Remoto em memória, para testes.
#[cfg(test)]
#[derive(Default)]
pub struct Memoria {
    pub arquivos: std::sync::Mutex<std::collections::BTreeMap<String, Vec<u8>>>,
}

#[cfg(test)]
impl Remoto for Memoria {
    fn listar(&self, pasta: &str) -> R<Vec<String>> {
        let prefixo = format!("{pasta}/");
        let mut nomes: Vec<String> = self.arquivos.lock().unwrap().keys().filter_map(|k| k.strip_prefix(&prefixo).map(|r| r.split('/').next().unwrap_or(r).to_string())).collect();
        nomes.dedup();
        Ok(nomes)
    }
    fn baixar(&self, caminho: &str) -> R<Option<Vec<u8>>> {
        Ok(self.arquivos.lock().unwrap().get(caminho).cloned())
    }
    fn gravar(&self, caminho: &str, bytes: &[u8]) -> R<()> {
        let mut a = self.arquivos.lock().unwrap();
        if a.contains_key(caminho) {
            return Err(format!("o GitHub respondeu 422 ({caminho} já existe)"));
        }
        a.insert(caminho.to_string(), bytes.to_vec());
        Ok(())
    }
    fn conferir(&self) -> R<()> {
        Ok(())
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn memoria_lista_pastas_e_arquivos() {
        let m = Memoria::default();
        m.gravar("eventos/pc-a/000001.bin", b"x").unwrap();
        m.gravar("eventos/pc-a/000002.bin", b"y").unwrap();
        m.gravar("eventos/cel-b/000001.bin", b"z").unwrap();
        let mut pastas = m.listar("eventos").unwrap();
        pastas.sort();
        assert_eq!(pastas, ["cel-b", "pc-a"]);
        assert_eq!(m.listar("eventos/pc-a").unwrap(), ["000001.bin", "000002.bin"]);
        assert_eq!(m.listar("nada").unwrap(), Vec::<String>::new());
        assert!(m.gravar("eventos/pc-a/000001.bin", b"de novo").is_err());
        assert_eq!(m.baixar("eventos/cel-b/000001.bin").unwrap(), Some(b"z".to_vec()));
    }
}
