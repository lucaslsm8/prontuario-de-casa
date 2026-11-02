mod aparelho;
mod backup;
mod banco;
#[cfg(target_os = "android")]
mod cofre_android;
mod cripto;
mod epoca;
mod familia;
mod lembretes;
mod notificacao;
mod pacote;
#[cfg(target_os = "android")]
mod rede_android;
mod rede_casa;
mod remoto;
mod sincronia;

use banco::Banco;
use remoto::Remoto;
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
    /// Uma sincronização por vez: quem chega com outra em andamento devolve 0 e tenta na próxima rodada.
    sync: tauri::async_runtime::Mutex<()>,
}

type R<T> = Result<T, String>;

/// Chave do banco deste aparelho. Android: CofrePlugin (AndroidKeyStore), que cria a chave se faltar.
/// Outros: `cripto::chave_do_aparelho` (cofre do sistema no Windows/macOS, arquivo no Linux).
fn chave_para<Rt: tauri::Runtime>(app: &tauri::AppHandle<Rt>, servico: &str, dir: &Path, novo: bool) -> R<[u8; 32]> {
    #[cfg(target_os = "android")]
    {
        let _ = (servico, dir, novo);
        cofre_android::chave(app)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        cripto::chave_do_aparelho(servico, dir, novo).map_err(|e| e.to_string())
    }
}

fn abrir_banco<Rt: tauri::Runtime>(app: &tauri::AppHandle<Rt>, servico: &str, dir: &Path) -> R<Banco> {
    let caminho = dir.join(ARQUIVO_BANCO);
    let novo = !caminho.exists();
    let chave = chave_para(app, servico, dir, novo)?;
    Banco::abrir(&caminho, &chave)
}

fn com_banco<T>(st: &State<Estado>, f: impl FnOnce(&mut Banco) -> R<T>) -> R<T> {
    let mut g = st.banco.lock().map_err(|_| "banco ocupado")?;
    match g.as_mut() {
        Some(b) => f(b),
        None => Err(st.erro.lock().ok().and_then(|e| e.clone()).unwrap_or_else(|| "banco indisponível".into())),
    }
}

// ── Família e sincronização ─────────────────────────────────────────────────
// A rede roda em spawn_blocking, fora do lock do banco: o app continua gravando enquanto sincroniza.

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InfoFamilia {
    familia_id: String,
    repo: String,
    /// Época da chave da família (sobe a cada aparelho removido).
    epoca: u32,
    /// Este aparelho foi removido da família: não sincroniza mais (os dados daqui ficam).
    removido: bool,
}

fn info_de(f: &familia::Familia, removido: bool) -> InfoFamilia {
    InfoFamilia { familia_id: f.familia_id.clone(), repo: f.repo.clone(), epoca: f.epoca, removido }
}

// Chaves do kv por família: chaves das épocas anteriores, a marca de removido (época em que saiu) e a troca de chave em andamento.
fn kv_antigas(fid: &str) -> String {
    format!("chaves_antigas:{fid}")
}
fn kv_removido(fid: &str) -> String {
    format!("removido:{fid}")
}
fn kv_rotacao(fid: &str) -> String {
    format!("rotacao:{fid}")
}
/// Entrou com convite e ainda não completou um recebimento: sem selo na época nova = convite velho, não removido.
fn kv_recem(fid: &str) -> String {
    format!("convite:{fid}")
}

fn esta_removido(b: &Banco, fid: &str) -> R<bool> {
    Ok(ler_kv::<Option<u32>>(b, &kv_removido(fid))?.is_some())
}

fn ler_familia(b: &Banco) -> R<Option<familia::Familia>> {
    match b.kv_get("familia")? {
        Some(v) if !v.is_null() => serde_json::from_value(v).map(Some).map_err(|e| e.to_string()),
        _ => Ok(None),
    }
}

fn exigir_familia(st: &State<Estado>) -> R<familia::Familia> {
    com_banco(st, |b| ler_familia(b))?.ok_or_else(|| "este aparelho não está numa família".into())
}

async fn rede<T: Send + 'static>(f: impl FnOnce() -> R<T> + Send + 'static) -> R<T> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|_| "falha na sincronização".to_string())?
}

fn guardar_familia(st: &State<Estado>, f: &familia::Familia) -> R<()> {
    com_banco(st, |b| b.kv_set("familia", &serde_json::to_value(f).map_err(|e| e.to_string())?))
}

#[tauri::command]
async fn familia_info(st: State<'_, Estado>) -> R<Option<InfoFamilia>> {
    com_banco(&st, |b| match ler_familia(b)? {
        Some(f) => Ok(Some(info_de(&f, esta_removido(b, &f.familia_id)?))),
        None => Ok(None),
    })
}

#[tauri::command]
async fn familia_criar(st: State<'_, Estado>, repo: String, token: String) -> R<InfoFamilia> {
    if com_banco(&st, |b| ler_familia(b))?.is_some() {
        return Err("este aparelho já está numa família; saia dela antes de criar outra".into());
    }
    let repo = repo.trim().trim_start_matches("https://github.com/").trim_end_matches('/').to_string();
    if !familia::repo_valido(&repo) {
        return Err("use o formato dono/nome do repositório (ex.: lucas/prontuario-sync)".into());
    }
    let f = familia::Familia::nova(&repo, &token);
    let g = f.clone();
    rede(move || {
        let r = remoto::GitHub::new(&g.repo, &g.token);
        r.conferir()?;
        familia::conferir_familia_json(&r, &g.familia_id, true)
    })
    .await?;
    guardar_familia(&st, &f)?;
    Ok(info_de(&f, false))
}

fn agora_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

#[tauri::command]
async fn familia_entrar(st: State<'_, Estado>, convite: String) -> R<InfoFamilia> {
    let (f, antigas_convite) = familia::ler_convite(&convite, agora_ms())?;
    if let Some(atual) = com_banco(&st, |b| ler_familia(b))? {
        if atual.familia_id != f.familia_id {
            return Err("este aparelho já está numa família; saia dela antes de entrar em outra".into());
        }
    }
    let g = f.clone();
    rede(move || {
        let r = remoto::GitHub::new(&g.repo, &g.token);
        r.conferir()?;
        familia::conferir_familia_json(&r, &g.familia_id, false)
    })
    .await?;
    // Mesma família de novo (ex.: depois de ser removido): junta as chaves antigas e fica com a época mais nova.
    // A marca de removido sai; se o convite for de antes da remoção, a próxima sincronização marca de novo.
    let f = com_banco(&st, |b| {
        let mut antigas: familia::Antigas = ler_kv(b, &kv_antigas(&f.familia_id))?;
        antigas.extend(antigas_convite);
        let mut fica = f;
        if let Some(atual) = ler_familia(b)?.filter(|a| a.familia_id == fica.familia_id) {
            let (velha, nova) = if atual.epoca > fica.epoca { (fica, atual) } else { (atual, fica) };
            if velha.epoca < nova.epoca {
                antigas.insert(velha.epoca, velha.chave);
            }
            fica = nova;
        }
        antigas.retain(|e, _| *e < fica.epoca);
        b.kv_set(&kv_antigas(&fica.familia_id), &serde_json::to_value(&antigas).map_err(|e| e.to_string())?)?;
        b.kv_set(&kv_removido(&fica.familia_id), &Value::Null)?;
        b.kv_set(&kv_recem(&fica.familia_id), &json!(fica.epoca))?;
        Ok(fica)
    })?;
    guardar_familia(&st, &f)?;
    Ok(info_de(&f, false))
}

#[tauri::command]
async fn familia_sair(st: State<'_, Estado>) -> R<()> {
    // O estado de sincronia fica nas chaves por família: entrar de novo na mesma família retoma de onde parou.
    com_banco(&st, |b| b.kv_set("familia", &Value::Null))
}

#[tauri::command]
async fn familia_convite(st: State<'_, Estado>, aparelho: String) -> R<String> {
    // Antes, segue as trocas de chave: o convite sai na época mais nova (senão quem entra fica sem selo).
    // Sem rede, segue com a época que tem (quem entrar e achar uma época nova ouve "peça um convite novo").
    {
        let _vez = st.sync.lock().await;
        if let Err(e) = atualizar_epoca(&st, &aparelho, false).await {
            if e == epoca::REMOVIDO {
                return Err(e);
            }
        }
    }
    // O convite vale por 10 minutos e leva as chaves das épocas anteriores (quem entra lê o histórico todo).
    let f = exigir_familia(&st)?;
    let antigas: familia::Antigas = com_banco(&st, |b| {
        if esta_removido(b, &f.familia_id)? {
            return Err(epoca::REMOVIDO.into());
        }
        ler_kv(b, &kv_antigas(&f.familia_id))
    })?;
    Ok(familia::convite(&f, &antigas, Some(agora_ms() + 10 * 60 * 1000)))
}

fn ler_kv<T: serde::de::DeserializeOwned + Default>(b: &Banco, chave: &str) -> R<T> {
    Ok(b.kv_get(chave)?.and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorSync {
    /// Id do último evento que subiu (null: nada ainda, ou cursor do formato antigo → o front manda tudo).
    ultimo_id: Option<String>,
    /// Aparelhos da família já lidos: os eventos deles não sobem daqui.
    recebidos: Vec<String>,
}

#[tauri::command]
async fn sync_cursor(st: State<'_, Estado>) -> R<CursorSync> {
    let f = exigir_familia(&st)?;
    com_banco(&st, |b| {
        let p: sincronia::Pendencia = ler_kv(b, &format!("sync_envio:{}", f.familia_id))?;
        let lidos = ler_lidos(b, &f.familia_id)?;
        let vistos: std::collections::BTreeSet<String> = ler_kv(b, &format!("sync_vistos:{}", f.familia_id))?;
        Ok(CursorSync { ultimo_id: p.ultimo_id, recebidos: sincronia::recebidos(&lidos, &vistos) })
    })
}

fn ler_lidos(b: &Banco, fid: &str) -> R<sincronia::Lidos> {
    Ok(sincronia::Lidos { zero: ler_kv(b, &format!("sync_lidos:{fid}"))?, epocas: ler_kv(b, &format!("sync_lidos_epocas:{fid}"))? })
}

/// Grava só o cursor da época que mudou (a 0 continua no formato de antes).
fn gravar_lidos(b: &Banco, fid: &str, l: &sincronia::Lidos, epoca: u32) -> R<()> {
    let (chave, valor) = if epoca == 0 { (format!("sync_lidos:{fid}"), serde_json::to_value(&l.zero)) } else { (format!("sync_lidos_epocas:{fid}"), serde_json::to_value(&l.epocas)) };
    b.kv_set(&chave, &valor.map_err(|e| e.to_string())?)
}

/// Antes de enviar ou receber: segue as trocas de chave da família (`epoca::atualizar`) e grava a época nova.
/// Removido = erro REMOVIDO, e a marca fica no kv: daí em diante nada sobe nem desce, sem rede, até
/// `reverificar` (botão "Verificar de novo"), que confere no remoto de novo e tira a marca se não for mais o caso.
/// Recém-chegado por convite (ainda sem um recebimento completo) sem selo na época nova: CONVITE_ANTIGO, sem marca.
async fn atualizar_epoca(st: &State<'_, Estado>, aparelho: &str, reverificar: bool) -> R<familia::Familia> {
    let (f, antigas, privada, removido, recem) = com_banco(st, |b| {
        let f = ler_familia(b)?.ok_or("este aparelho não está numa família")?;
        let removido = esta_removido(b, &f.familia_id)?;
        if removido && !reverificar {
            return Err(epoca::REMOVIDO.to_string());
        }
        let antigas: familia::Antigas = ler_kv(b, &kv_antigas(&f.familia_id))?;
        let recem = ler_kv::<Option<u32>>(b, &kv_recem(&f.familia_id))?.is_some();
        Ok((f, antigas, aparelho::segredo(b)?.to_bytes(), removido, recem))
    })?;
    let (antes, ap) = (f.epoca, aparelho.to_string());
    let (f, antigas, situacao) = rede(move || {
        let (mut f, mut antigas) = (f, antigas);
        let s = epoca::atualizar(&remoto::GitHub::new(&f.repo, &f.token), &mut f, &mut antigas, &ap, &privada)?;
        Ok((f, antigas, s))
    })
    .await?;
    if let epoca::Situacao::Removido(_) = situacao {
        let (erro, marcar) = epoca::sem_selo(recem);
        if !marcar {
            return Err(erro.into());
        }
    }
    com_banco(st, |b| {
        // Só grava se a família no kv ainda é a mesma, na época de antes (não saiu nem entrou de novo no meio).
        if !ler_familia(b)?.is_some_and(|a| a.familia_id == f.familia_id && a.epoca == antes) {
            return Err("a família mudou neste aparelho durante a sincronização; tente de novo".to_string());
        }
        match situacao {
            epoca::Situacao::Igual => {}
            epoca::Situacao::Avancou => {
                // As chaves antigas primeiro: se cair entre as duas gravações, nenhuma chave se perde.
                b.kv_set(&kv_antigas(&f.familia_id), &serde_json::to_value(&antigas).map_err(|e| e.to_string())?)?;
                b.kv_set("familia", &serde_json::to_value(&f).map_err(|e| e.to_string())?)?;
                b.kv_set(&kv_recem(&f.familia_id), &Value::Null)?;
            }
            epoca::Situacao::Removido(t) => {
                b.kv_set(&kv_removido(&f.familia_id), &json!(t))?;
                return Err(epoca::REMOVIDO.to_string());
            }
        }
        if removido {
            b.kv_set(&kv_removido(&f.familia_id), &Value::Null)?;
        }
        Ok(())
    })?;
    Ok(f)
}

/// Sobe o recorte que o front montou (os eventos depois de `ultimoId`); devolve quantos eventos subiram.
/// Antes, adota uma chave nova da família se houver: nada sobe com a chave de uma época que já passou.
#[tauri::command]
async fn sync_enviar(st: State<'_, Estado>, aparelho: String, eventos: Vec<Value>) -> R<usize> {
    let Ok(_vez) = st.sync.try_lock() else { return Ok(0) };
    if eventos.is_empty() {
        return Ok(0);
    }
    let f = atualizar_epoca(&st, &aparelho, false).await?;
    let chave_envio = format!("sync_envio:{}", f.familia_id);
    let p: sincronia::Pendencia = com_banco(&st, |b| ler_kv(b, &chave_envio))?;
    let (prox, epoca) = (p.proximo_n(f.epoca), f.epoca);
    let (ultimo, enviados, ultimo_id) = rede(move || {
        let r = remoto::GitHub::new(&f.repo, &f.token);
        sincronia::enviar(&r, &f, &aparelho, &eventos, prox)
    })
    .await?;
    // Avançou o número (pacote enviado ou número já ocupado no remoto): grava, mantendo o último id se nada subiu.
    if ultimo > 0 {
        let nova = sincronia::Pendencia { n: ultimo, ultimo_id: ultimo_id.or(p.ultimo_id), epoca };
        com_banco(&st, |b| b.kv_set(&chave_envio, &serde_json::to_value(nova).map_err(|e| e.to_string())?))?;
    }
    Ok(enviados)
}

#[tauri::command]
async fn sync_receber(st: State<'_, Estado>, aparelho: String) -> R<usize> {
    let Ok(_vez) = st.sync.try_lock() else { return Ok(0) };
    let f = atualizar_epoca(&st, &aparelho, false).await?;
    let fid = f.familia_id.clone();
    let (mut lidos, chaves) = com_banco(&st, |b| Ok((ler_lidos(b, &fid)?, epoca::chaves(&f, &ler_kv(b, &kv_antigas(&fid))?)?)))?;
    // Aparelhos vistos em eventos aceitos (inclusive de fora da família): os eventos deles não sobem daqui de novo.
    let chave_vistos = format!("sync_vistos:{}", f.familia_id);
    let mut vistos: std::collections::BTreeSet<String> = com_banco(&st, |b| ler_kv(b, &chave_vistos))?;
    let (f2, ap) = (f.clone(), aparelho.clone());
    let donos = rede(move || sincronia::donos(&remoto::GitHub::new(&f2.repo, &f2.token), &ap)).await?;
    let mut entraram = 0;
    // Cada (aparelho, época) é uma sequência própria: lê todas as épocas cuja chave este aparelho tem.
    let sequencias: Vec<(String, u32, [u8; 32])> = donos.iter().flat_map(|d| chaves.iter().map(|(e, k)| (d.clone(), *e, *k))).collect();
    for (dono, epoca, chave) in sequencias {
        // Sonda n = lidos + 1, + 2, … até o primeiro ausente (só a sequência sem buracos).
        let mut n = lidos.ultimo(&dono, epoca) + 1;
        loop {
            let (g, d) = (f.clone(), dono.clone());
            // Erro de rede: aborta e tenta no próximo ciclo. Só o que não decifra é pulado.
            let Some(baixado) = rede(move || sincronia::baixar_proximo(&remoto::GitHub::new(&g.repo, &g.token), &g.familia_id, &chave, epoca, &d, n)).await? else { break };
            let evs = match baixado {
                sincronia::Baixado::Eventos(evs) => evs,
                sincronia::Baixado::Ilegivel => vec![],
            };
            entraram += com_banco(&st, |b| {
                let mut c = 0;
                let antes = vistos.len();
                for ev in sincronia::aceitaveis(&evs, &aparelho) {
                    if b.gravar_novo(ev)? {
                        c += 1;
                    }
                    if let Some(de) = ev.get("aparelho").and_then(Value::as_str) {
                        vistos.insert(de.to_string());
                    }
                }
                if vistos.len() != antes {
                    b.kv_set(&chave_vistos, &serde_json::to_value(&vistos).map_err(|e| e.to_string())?)?;
                }
                Ok(c)
            })?;
            lidos.marcar(&dono, epoca, n);
            com_banco(&st, |b| gravar_lidos(b, &fid, &lidos, epoca))?;
            n += 1;
        }
    }
    // Um recebimento completo: daqui em diante, ficar sem selo numa época nova é "removido", não "convite velho".
    com_banco(&st, |b| b.kv_set(&kv_recem(&fid), &Value::Null))?;
    Ok(entraram)
}

/// "Verificar de novo": confere no remoto se este aparelho ainda está fora da família (tira a marca se não estiver).
#[tauri::command]
async fn familia_verificar(st: State<'_, Estado>, aparelho: String) -> R<InfoFamilia> {
    let _vez = st.sync.lock().await;
    let f = atualizar_epoca(&st, &aparelho, true).await?;
    Ok(info_de(&f, false))
}

/// "Trocar token": token novo do GitHub só neste aparelho (o fine-grained vence). Confere antes de guardar; a chave
/// da família não muda.
#[tauri::command]
async fn familia_trocar_token(st: State<'_, Estado>, token: String) -> R<InfoFamilia> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err("cole o token novo".into());
    }
    let _vez = st.sync.lock().await;
    let f = exigir_familia(&st)?;
    let (repo, t) = (f.repo.clone(), token.clone());
    rede(move || remoto::GitHub::new(&repo, &t).conferir()).await?;
    com_banco(&st, |b| {
        let mut atual = ler_familia(b)?.filter(|a| a.familia_id == f.familia_id).ok_or("a família mudou neste aparelho; tente de novo")?;
        atual.token = token;
        b.kv_set("familia", &serde_json::to_value(&atual).map_err(|e| e.to_string())?)?;
        Ok(info_de(&atual, esta_removido(b, &atual.familia_id)?))
    })
}

#[derive(serde::Deserialize)]
struct Destinatario {
    id: String,
    /// Chave pública X25519 (hex), a do evento `aparelho`.
    chave: String,
}

/// "Remover aparelho": troca a chave da família (época nova) sem o `removido`. A chave nova vai selada para cada
/// um dos `destinatarios` (os aparelhos que ficam e têm chave pública) e para este, com o `token` novo se veio.
/// Só passa a usar a chave nova depois que todos os arquivos e o marco subiram. Caiu no meio: o pedido fica no kv e
/// tentar de novo grava os mesmos bytes. O front emite o evento `removerAparelho` quando isto devolve Ok.
#[tauri::command]
async fn familia_remover_aparelho(st: State<'_, Estado>, aparelho: String, removido: String, destinatarios: Vec<Destinatario>, token: Option<String>) -> R<InfoFamilia> {
    if removido == aparelho {
        return Err("para tirar este aparelho, use \"Sair da família\"".into());
    }
    if !epoca::id_valido(&removido) || !epoca::id_valido(&aparelho) {
        return Err("aparelho inválido".into());
    }
    // Espera a sincronização em andamento (não pode trocar a chave no meio de um envio).
    let _vez = st.sync.lock().await;
    let token = token.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
    let f = atualizar_epoca(&st, &aparelho, false).await?;
    let mut dest: std::collections::BTreeMap<String, String> = destinatarios.into_iter().filter(|d| d.id != removido && d.id != aparelho).map(|d| (d.id, d.chave)).collect();
    dest.insert(aparelho.clone(), com_banco(&st, |b| aparelho::chave_publica(b))?);
    let chave_rot = kv_rotacao(&f.familia_id);
    let guardada: Option<epoca::Rotacao> = com_banco(&st, |b| ler_kv(b, &chave_rot))?;
    let r = match guardada.filter(|r| r.serve_para(f.epoca, &removido, &token, &dest)) {
        Some(r) => r,
        None => {
            let (g, rem, tk) = (f.clone(), removido.clone(), token.clone());
            let r = rede(move || {
                if let Some(t) = &tk {
                    remoto::GitHub::new(&g.repo, t).conferir().map_err(|e| format!("o token novo não funciona: {}", e.trim_start_matches("TOKEN:").trim()))?;
                }
                epoca::preparar(&remoto::GitHub::new(&g.repo, &g.token), &g, &rem, dest, tk)
            })
            .await?;
            // Guarda antes de subir qualquer arquivo: tentar de novo usa a mesma chave e os mesmos bytes.
            com_banco(&st, |b| b.kv_set(&chave_rot, &serde_json::to_value(&r).map_err(|e| e.to_string())?))?;
            r
        }
    };
    let (g, r2) = (f.clone(), r.clone());
    if let Err(e) = rede(move || epoca::publicar(&remoto::GitHub::new(&g.repo, &g.token), &r2)).await {
        if let Some(msg) = e.strip_prefix(epoca::CONFLITO) {
            // Outra troca ganhou: esta nunca vai valer. A próxima tentativa parte da época nova.
            com_banco(&st, |b| b.kv_set(&chave_rot, &Value::Null))?;
            return Err(msg.trim().to_string());
        }
        return Err(e);
    }
    // O marco é nosso: adota a chave nova pelo próprio arquivo selado, como os outros aparelhos.
    let f = atualizar_epoca(&st, &aparelho, false).await?;
    if f.epoca < r.epoca {
        return Err("a troca de chave não terminou; tente de novo".into());
    }
    com_banco(&st, |b| b.kv_set(&chave_rot, &Value::Null))?;
    Ok(info_de(&f, false))
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
        // Num aparelho da família, o log é a união de todos: restaurar só acrescenta o que falta.
        if ler_familia(b)?.is_some() {
            b.mesclar(&evs)?;
            return b.eventos();
        }
        b.substituir(&evs)?;
        Ok(evs)
    })
}

// ── Redes de casa (abrir sem senha) ─────────────────────────────────────────
// Por aparelho, no kv cifrado `redes_casa`; não sincroniza. Lista vazia = desligado.

fn ler_redes(b: &Banco) -> R<Vec<rede_casa::Rede>> {
    Ok(b.kv_get(rede_casa::CHAVE_KV)?.and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default())
}

fn gravar_redes(b: &Banco, lista: &[rede_casa::Rede]) -> R<()> {
    b.kv_set(rede_casa::CHAVE_KV, &serde_json::to_value(lista).map_err(|e| e.to_string())?)
}

/// Rede atual ({ id, nome }) ou null se não der para identificar. `pedir` (só Android):
/// pede a permissão de localização, usado no botão "Esta é a rede de casa".
#[tauri::command]
async fn rede_atual(app: tauri::AppHandle, pedir: Option<bool>) -> R<Option<rede_casa::Rede>> {
    #[cfg(target_os = "android")]
    {
        Ok(rede_android::atual(&app, pedir.unwrap_or(false)).await)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, pedir);
        tauri::async_runtime::spawn_blocking(rede_casa::rede_atual_desktop).await.map_err(|_| "falha ao ler a rede".to_string())
    }
}

/// Chave pública X25519 (hex) deste aparelho; cria o par na primeira chamada.
#[tauri::command]
async fn chave_publica_aparelho(st: State<'_, Estado>) -> R<String> {
    com_banco(&st, |b| aparelho::chave_publica(b))
}

#[tauri::command]
async fn redes_casa(st: State<'_, Estado>) -> R<Vec<rede_casa::Rede>> {
    com_banco(&st, |b| ler_redes(b))
}

#[tauri::command]
async fn rede_casa_adicionar(st: State<'_, Estado>, id: String, nome: String) -> R<Vec<rede_casa::Rede>> {
    if !rede_casa::id_valido(&id) {
        return Err("rede inválida".into());
    }
    let nome: String = nome.trim().chars().take(60).collect();
    com_banco(&st, |b| {
        let lista = rede_casa::adicionar(ler_redes(b)?, rede_casa::Rede { id, nome });
        gravar_redes(b, &lista)?;
        Ok(lista)
    })
}

#[tauri::command]
async fn rede_casa_remover(st: State<'_, Estado>, id: String) -> R<Vec<rede_casa::Rede>> {
    com_banco(&st, |b| {
        let lista = rede_casa::remover(ler_redes(b)?, &id);
        gravar_redes(b, &lista)?;
        Ok(lista)
    })
}

// ── Apagar tudo ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn apagar_tudo(app: tauri::AppHandle, st: State<'_, Estado>) -> R<()> {
    let mut g = st.banco.lock().map_err(|_| "banco ocupado")?;
    *g = None; // fecha a conexão antes de apagar os arquivos
    for sufixo in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(st.dir.join(format!("{ARQUIVO_BANCO}{sufixo}")));
    }
    #[cfg(target_os = "android")]
    cofre_android::apagar(&app);
    #[cfg(not(target_os = "android"))]
    cripto::apagar_chave(&st.servico, &st.dir);
    *g = Some(abrir_banco(&app, &st.servico, &st.dir)?);
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
    // Android: a chave do banco fica no AndroidKeyStore (CofrePlugin.kt).
    #[cfg(target_os = "android")]
    let builder = builder.plugin(cofre_android::init());
    // Android: BSSID do Wi-Fi para a rede de casa (RedePlugin.kt).
    #[cfg(target_os = "android")]
    let builder = builder.plugin(rede_android::init());
    // Celular: abrir com biometria.
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_biometric::init());
    // Celular: ler o QR do convite da família.
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_barcode_scanner::init());
    builder
        .setup(|app| {
            let servico = app.config().identifier.clone();
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let docs = app.path().document_dir().unwrap_or_else(|_| dir.clone());
            let pasta_padrao_backup = docs.join("Arquivo da família");
            let (banco, erro) = match abrir_banco(app.handle(), &servico, &dir) {
                Ok(b) => (Some(b), None),
                Err(e) => (None, Some(e)),
            };
            app.manage(Estado { servico, dir, pasta_padrao_backup, banco: Mutex::new(banco), erro: Mutex::new(erro), sync: Default::default() });
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
            baixar_agenda,
            familia_info,
            familia_criar,
            familia_entrar,
            familia_sair,
            familia_convite,
            familia_remover_aparelho,
            familia_verificar,
            familia_trocar_token,
            sync_cursor,
            sync_enviar,
            sync_receber,
            rede_atual,
            redes_casa,
            rede_casa_adicionar,
            rede_casa_remover,
            chave_publica_aparelho
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Prontuário de Casa");
}
