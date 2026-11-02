//! Sincronização direta pelo Wi-Fi entre os aparelhos da família.
//!
//! - Descoberta: mDNS `_prontuario._tcp.local.`; o anúncio leva só `f` (hash da família, 16 hex) e `a` (aparelhoId).
//! - Canal: TCP + Noise `NNpsk0_25519_ChaChaPoly_SHA256`, PSK = HKDF-SHA256(chave da família da época atual,
//!   rótulo "prontuario-lan"). Quem não tem a chave (outra família, época velha) falha no handshake: a conexão cai em silêncio.
//! - Troca, em turnos (nunca os dois escrevendo ao mesmo tempo): quem liga manda os ids que tem; quem atende manda os
//!   dele e os eventos que faltam ao outro; quem ligou manda os que faltam ao que atendeu. Eventos em lotes de até
//!   200 ou ~1 MB (`pacote::primeira_fatia`); cada mensagem vai em quadros Noise de até 64 KB, com prazo em cada leitura.
//! - Quem recebe passa pelas mesmas regras do GitHub (`sincronia::aceitaveis`) e grava com `gravar_novo`.
//!
//! Nada aqui derruba o app: erros de rede, de handshake ou de formato só encerram aquela conexão.

use crate::banco::Banco;
use crate::{pacote, sincronia, Estado};
use hkdf::Hkdf;
use mdns_sd::{IfKind, ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeSet, HashMap};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

type R<T> = Result<T, String>;

pub const TIPO: &str = "_prontuario._tcp.local.";
const PADRAO: &str = "Noise_NNpsk0_25519_ChaChaPoly_SHA256";
const PROLOGO: &[u8] = b"prontuario-lan 1";
const ROTULO: &[u8] = b"prontuario-lan";
/// Maior mensagem Noise (e maior quadro no TCP, com prefixo de 2 bytes).
const QUADRO: usize = 65535;
const TAG: usize = 16;
/// Uma mensagem lógica (um lote) pode ter vários quadros; um evento sozinho com um PDF de 10 MB cabe.
pub const MAX_MENSAGEM: usize = 32 * 1024 * 1024;
const IDS_POR_LOTE: usize = 10_000;
/// Lotes por fase: proteção contra um par com defeito que nunca manda `fim`.
const MAX_LOTES: usize = 100_000;
/// Prazo de cada leitura e escrita no TCP.
const PRAZO: Duration = Duration::from_secs(10);
/// Prazo da troca inteira com um par.
const PRAZO_TROCA: Duration = Duration::from_secs(300);
const PRAZO_CONEXAO: Duration = Duration::from_secs(3);
/// Conexões sendo atendidas ao mesmo tempo (o handshake); a troca em si é uma por vez (`Lan::vez`).
const CONEXOES: usize = 4;

/// Evento Tauri: chegou algo pelo Wi-Fi fora de `lan_sincronizar_agora` (outro aparelho ligou, ou achamos um par novo).
pub const EVENTO_CHEGOU: &str = "sync-lan-chegou";

// ── Peças puras (testadas) ──────────────────────────────────────────────────

/// PSK do Noise: HKDF-SHA256 da chave da família da época atual, rótulo "prontuario-lan".
pub fn psk(chave_familia: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    Hkdf::<Sha256>::new(None, chave_familia).expand(ROTULO, &mut out).expect("32 bytes cabem no HKDF");
    out
}

/// O que vai no anúncio mDNS no lugar do id da família: os 8 primeiros bytes do SHA-256, em hex.
pub fn hash_familia(familia_id: &str) -> String {
    Sha256::digest(familia_id.as_bytes())[..8].iter().map(|b| format!("{b:02x}")).collect()
}

async fn com_prazo<T>(f: impl std::future::Future<Output = std::io::Result<T>>) -> R<T> {
    tokio::time::timeout(PRAZO, f).await.map_err(|_| "tempo esgotado".to_string())?.map_err(|e| e.to_string())
}

/// Quadro no TCP: 2 bytes de tamanho (big-endian) + conteúdo (até 65535 bytes).
async fn escrever_quadro<S: AsyncWrite + Unpin>(s: &mut S, q: &[u8]) -> R<()> {
    let n = u16::try_from(q.len()).map_err(|_| "quadro grande demais".to_string())?;
    let mut buf = Vec::with_capacity(2 + q.len());
    buf.extend_from_slice(&n.to_be_bytes());
    buf.extend_from_slice(q);
    com_prazo(s.write_all(&buf)).await
}

async fn ler_quadro<S: AsyncRead + Unpin>(s: &mut S) -> R<Vec<u8>> {
    let mut t = [0u8; 2];
    com_prazo(s.read_exact(&mut t)).await?;
    let mut q = vec![0u8; u16::from_be_bytes(t) as usize];
    com_prazo(s.read_exact(&mut q)).await?;
    Ok(q)
}

fn erro_noise(e: snow::Error) -> String {
    format!("noise: {e}")
}

/// Canal cifrado depois do handshake.
pub struct Canal<S> {
    s: S,
    t: snow::TransportState,
}

impl<S: AsyncRead + AsyncWrite + Unpin> Canal<S> {
    /// Uma mensagem: um quadro com o tamanho (4 bytes) e o conteúdo em quadros de até 64 KB, cada um cifrado.
    pub async fn enviar(&mut self, dados: &[u8]) -> R<()> {
        if dados.len() > MAX_MENSAGEM {
            return Err("mensagem grande demais".into());
        }
        let mut buf = vec![0u8; QUADRO];
        let n = self.t.write_message(&(dados.len() as u32).to_be_bytes(), &mut buf).map_err(erro_noise)?;
        escrever_quadro(&mut self.s, &buf[..n]).await?;
        for parte in dados.chunks(QUADRO - TAG) {
            let n = self.t.write_message(parte, &mut buf).map_err(erro_noise)?;
            escrever_quadro(&mut self.s, &buf[..n]).await?;
        }
        com_prazo(self.s.flush()).await
    }

    pub async fn receber(&mut self) -> R<Vec<u8>> {
        let mut buf = vec![0u8; QUADRO];
        let q = ler_quadro(&mut self.s).await?;
        let n = self.t.read_message(&q, &mut buf).map_err(erro_noise)?;
        let tam: [u8; 4] = buf[..n].try_into().map_err(|_| "cabeçalho inválido".to_string())?;
        let total = u32::from_be_bytes(tam) as usize;
        if total > MAX_MENSAGEM {
            return Err("mensagem grande demais".into());
        }
        let mut out = Vec::with_capacity(total.min(16 * QUADRO));
        while out.len() < total {
            let q = ler_quadro(&mut self.s).await?;
            let n = self.t.read_message(&q, &mut buf).map_err(erro_noise)?;
            if n == 0 || out.len() + n > total {
                return Err("quadro inválido".into());
            }
            out.extend_from_slice(&buf[..n]);
        }
        Ok(out)
    }
}

/// Handshake NNpsk0 (`-> psk, e` / `<- e, ee`). PSK errada: quem atende falha ao ler a primeira mensagem e fecha;
/// quem ligou recebe o fim da conexão.
pub async fn apertar<S: AsyncRead + AsyncWrite + Unpin>(mut s: S, psk: &[u8; 32], iniciador: bool) -> R<Canal<S>> {
    let b = snow::Builder::new(PADRAO.parse().map_err(erro_noise)?).psk(0, psk).map_err(erro_noise)?.prologue(PROLOGO).map_err(erro_noise)?;
    let mut hs = if iniciador { b.build_initiator() } else { b.build_responder() }.map_err(erro_noise)?;
    let mut buf = vec![0u8; QUADRO];
    if iniciador {
        let n = hs.write_message(&[], &mut buf).map_err(erro_noise)?;
        escrever_quadro(&mut s, &buf[..n]).await?;
        com_prazo(s.flush()).await?;
        let q = ler_quadro(&mut s).await?;
        hs.read_message(&q, &mut buf).map_err(erro_noise)?;
    } else {
        let q = ler_quadro(&mut s).await?;
        hs.read_message(&q, &mut buf).map_err(erro_noise)?;
        let n = hs.write_message(&[], &mut buf).map_err(erro_noise)?;
        escrever_quadro(&mut s, &buf[..n]).await?;
        com_prazo(s.flush()).await?;
    }
    Ok(Canal { s, t: hs.into_transport_mode().map_err(erro_noise)? })
}

#[derive(Serialize, Deserialize)]
struct Lote<T> {
    itens: Vec<T>,
    fim: bool,
}

async fn enviar_lote<S: AsyncRead + AsyncWrite + Unpin, T: Serialize>(c: &mut Canal<S>, itens: &[T], fim: bool) -> R<()> {
    #[derive(Serialize)]
    struct Ref<'a, T> {
        itens: &'a [T],
        fim: bool,
    }
    c.enviar(&serde_json::to_vec(&Ref { itens, fim }).map_err(|e| e.to_string())?).await
}

/// Lê lotes até o `fim`.
async fn receber_lotes<S: AsyncRead + AsyncWrite + Unpin, T: DeserializeOwned>(c: &mut Canal<S>) -> R<Vec<T>> {
    let mut out = Vec::new();
    for _ in 0..MAX_LOTES {
        let l: Lote<T> = serde_json::from_slice(&c.receber().await?).map_err(|_| "lote inválido".to_string())?;
        out.extend(l.itens);
        if l.fim {
            return Ok(out);
        }
    }
    Err("lotes demais".into())
}

async fn enviar_ids<S: AsyncRead + AsyncWrite + Unpin>(c: &mut Canal<S>, ids: &[&str]) -> R<()> {
    let partes: Vec<&[&str]> = ids.chunks(IDS_POR_LOTE).collect();
    if partes.is_empty() {
        return enviar_lote::<_, &str>(c, &[], true).await;
    }
    for (i, p) in partes.iter().enumerate() {
        enviar_lote(c, p, i + 1 == partes.len()).await?;
    }
    Ok(())
}

async fn enviar_eventos<S: AsyncRead + AsyncWrite + Unpin>(c: &mut Canal<S>, mut evs: &[Value]) -> R<()> {
    if evs.is_empty() {
        return enviar_lote::<_, Value>(c, &[], true).await;
    }
    while !evs.is_empty() {
        let k = pacote::primeira_fatia(evs);
        enviar_lote(c, &evs[..k], k == evs.len()).await?;
        evs = &evs[k..];
    }
    Ok(())
}

fn id_de(ev: &Value) -> Option<&str> {
    ev.get("id").and_then(Value::as_str)
}

/// A troca depois do handshake. `meus`: o log deste aparelho. Devolve o que chegou do outro (ainda sem filtrar).
pub async fn trocar<S: AsyncRead + AsyncWrite + Unpin>(c: &mut Canal<S>, meus: &[Value], iniciador: bool) -> R<Vec<Value>> {
    let ids: Vec<&str> = meus.iter().filter_map(id_de).collect();
    let faltam = |deles: &BTreeSet<String>| -> Vec<Value> { meus.iter().filter(|e| id_de(e).is_some_and(|i| !deles.contains(i))).cloned().collect() };
    if iniciador {
        enviar_ids(c, &ids).await?;
        let deles: BTreeSet<String> = receber_lotes(c).await?.into_iter().collect();
        let chegaram = receber_lotes(c).await?;
        enviar_eventos(c, &faltam(&deles)).await?;
        Ok(chegaram)
    } else {
        let deles: BTreeSet<String> = receber_lotes(c).await?.into_iter().collect();
        enviar_ids(c, &ids).await?;
        enviar_eventos(c, &faltam(&deles)).await?;
        receber_lotes(c).await
    }
}

/// Grava o que chegou com as regras do GitHub (`aceitaveis`: id e aparelho em texto, aparelho ≠ `eu`).
/// Os aparelhos dos eventos aceitos entram em `vistos` (os eventos deles não sobem daqui para o GitHub).
pub fn guardar(b: &Banco, evs: &[Value], eu: &str, vistos: &mut BTreeSet<String>) -> R<usize> {
    let mut novos = 0;
    for ev in sincronia::aceitaveis(evs, eu) {
        if b.gravar_novo(ev)? {
            novos += 1;
        }
        if let Some(de) = ev.get("aparelho").and_then(Value::as_str) {
            vistos.insert(de.to_string());
        }
    }
    Ok(novos)
}

// ── Serviço (mDNS + servidor TCP) ───────────────────────────────────────────

#[derive(Clone)]
struct Par {
    nome: String,
    enderecos: Vec<SocketAddr>,
}

struct Ativo {
    /// (hash da família, aparelhoId) do anúncio: mudou, reinicia.
    chave: (String, String),
    mdns: ServiceDaemon,
    servidor: tauri::async_runtime::JoinHandle<()>,
    parar: Arc<AtomicBool>,
}

pub struct Lan {
    ativo: Mutex<Option<Ativo>>,
    /// Liga e desliga um de cada vez.
    controle: tokio::sync::Mutex<()>,
    /// Uma troca com um par por vez (ligando ou atendendo).
    vez: tokio::sync::Mutex<()>,
    conexoes: tokio::sync::Semaphore,
    pares: Mutex<HashMap<String, Par>>,
}

impl Default for Lan {
    fn default() -> Self {
        Self { ativo: Mutex::new(None), controle: Default::default(), vez: Default::default(), conexoes: tokio::sync::Semaphore::new(CONEXOES), pares: Mutex::new(HashMap::new()) }
    }
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Resumo {
    /// Pares com quem a troca deu certo.
    pub pares: usize,
    /// Eventos novos que entraram.
    pub chegaram: usize,
}

struct Chave {
    psk: [u8; 32],
    eu: String,
    fid: String,
}

fn com_banco<T>(st: &Estado, f: impl FnOnce(&Banco) -> R<T>) -> R<T> {
    let g = st.banco.lock().map_err(|_| "banco ocupado")?;
    f(g.as_ref().ok_or("banco indisponível")?)
}

/// A chave da família da época atual e o id deste aparelho. Sem família, removido ou sem identidade: erro (nada troca).
fn chave(st: &Estado) -> R<Chave> {
    com_banco(st, |b| {
        let f = crate::ler_familia(b)?.ok_or("sem família")?;
        if crate::esta_removido(b, &f.familia_id)? {
            return Err(crate::epoca::REMOVIDO.into());
        }
        let eu = b.kv_get("identidade")?.and_then(|v| v.get("aparelhoId").and_then(Value::as_str).map(String::from)).ok_or("sem identidade")?;
        if !crate::epoca::id_valido(&eu) {
            return Err("identidade inválida".into());
        }
        Ok(Chave { psk: psk(&f.chave_bytes()?), eu, fid: f.familia_id })
    })
}

/// Grava o que chegou, se a família ainda é a mesma e este aparelho não foi removido no meio da troca.
fn guardar_estado(st: &Estado, ch: &Chave, evs: &[Value]) -> R<usize> {
    com_banco(st, |b| {
        if !crate::ler_familia(b)?.is_some_and(|f| f.familia_id == ch.fid) || crate::esta_removido(b, &ch.fid)? {
            return Err("a família mudou".into());
        }
        let chave_vistos = format!("sync_vistos:{}", ch.fid);
        let mut vistos: BTreeSet<String> = crate::ler_kv(b, &chave_vistos)?;
        let antes = vistos.len();
        let n = guardar(b, evs, &ch.eu, &mut vistos)?;
        if vistos.len() != antes {
            b.kv_set(&chave_vistos, &serde_json::to_value(&vistos).map_err(|e| e.to_string())?)?;
        }
        Ok(n)
    })
}

/// Liga o serviço: servidor TCP numa porta efêmera (todas as interfaces), anúncio e procura por mDNS.
/// Sem família (ou removido, ou sem identidade): desliga e devolve Ok. Já ligado com o mesmo anúncio: nada muda.
pub async fn iniciar(app: &AppHandle) -> R<()> {
    let lan = app.state::<Lan>();
    let _c = lan.controle.lock().await;
    let ch = match chave(&app.state::<Estado>()) {
        Ok(ch) => ch,
        Err(_) => {
            desligar(app).await;
            return Ok(());
        }
    };
    let id = (hash_familia(&ch.fid), ch.eu.clone());
    if lan.ativo.lock().map_err(|_| "lan ocupada")?.as_ref().is_some_and(|a| a.chave == id) {
        return Ok(());
    }
    desligar(app).await;
    let ouvinte = tokio::net::TcpListener::bind(("0.0.0.0", 0)).await.map_err(|e| e.to_string())?;
    let porta = ouvinte.local_addr().map_err(|e| e.to_string())?.port();
    #[cfg(target_os = "android")]
    crate::rede_android::multicast_lock(app, true).await;
    let mdns = match anunciar(&id.0, &id.1, porta) {
        Ok(m) => m,
        Err(e) => {
            #[cfg(target_os = "android")]
            crate::rede_android::multicast_lock(app, false).await;
            return Err(e);
        }
    };
    let eventos = match mdns.browse(TIPO) {
        Ok(rx) => rx,
        Err(e) => {
            let _ = mdns.shutdown();
            #[cfg(target_os = "android")]
            crate::rede_android::multicast_lock(app, false).await;
            return Err(e.to_string());
        }
    };
    let parar = Arc::new(AtomicBool::new(false));
    let (a2, p2, (hash, eu)) = (app.clone(), parar.clone(), id.clone());
    std::thread::spawn(move || procurar(a2, eventos, &hash, &eu, &p2));
    let servidor = tauri::async_runtime::spawn(servir(app.clone(), ouvinte));
    *lan.ativo.lock().map_err(|_| "lan ocupada")? = Some(Ativo { chave: id, mdns, servidor, parar });
    Ok(())
}

fn anunciar(hash: &str, eu: &str, porta: u16) -> R<ServiceDaemon> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
    // Só IPv4: o par se conecta pelo endereço anunciado; IPv6 link-local exige o escopo da interface.
    let _ = mdns.disable_interface(IfKind::IPv6);
    let txt = HashMap::from([("f".to_string(), hash.to_string()), ("a".to_string(), eu.to_string())]);
    let r = ServiceInfo::new(TIPO, eu, &format!("{eu}.local."), "", porta, txt).map_err(|e| e.to_string()).and_then(|i| mdns.register(i.enable_addr_auto()).map_err(|e| e.to_string()));
    if let Err(e) = r {
        let _ = mdns.shutdown();
        return Err(e);
    }
    Ok(mdns)
}

/// Desliga o serviço (app bloqueado, em segundo plano, fora da família).
pub async fn parar(app: &AppHandle) {
    let lan = app.state::<Lan>();
    let _c = lan.controle.lock().await;
    desligar(app).await;
}

async fn desligar(app: &AppHandle) {
    let lan = app.state::<Lan>();
    let ativo = lan.ativo.lock().ok().and_then(|mut a| a.take());
    if let Some(a) = ativo {
        a.parar.store(true, Ordering::Relaxed);
        a.servidor.abort();
        let _ = a.mdns.shutdown();
        #[cfg(target_os = "android")]
        crate::rede_android::multicast_lock(app, false).await;
    }
    if let Ok(mut p) = lan.pares.lock() {
        p.clear();
    };
}

/// Lê os eventos do mDNS: guarda os pares da mesma família e, se o par é novo e o id dele é maior que o nosso,
/// liga para ele (um dos dois liga, para os dois não se ocuparem ao mesmo tempo).
fn procurar(app: AppHandle, rx: mdns_sd::Receiver<ServiceEvent>, hash: &str, eu: &str, parar: &AtomicBool) {
    while !parar.load(Ordering::Relaxed) {
        match rx.recv_timeout(Duration::from_secs(1)) {
            Ok(ServiceEvent::ServiceResolved(s)) => {
                let (Some(f), Some(a)) = (s.get_property_val_str("f"), s.get_property_val_str("a")) else { continue };
                if f != hash || a == eu || !crate::epoca::id_valido(a) {
                    continue;
                }
                let mut enderecos: Vec<SocketAddr> = s.get_addresses_v4().into_iter().map(|ip| SocketAddr::new(ip.into(), s.get_port())).collect();
                // Em ordem: o mesmo par anunciado de novo (renovação do mDNS) não conta como novo.
                enderecos.sort();
                if enderecos.is_empty() {
                    continue;
                }
                let par = Par { nome: s.get_fullname().to_string(), enderecos };
                let lan = app.state::<Lan>();
                let novo = match lan.pares.lock() {
                    Ok(mut p) => p.insert(a.to_string(), par.clone()).is_none_or(|v| v.enderecos != par.enderecos),
                    Err(_) => false,
                };
                if novo && eu < a {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let lan = app.state::<Lan>();
                        let Ok(_vez) = lan.vez.try_lock() else { return };
                        if let Ok(n) = trocar_com(&app, &par).await {
                            let _ = app.emit(EVENTO_CHEGOU, n);
                        }
                    });
                }
            }
            Ok(ServiceEvent::ServiceRemoved(_, nome)) => {
                if let Ok(mut p) = app.state::<Lan>().pares.lock() {
                    p.retain(|_, par| par.nome != nome);
                }
            }
            Ok(_) | Err(mdns_sd::RecvTimeoutError::Timeout) => {}
            Err(_) => break,
        }
    }
}

async fn servir(app: AppHandle, ouvinte: tokio::net::TcpListener) {
    loop {
        let Ok((sock, _)) = ouvinte.accept().await else {
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        };
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let lan = app.state::<Lan>();
            let Ok(_vaga) = lan.conexoes.try_acquire() else { return };
            if let Ok(Ok(n)) = tokio::time::timeout(PRAZO_TROCA, atender(&app, sock)).await {
                let _ = app.emit(EVENTO_CHEGOU, n);
            }
        });
    }
}

/// Outro aparelho ligou: handshake (sem chave certa, cai aqui em silêncio) e a troca, se não houver outra em andamento.
async fn atender(app: &AppHandle, sock: tokio::net::TcpStream) -> R<usize> {
    let st = app.state::<Estado>();
    let ch = chave(&st)?;
    let mut c = apertar(sock, &ch.psk, false).await?;
    let lan = app.state::<Lan>();
    let _vez = lan.vez.try_lock().map_err(|_| "ocupado")?;
    let meus = com_banco(&st, |b| b.eventos())?;
    let evs = trocar(&mut c, &meus, false).await?;
    guardar_estado(&st, &ch, &evs)
}

async fn conectar(enderecos: &[SocketAddr]) -> R<tokio::net::TcpStream> {
    for a in enderecos {
        if let Ok(Ok(s)) = tokio::time::timeout(PRAZO_CONEXAO, tokio::net::TcpStream::connect(a)).await {
            return Ok(s);
        }
    }
    Err("par fora do alcance".into())
}

/// Liga para um par e troca. Quem chama segura `Lan::vez`.
async fn trocar_com(app: &AppHandle, par: &Par) -> R<usize> {
    let st = app.state::<Estado>();
    let ch = chave(&st)?;
    let sock = conectar(&par.enderecos).await?;
    tokio::time::timeout(PRAZO_TROCA, async {
        let mut c = apertar(sock, &ch.psk, true).await?;
        let meus = com_banco(&st, |b| b.eventos())?;
        let evs = trocar(&mut c, &meus, true).await?;
        guardar_estado(&st, &ch, &evs)
    })
    .await
    .map_err(|_| "tempo esgotado".to_string())?
}

/// "Sincronizar agora" (e a rodada de 2 em 2 minutos): troca com cada par conhecido. Outra troca em andamento ou
/// serviço desligado: devolve zeros. Falha com um par não impede os outros.
pub async fn sincronizar_agora(app: &AppHandle) -> Resumo {
    let lan = app.state::<Lan>();
    if !lan.ativo.lock().is_ok_and(|a| a.is_some()) {
        return Resumo::default();
    }
    let Ok(_vez) = lan.vez.try_lock() else { return Resumo::default() };
    let pares: Vec<Par> = lan.pares.lock().map(|p| p.values().cloned().collect()).unwrap_or_default();
    let mut r = Resumo::default();
    for par in pares {
        if let Ok(n) = trocar_com(app, &par).await {
            r.pares += 1;
            r.chegaram += n;
        }
    }
    r
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::cripto::aleatorio;
    use serde_json::json;

    fn banco(dir: &tempfile::TempDir, nome: &str, evs: &[Value]) -> Banco {
        let b = Banco::abrir(&dir.path().join(nome), &aleatorio::<32>()).unwrap();
        for e in evs {
            b.gravar(e).unwrap();
        }
        b
    }

    fn ids(b: &Banco) -> Vec<String> {
        let mut v: Vec<String> = b.eventos().unwrap().iter().map(|e| e["id"].as_str().unwrap().to_string()).collect();
        v.sort();
        v
    }

    async fn par_de_canais(k1: [u8; 32], k2: [u8; 32]) -> (R<Canal<tokio::io::DuplexStream>>, R<Canal<tokio::io::DuplexStream>>) {
        let (a, b) = tokio::io::duplex(4096);
        let (p1, p2) = (psk(&k1), psk(&k2));
        tokio::join!(apertar(a, &p1, true), apertar(b, &p2, false))
    }

    #[test]
    fn psk_e_hash() {
        let k = [7u8; 32];
        assert_eq!(psk(&k), psk(&k));
        assert_ne!(psk(&k), psk(&[8u8; 32]));
        assert_ne!(psk(&k), k);
        let h = hash_familia("fam-123");
        assert_eq!(h.len(), 16);
        assert!(h.bytes().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(h, hash_familia("fam-124"));
    }

    #[tokio::test]
    async fn handshake_com_psk_certa_passa_e_errada_falha() {
        let k = aleatorio::<32>();
        let (a, b) = par_de_canais(k, k).await;
        let (mut a, mut b) = (a.unwrap(), b.unwrap());
        a.enviar(b"oi").await.unwrap();
        assert_eq!(b.receber().await.unwrap(), b"oi");

        // Outra família (ou época velha): os dois lados falham, ninguém lê nada.
        let (a, b) = par_de_canais(k, aleatorio::<32>()).await;
        assert!(a.is_err());
        assert!(b.is_err());
    }

    #[tokio::test]
    async fn mensagem_grande_vai_em_varios_quadros_e_o_limite_vale() {
        let k = aleatorio::<32>();
        let (a, b) = par_de_canais(k, k).await;
        let (mut a, mut b) = (a.unwrap(), b.unwrap());
        let grande: Vec<u8> = (0..300_000u32).map(|i| i as u8).collect();
        let (env, rec) = tokio::join!(a.enviar(&grande), b.receber());
        env.unwrap();
        assert_eq!(rec.unwrap(), grande);
        // Vazia também passa.
        let (env, rec) = tokio::join!(a.enviar(&[]), b.receber());
        env.unwrap();
        assert!(rec.unwrap().is_empty());
        // Acima do limite: nem sai.
        assert!(a.enviar(&vec![0u8; MAX_MENSAGEM + 1]).await.is_err());
    }

    #[tokio::test]
    async fn cabecalho_acima_do_limite_e_recusado() {
        let k = aleatorio::<32>();
        let (a, b) = par_de_canais(k, k).await;
        let (mut a, mut b) = (a.unwrap(), b.unwrap());
        // Um par com defeito anuncia uma mensagem maior que o limite: quem recebe recusa sem alocar.
        let mut buf = vec![0u8; QUADRO];
        let n = a.t.write_message(&((MAX_MENSAGEM as u32) + 1).to_be_bytes(), &mut buf).unwrap();
        escrever_quadro(&mut a.s, &buf[..n]).await.unwrap();
        assert_eq!(b.receber().await.unwrap_err(), "mensagem grande demais");
    }

    #[tokio::test]
    async fn quadro_adulterado_e_recusado() {
        let k = aleatorio::<32>();
        let (a, b) = par_de_canais(k, k).await;
        let (mut a, mut b) = (a.unwrap(), b.unwrap());
        let mut buf = vec![0u8; QUADRO];
        let n = a.t.write_message(&4u32.to_be_bytes(), &mut buf).unwrap();
        buf[0] ^= 1;
        escrever_quadro(&mut a.s, &buf[..n]).await.unwrap();
        assert!(b.receber().await.is_err());
    }

    #[tokio::test]
    async fn troca_junta_os_dois_logs_e_aplica_o_filtro() {
        let dir = tempfile::tempdir().unwrap();
        let comum = json!({"id": "c1", "aparelho": "pc-a", "tipo": "x"});
        let anexo = "A".repeat(1_500_000); // um evento maior que 1 MB vai sozinho, em vários quadros
        let ba = banco(&dir, "a.db", &[
            comum.clone(),
            json!({"id": "a1", "aparelho": "pc-a", "tipo": "x"}),
            json!({"id": "a2", "aparelho": "pc-a", "tipo": "addAnexo", "dados": anexo}),
            // Em nome de quem recebe (cel-b): não entra lá.
            json!({"id": "falso", "aparelho": "cel-b", "tipo": "config"}),
            // Sem aparelho: malformado, não entra.
            json!({"id": "sem", "tipo": "x"}),
        ]);
        let bb = banco(&dir, "b.db", &[comum, json!({"id": "b1", "aparelho": "cel-b", "tipo": "x"}), json!({"id": "c9", "aparelho": "pc-z", "tipo": "x"})]);
        let k = aleatorio::<32>();
        let (ca, cb) = par_de_canais(k, k).await;
        let (mut ca, mut cb) = (ca.unwrap(), cb.unwrap());
        let (ea, eb) = (ba.eventos().unwrap(), bb.eventos().unwrap());
        let (ra, rb) = tokio::join!(trocar(&mut ca, &ea, true), trocar(&mut cb, &eb, false));
        let (ra, rb) = (ra.unwrap(), rb.unwrap());
        // Só vai o que falta ao outro.
        assert_eq!(ra.len(), 2);
        assert_eq!(rb.len(), 4);

        let (mut va, mut vb) = (BTreeSet::new(), BTreeSet::new());
        assert_eq!(guardar(&ba, &ra, "pc-a", &mut va).unwrap(), 2);
        assert_eq!(guardar(&bb, &rb, "cel-b", &mut vb).unwrap(), 2);
        assert_eq!(ids(&ba), ["a1", "a2", "b1", "c1", "c9", "falso", "sem"]);
        assert_eq!(ids(&bb), ["a1", "a2", "b1", "c1", "c9"]);
        assert_eq!(bb.eventos().unwrap().iter().find(|e| e["id"] == "a2").unwrap()["dados"].as_str().unwrap().len(), anexo.len());
        assert_eq!(va, BTreeSet::from(["cel-b".to_string(), "pc-z".to_string()]));
        assert_eq!(vb, BTreeSet::from(["pc-a".to_string()]));

        // De novo: nada a trocar, nada novo.
        let k2 = aleatorio::<32>();
        let (ca, cb) = par_de_canais(k2, k2).await;
        let (mut ca, mut cb) = (ca.unwrap(), cb.unwrap());
        let (ea, eb) = (ba.eventos().unwrap(), bb.eventos().unwrap());
        let (ra, rb) = tokio::join!(trocar(&mut ca, &ea, true), trocar(&mut cb, &eb, false));
        assert!(ra.unwrap().is_empty());
        assert_eq!(rb.unwrap().len(), 2); // "falso" e "sem" seguem faltando lá (o filtro barra de novo)
        assert_eq!(guardar(&bb, &[json!({"id": "falso", "aparelho": "cel-b"}), json!({"id": "sem"})], "cel-b", &mut vb).unwrap(), 0);
    }

    #[tokio::test]
    async fn troca_com_log_vazio() {
        let k = aleatorio::<32>();
        let (ca, cb) = par_de_canais(k, k).await;
        let (mut ca, mut cb) = (ca.unwrap(), cb.unwrap());
        let (ra, rb) = tokio::join!(trocar(&mut ca, &[], true), trocar(&mut cb, &[], false));
        assert!(ra.unwrap().is_empty());
        assert!(rb.unwrap().is_empty());
    }

    #[tokio::test]
    async fn par_que_some_no_meio_nao_trava() {
        let k = aleatorio::<32>();
        let (ca, cb) = par_de_canais(k, k).await;
        let mut ca = ca.unwrap();
        drop(cb);
        assert!(trocar(&mut ca, &[json!({"id": "x", "aparelho": "pc-a"})], true).await.is_err());
    }
}
