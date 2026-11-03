//! Android: lê o QR do convite da família pelo QrPlugin (Kotlin, ZXing numa tela própria).

use serde::Deserialize;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

pub struct QrAndroid<R: Runtime>(PluginHandle<R>);

#[derive(Deserialize)]
struct Resposta {
    conteudo: Option<String>,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("qr")
        .setup(|app, api| {
            let h = api.register_android_plugin("br.familia.arquivosaude", "QrPlugin")?;
            app.manage(QrAndroid(h));
            Ok(())
        })
        .build()
}

/// Conteúdo do QR lido; `None` = a pessoa voltou sem ler.
pub async fn ler<R: Runtime>(app: &AppHandle<R>) -> Result<Option<String>, String> {
    let h = app.try_state::<QrAndroid<R>>().ok_or("leitor de QR indisponível")?;
    let r: Resposta = h.0.run_mobile_plugin_async("ler", serde_json::json!({})).await.map_err(|e| e.to_string())?;
    Ok(r.conteudo)
}
