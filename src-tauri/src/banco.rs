//! Banco local: SQLite com um log de eventos só de adição. Cada evento e cada
//! valor de configuração é gravado cifrado com a chave do aparelho.

use crate::cripto::Cofre;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::path::Path;

pub struct Banco {
    conn: Connection,
    cofre: Cofre,
}

type R<T> = Result<T, String>;
fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

impl Banco {
    pub fn abrir(caminho: &Path, chave: &[u8; 32]) -> R<Self> {
        let conn = Connection::open(caminho).map_err(e)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             CREATE TABLE IF NOT EXISTS eventos (
               seq   INTEGER PRIMARY KEY AUTOINCREMENT,
               id    TEXT NOT NULL UNIQUE,
               dados BLOB NOT NULL
             );
             CREATE TABLE IF NOT EXISTS kv (
               chave TEXT PRIMARY KEY,
               valor BLOB NOT NULL
             );",
        )
        .map_err(e)?;
        let b = Self { conn, cofre: Cofre::new(chave) };
        b.conferir_chave()?;
        Ok(b)
    }

    /// Grava um marcador cifrado na primeira abertura e confere nas seguintes,
    /// para detectar cedo uma chave errada (ex.: cofre do sistema foi limpo).
    fn conferir_chave(&self) -> R<()> {
        match self.kv_bruto("__marcador")? {
            Some(blob) => self.cofre.decifrar(&blob, b"__marcador").map(|_| ()).map_err(|_| {
                "A chave deste aparelho não abre o banco. Restaure um backup para recuperar os dados.".to_string()
            }),
            None => {
                let blob = self.cofre.cifrar(b"arquivo-da-familia", b"__marcador").map_err(e)?;
                self.conn.execute("INSERT INTO kv (chave, valor) VALUES ('__marcador', ?1)", params![blob]).map_err(e)?;
                Ok(())
            }
        }
    }

    pub fn eventos(&self) -> R<Vec<Value>> {
        let mut st = self.conn.prepare("SELECT id, dados FROM eventos ORDER BY seq").map_err(e)?;
        let linhas = st
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?)))
            .map_err(e)?;
        let mut out = Vec::new();
        for l in linhas {
            let (id, blob) = l.map_err(e)?;
            let claro = self.cofre.decifrar(&blob, id.as_bytes()).map_err(e)?;
            out.push(serde_json::from_slice(&claro).map_err(e)?);
        }
        Ok(out)
    }

    pub fn gravar(&self, ev: &Value) -> R<()> {
        let id = ev.get("id").and_then(Value::as_str).ok_or("evento sem id")?;
        let blob = self.cofre.cifrar(&serde_json::to_vec(ev).map_err(e)?, id.as_bytes()).map_err(e)?;
        // OR IGNORE: o mesmo evento chegando duas vezes (ex.: sincronização) não duplica.
        self.conn.execute("INSERT OR IGNORE INTO eventos (id, dados) VALUES (?1, ?2)", params![id, blob]).map_err(e)?;
        Ok(())
    }

    /// Como `gravar`, mas diz se o evento era novo (sincronização).
    pub fn gravar_novo(&self, ev: &Value) -> R<bool> {
        let id = ev.get("id").and_then(Value::as_str).ok_or("evento sem id")?;
        let blob = self.cofre.cifrar(&serde_json::to_vec(ev).map_err(e)?, id.as_bytes()).map_err(e)?;
        let n = self.conn.execute("INSERT OR IGNORE INTO eventos (id, dados) VALUES (?1, ?2)", params![id, blob]).map_err(e)?;
        Ok(n > 0)
    }

    /// Junta eventos ao log sem apagar nada (restaurar backup num aparelho da família). Devolve quantos eram novos.
    pub fn mesclar(&mut self, evs: &[Value]) -> R<usize> {
        let tx = self.conn.transaction().map_err(e)?;
        let mut novos = 0;
        for ev in evs {
            let id = ev.get("id").and_then(Value::as_str).ok_or("evento sem id")?;
            let blob = self.cofre.cifrar(&serde_json::to_vec(ev).map_err(e)?, id.as_bytes()).map_err(e)?;
            novos += tx.execute("INSERT OR IGNORE INTO eventos (id, dados) VALUES (?1, ?2)", params![id, blob]).map_err(e)?;
        }
        tx.commit().map_err(e)?;
        Ok(novos)
    }

    /// Substitui o log inteiro (restaurar backup). Tudo numa transação.
    pub fn substituir(&mut self, evs: &[Value]) -> R<()> {
        let mut blobs = Vec::with_capacity(evs.len());
        for ev in evs {
            let id = ev.get("id").and_then(Value::as_str).ok_or("evento sem id")?.to_string();
            let blob = self.cofre.cifrar(&serde_json::to_vec(ev).map_err(e)?, id.as_bytes()).map_err(e)?;
            blobs.push((id, blob));
        }
        let tx = self.conn.transaction().map_err(e)?;
        tx.execute("DELETE FROM eventos", []).map_err(e)?;
        for (id, blob) in blobs {
            tx.execute("INSERT OR IGNORE INTO eventos (id, dados) VALUES (?1, ?2)", params![id, blob]).map_err(e)?;
        }
        tx.commit().map_err(e)
    }

    fn kv_bruto(&self, chave: &str) -> R<Option<Vec<u8>>> {
        self.conn
            .query_row("SELECT valor FROM kv WHERE chave = ?1", params![chave], |r| r.get(0))
            .optional()
            .map_err(e)
    }

    pub fn kv_get(&self, chave: &str) -> R<Option<Value>> {
        match self.kv_bruto(chave)? {
            None => Ok(None),
            Some(blob) => {
                let claro = self.cofre.decifrar(&blob, chave.as_bytes()).map_err(e)?;
                Ok(Some(serde_json::from_slice(&claro).map_err(e)?))
            }
        }
    }

    pub fn kv_set(&self, chave: &str, valor: &Value) -> R<()> {
        let blob = self.cofre.cifrar(&serde_json::to_vec(valor).map_err(e)?, chave.as_bytes()).map_err(e)?;
        self.conn
            .execute("INSERT INTO kv (chave, valor) VALUES (?1, ?2) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", params![chave, blob])
            .map_err(e)?;
        Ok(())
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::cripto::aleatorio;
    use serde_json::json;

    #[test]
    fn grava_le_e_nada_fica_em_claro() {
        let dir = tempfile::tempdir().unwrap();
        let arq = dir.path().join("t.db");
        let k = aleatorio::<32>();
        {
            let b = Banco::abrir(&arq, &k).unwrap();
            b.gravar(&json!({"id": "a", "tipo": "addPessoa", "dados": {"nome": "Roberto Carlos Almeida"}})).unwrap();
            b.gravar(&json!({"id": "a", "tipo": "duplicado"})).unwrap();
            b.gravar(&json!({"id": "b", "tipo": "dose"})).unwrap();
            b.kv_set("backup", &json!({"senha": "segredo"})).unwrap();
        }
        let b = Banco::abrir(&arq, &k).unwrap();
        let evs = b.eventos().unwrap();
        assert_eq!(evs.len(), 2);
        assert_eq!(evs[0]["dados"]["nome"], "Roberto Carlos Almeida");
        assert_eq!(b.kv_get("backup").unwrap().unwrap()["senha"], "segredo");
        drop(b);

        // Nenhum dado sensível legível no arquivo do banco (nem no WAL).
        let mut bytes = std::fs::read(&arq).unwrap();
        if let Ok(w) = std::fs::read(dir.path().join("t.db-wal")) {
            bytes.extend(w);
        }
        for termo in [&b"Roberto"[..], b"segredo", b"addPessoa"] {
            assert!(!bytes.windows(termo.len()).any(|w| w == termo), "{:?} apareceu em claro", std::str::from_utf8(termo));
        }
    }

    #[test]
    fn chave_errada_e_detectada() {
        let dir = tempfile::tempdir().unwrap();
        let arq = dir.path().join("t.db");
        drop(Banco::abrir(&arq, &aleatorio::<32>()).unwrap());
        assert!(Banco::abrir(&arq, &aleatorio::<32>()).is_err());
    }

    #[test]
    fn substituir_troca_tudo() {
        let dir = tempfile::tempdir().unwrap();
        let mut b = Banco::abrir(&dir.path().join("t.db"), &aleatorio::<32>()).unwrap();
        b.gravar(&json!({"id": "x"})).unwrap();
        b.substituir(&[json!({"id": "y"}), json!({"id": "z"})]).unwrap();
        let ids: Vec<_> = b.eventos().unwrap().into_iter().map(|v| v["id"].as_str().unwrap().to_string()).collect();
        assert_eq!(ids, ["y", "z"]);
    }

    #[test]
    fn mesclar_so_acrescenta() {
        let dir = tempfile::tempdir().unwrap();
        let mut b = Banco::abrir(&dir.path().join("t.db"), &aleatorio::<32>()).unwrap();
        b.gravar(&json!({"id": "x"})).unwrap();
        assert!(!b.gravar_novo(&json!({"id": "x"})).unwrap());
        assert!(b.gravar_novo(&json!({"id": "y"})).unwrap());
        assert_eq!(b.mesclar(&[json!({"id": "y"}), json!({"id": "z"})]).unwrap(), 1);
        let ids: Vec<_> = b.eventos().unwrap().into_iter().map(|v| v["id"].as_str().unwrap().to_string()).collect();
        assert_eq!(ids, ["x", "y", "z"]);
    }
}
