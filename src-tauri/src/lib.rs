mod backup;
mod banco;
mod cripto;
mod lembretes;
mod notificacao;
mod pacote;

use banco::Banco;
use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

const ARQUIVO_BANCO: &str = "arquivo.db";

struct Estado {
    servico: String,
    dir: PathBuf,
    pasta_padrao_backup: PathBuf,
    banco: Mutex<Option<Banco>>,
    erro: Mutex<Option<String>>,
}

type R<T> = Result<T, String>;

fn abrir_banco(servico: &str, dir: &Path) -> R<Banco> {
    let caminho = dir.join(ARQUIVO_BANCO);
    let novo = !caminho.exists();
    let chave = cripto::chave_do_aparelho(servico, dir, novo).map_err(|e| e.to_string())?;
    Banco::abrir(&caminho, &chave)
}

fn com_banco<T>(st: &State<Estado>, f: impl FnOnce(&mut Banco) -> R<T>) -> R<T> {
    let mut g = st.banco.lock().map_err(|_| "banco ocupado")?;
    match g.as_mut() {
        Some(b) => f(b),
        None => Err(st.erro.lock().ok().and_then(|e| e.clone()).unwrap_or_else(|| "banco indisponível".into())),
    }
}

// ── Início ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Inicio {
    eventos: Vec<Value>,
    tem_senha: bool,
    backup: InfoBackup,
    erro: Option<String>,
    versao: String,
    /// "Quem sou eu" neste aparelho ({ aparelhoId, pessoaId }), no kv cifrado. Fora do log.
    identidade: Option<Value>,
}

#[tauri::command]
async fn iniciar(app: tauri::AppHandle, st: State<'_, Estado>) -> R<Inicio> {
    let versao = app.package_info().version.to_string();
    let erro = st.erro.lock().ok().and_then(|e| e.clone());
    if let Some(erro) = erro {
        return Ok(Inicio { eventos: vec![], tem_senha: false, backup: InfoBackup::vazio(&st), erro: Some(erro), versao, identidade: None });
    }
    com_banco(&st, |b| {
        Ok(Inicio {
            eventos: b.eventos()?,
            tem_senha: b.kv_get("senha")?.is_some(),
            backup: info_backup(b, &st.pasta_padrao_backup)?,
            erro: None,
            versao,
            identidade: b.kv_get("identidade")?,
        })
    })
}

#[tauri::command]
async fn gravar_evento(st: State<'_, Estado>, evento: Value) -> R<()> {
    com_banco(&st, |b| b.gravar(&evento))
}

#[tauri::command]
async fn definir_identidade(st: State<'_, Estado>, identidade: Value) -> R<()> {
    com_banco(&st, |b| b.kv_set("identidade", &identidade))
}

// ── Senha / PIN de desbloqueio ──────────────────────────────────────────────

#[tauri::command]
async fn definir_senha(st: State<'_, Estado>, senha: String) -> R<()> {
    if senha.chars().count() < 4 {
        return Err("Use pelo menos 4 caracteres.".into());
    }
    let h = cripto::hash_senha(&senha).map_err(|e| e.to_string())?;
    com_banco(&st, |b| b.kv_set("senha", &json!(h)))
}

#[tauri::command]
async fn verificar_senha(st: State<'_, Estado>, senha: String) -> R<bool> {
    com_banco(&st, |b| {
        Ok(match b.kv_get("senha")? {
            Some(Value::String(h)) => cripto::conferir_senha(&senha, &h),
            _ => true, // sem senha definida, não há o que conferir
        })
    })
}

// ── Backup ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InfoBackup {
    pasta: String,
    freq: String,
    tem_senha: bool,
    ultimo: Option<String>,
    arquivo: Option<String>,
    tamanho: Option<u64>,
}

impl InfoBackup {
    fn vazio(st: &Estado) -> Self {
        Self { pasta: st.pasta_padrao_backup.display().to_string(), freq: "semanal".into(), tem_senha: false, ultimo: None, arquivo: None, tamanho: None }
    }
}

fn config_backup(b: &Banco) -> R<Value> {
    Ok(b.kv_get("backup")?.unwrap_or_else(|| json!({})))
}

fn info_backup(b: &Banco, padrao: &Path) -> R<InfoBackup> {
    let c = config_backup(b)?;
    let s = |k: &str| c.get(k).and_then(Value::as_str).map(String::from);
    Ok(InfoBackup {
        pasta: s("pasta").unwrap_or_else(|| padrao.display().to_string()),
        freq: s("freq").unwrap_or_else(|| "semanal".into()),
        tem_senha: s("senha").is_some(),
        ultimo: s("ultimo"),
        arquivo: s("arquivo"),
        tamanho: c.get("tamanho").and_then(Value::as_u64),
    })
}

fn nome_seguro(n: &str) -> String {
    let s: String = n
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' => 'a',
            'é' | 'ê' => 'e',
            'í' => 'i',
            'ó' | 'ô' | 'õ' => 'o',
            'ú' | 'ü' => 'u',
            'ç' => 'c',
            c if c.is_ascii_alphanumeric() => c,
            _ => '-',
        })
        .collect();
    let s = s.trim_matches('-').to_string();
    if s.is_empty() { "familia".into() } else { s }
}

#[tauri::command]
async fn backup_configurar(
    st: State<'_, Estado>,
    senha: Option<String>,
    pasta: Option<String>,
    freq: Option<String>,
    nome: Option<String>,
) -> R<InfoBackup> {
    if let Some(s) = &senha {
        if s.chars().count() < 6 {
            return Err("A senha do backup precisa ter pelo menos 6 caracteres.".into());
        }
    }
    com_banco(&st, |b| {
        let mut c = config_backup(b)?;
        let o = c.as_object_mut().ok_or("configuração inválida")?;
        if let Some(v) = senha { o.insert("senha".into(), json!(v)); }
        if let Some(v) = pasta { o.insert("pasta".into(), json!(v)); }
        if let Some(v) = freq { o.insert("freq".into(), json!(v)); }
        if let Some(v) = nome { o.insert("nome".into(), json!(nome_seguro(&v))); }
        b.kv_set("backup", &c)?;
        info_backup(b, &st.pasta_padrao_backup)
    })
}

fn fazer_backup(b: &Banco, padrao: &Path, versao: &str, automatico: bool) -> R<InfoBackup> {
    let mut c = config_backup(b)?;
    let senha = c.get("senha").and_then(Value::as_str).ok_or("Defina uma senha para o backup primeiro.")?.to_string();
    let pasta = c.get("pasta").and_then(Value::as_str).map(PathBuf::from).unwrap_or_else(|| padrao.to_path_buf());
    let nome = c.get("nome").and_then(Value::as_str).unwrap_or("familia").to_string();
    std::fs::create_dir_all(&pasta).map_err(|e| format!("Não foi possível usar a pasta {}: {e}", pasta.display()))?;

    let bytes = backup::gerar(&b.eventos()?, &senha, versao)?;
    let agora = chrono::Local::now();
    let arquivo = format!("{nome}-{}.fsaude", agora.format("%Y-%m-%d"));
    let destino = pasta.join(&arquivo);
    let tmp = pasta.join(format!(".{arquivo}.tmp"));
    std::fs::write(&tmp, &bytes).map_err(|e| format!("Não foi possível gravar o backup: {e}"))?;
    std::fs::rename(&tmp, &destino).map_err(|e| format!("Não foi possível gravar o backup: {e}"))?;

    if automatico {
        // Guarda os 8 backups automáticos mais recentes desta família.
        if let Ok(rd) = std::fs::read_dir(&pasta) {
            let mut antigos: Vec<_> = rd
                .filter_map(|x| x.ok())
                .map(|x| x.file_name().to_string_lossy().to_string())
                .filter(|n| n.starts_with(&format!("{nome}-")) && n.ends_with(".fsaude"))
                .collect();
            antigos.sort();
            let sobra = antigos.len().saturating_sub(8);
            for n in &antigos[..sobra] {
                let _ = std::fs::remove_file(pasta.join(n));
            }
        }
    }

    let o = c.as_object_mut().ok_or("configuração inválida")?;
    o.insert("ultimo".into(), json!(agora.to_rfc3339()));
    o.insert("arquivo".into(), json!(arquivo));
    o.insert("tamanho".into(), json!(bytes.len()));
    b.kv_set("backup", &c)?;
    info_backup(b, padrao)
}

#[tauri::command]
async fn backup_agora(app: tauri::AppHandle, st: State<'_, Estado>) -> R<InfoBackup> {
    let v = app.package_info().version.to_string();
    com_banco(&st, |b| fazer_backup(b, &st.pasta_padrao_backup, &v, false))
}

/// Chamado ao abrir o app: faz o backup semanal se já passou uma semana.
#[tauri::command]
async fn backup_se_devido(app: tauri::AppHandle, st: State<'_, Estado>) -> R<Option<InfoBackup>> {
    let v = app.package_info().version.to_string();
    com_banco(&st, |b| {
        let i = info_backup(b, &st.pasta_padrao_backup)?;
        if i.freq != "semanal" || !i.tem_senha {
            return Ok(None);
        }
        let devido = match i.ultimo.as_deref().and_then(|u| chrono::DateTime::parse_from_rfc3339(u).ok()) {
            None => true,
            Some(u) => chrono::Local::now().signed_duration_since(u) >= chrono::Duration::days(7),
        };
        if devido { fazer_backup(b, &st.pasta_padrao_backup, &v, true).map(Some) } else { Ok(None) }
    })
}

#[tauri::command]
async fn backup_restaurar(st: State<'_, Estado>, caminho: String, senha: String) -> R<Vec<Value>> {
    let bytes = std::fs::read(&caminho).map_err(|e| format!("Não foi possível ler o arquivo: {e}"))?;
    let evs = backup::abrir(&bytes, &senha)?;
    com_banco(&st, |b| {
        b.substituir(&evs)?;
        Ok(evs)
    })
}

// ── Apagar tudo ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn apagar_tudo(st: State<'_, Estado>) -> R<()> {
    let mut g = st.banco.lock().map_err(|_| "banco ocupado")?;
    *g = None; // fecha a conexão antes de apagar os arquivos
    for sufixo in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(st.dir.join(format!("{ARQUIVO_BANCO}{sufixo}")));
    }
    cripto::apagar_chave(&st.servico, &st.dir);
    *g = Some(abrir_banco(&st.servico, &st.dir)?);
    if let Ok(mut e) = st.erro.lock() {
        *e = None;
    }
    Ok(())
}

// ── Lembretes ───────────────────────────────────────────────────────────────

#[tauri::command]
async fn agendar_lembretes(lista: Vec<lembretes::Lembrete>, ag: State<'_, Arc<lembretes::Agendador>>) -> R<()> {
    ag.substituir(lista);
    Ok(())
}

// ── Exportar anexo ──────────────────────────────────────────────────────────

/// Grava um anexo (base64) no caminho escolhido no diálogo "Salvar".
/// É a única saída de dados em claro, sempre por ação explícita da pessoa.
#[tauri::command]
async fn exportar_arquivo(caminho: String, dados: String) -> R<()> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(dados.as_bytes()).map_err(|_| "arquivo inválido".to_string())?;
    std::fs::write(&caminho, bytes).map_err(|e| format!("não foi possível salvar: {e}"))
}

// ── Agenda do Google (endereço iCal) ───────────────────────────────────────

/// Baixa o .ics do endereço secreto que a pessoa colou. Só https, até 5 MB, 20 s.
/// É a única chamada de rede do app, e só acontece se a pessoa conectou a agenda.
#[tauri::command]
async fn baixar_agenda(url: String) -> R<String> {
    if !url.starts_with("https://") {
        return Err("o endereço precisa começar com https://".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Read;
        let resp = ureq::get(&url)
            .timeout(std::time::Duration::from_secs(20))
            .call()
            .map_err(|e| match e {
                ureq::Error::Status(c, _) => format!("a agenda respondeu {c}; confira o endereço"),
                _ => "sem conexão com a agenda".to_string(),
            })?;
        let mut texto = String::new();
        resp.into_reader().take(5 * 1024 * 1024).read_to_string(&mut texto).map_err(|_| "resposta inválida".to_string())?;
        if !texto.contains("BEGIN:VCALENDAR") {
            return Err("esse endereço não é uma agenda .ics".into());
        }
        Ok(texto)
    })
    .await
    .map_err(|_| "falha ao baixar".to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());
    // Atualizações: o app consulta o latest.json do GitHub Releases e só instala com assinatura válida.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init());
    builder
        .setup(|app| {
            let servico = app.config().identifier.clone();
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let docs = app.path().document_dir().unwrap_or_else(|_| dir.clone());
            let pasta_padrao_backup = docs.join("Arquivo da família");
            let (banco, erro) = match abrir_banco(&servico, &dir) {
                Ok(b) => (Some(b), None),
                Err(e) => (None, Some(e)),
            };
            app.manage(Estado { servico, dir, pasta_padrao_backup, banco: Mutex::new(banco), erro: Mutex::new(erro) });
            notificacao::registrar();
            let ag = lembretes::Agendador::novo();
            app.manage(ag.clone());
            let (handle, ag2) = (app.handle().clone(), ag.clone());
            std::thread::spawn(move || ag.rodar(move |l| notificacao::mostrar(&handle, &ag2, l)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            iniciar,
            gravar_evento,
            definir_identidade,
            definir_senha,
            verificar_senha,
            backup_configurar,
            backup_agora,
            backup_se_devido,
            backup_restaurar,
            apagar_tudo,
            agendar_lembretes,
            exportar_arquivo,
            baixar_agenda
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Prontuário de Casa");
}
