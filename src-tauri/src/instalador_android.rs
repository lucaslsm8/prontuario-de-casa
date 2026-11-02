//! Android: abre o instalador de pacotes do sistema para o APK baixado, pelo InstaladorPlugin (Kotlin).

use serde::Deserialize;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

pub struct InstaladorAndroid<R: Runtime>(PluginHandle<R>);

#[derive(Deserialize)]
struct Resposta {
    /// "aberto" (instalador do Android na tela) ou "permissao" (abriu a tela de "instalar apps desconhecidos").
    estado: String,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("instalador")
        .setup(|app, api| {
            let h = api.register_android_plugin("br.familia.arquivosaude", "InstaladorPlugin")?;
            app.manage(InstaladorAndroid(h));
            Ok(())
        })
        .build()
}

pub async fn instalar<R: Runtime>(app: &AppHandle<R>, caminho: &str) -> Result<String, String> {
    let h = app.try_state::<InstaladorAndroid<R>>().ok_or("instalador indisponível")?;
    let r: Resposta = h.0.run_mobile_plugin_async("instalar", serde_json::json!({ "caminho": caminho })).await.map_err(|e| e.to_string())?;
    Ok(r.estado)
}
