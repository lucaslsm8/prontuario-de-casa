//! Android: BSSID e SSID do Wi-Fi atual pelo RedePlugin (Kotlin), e o MulticastLock do mDNS. Sem permissão de localização,
//! ou fora do Wi-Fi, volta vazio (ou 02:00:00:00:00:00), que conta como "indisponível".

use crate::rede_casa::{self, Rede};
use serde::Deserialize;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

pub struct RedeAndroid<R: Runtime>(PluginHandle<R>);

#[derive(Deserialize)]
struct Resposta {
    bssid: Option<String>,
    ssid: Option<String>,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("rede")
        .setup(|app, api| {
            let h = api.register_android_plugin("br.familia.arquivosaude", "RedePlugin")?;
            app.manage(RedeAndroid(h));
            Ok(())
        })
        .build()
}

/// `pedir`: pede a permissão de localização se faltar (só ao tocar "Esta é a rede de casa").
pub async fn atual<R: Runtime>(app: &AppHandle<R>, pedir: bool) -> Option<Rede> {
    let h = app.try_state::<RedeAndroid<R>>()?;
    let r: Resposta = h.0.run_mobile_plugin_async("atual", serde_json::json!({ "pedir": pedir })).await.ok()?;
    rede_casa::rede_do_wifi(r.bssid.as_deref()?, r.ssid.as_deref())
}

/// mDNS no Android: sem o `WifiManager.MulticastLock` o sistema descarta os pacotes multicast que chegam.
/// Adquirido enquanto a sincronização pelo Wi-Fi está ligada (app aberto); falha aqui só deixa a descoberta muda.
pub async fn multicast_lock<R: Runtime>(app: &AppHandle<R>, adquirir: bool) {
    if let Some(h) = app.try_state::<RedeAndroid<R>>() {
        let _: Result<serde_json::Value, _> = h.0.run_mobile_plugin_async("multicastLock", serde_json::json!({ "adquirir": adquirir })).await;
    }
}
