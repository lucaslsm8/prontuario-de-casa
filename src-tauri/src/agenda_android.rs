//! Android: consultas na agenda do celular pelo AgendaPlugin (Kotlin, CalendarContract).

use serde_json::Value;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

pub struct AgendaAndroid<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("agenda")
        .setup(|app, api| {
            let h = api.register_android_plugin("br.familia.arquivosaude", "AgendaPlugin")?;
            app.manage(AgendaAndroid(h));
            Ok(())
        })
        .build()
}

/// `calendarios` (pede a permissão de agenda) ou `sincronizar` (`{ calendarioId, eventos }`).
pub async fn chamar<R: Runtime>(app: &AppHandle<R>, comando: &str, args: Value) -> Result<Value, String> {
    let h = app.try_state::<AgendaAndroid<R>>().ok_or("agenda do celular indisponível")?;
    h.0.run_mobile_plugin_async(comando, args).await.map_err(|e| e.to_string())
}
