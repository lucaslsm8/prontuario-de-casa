//! Android: a ação da notificação (Tomei / Pular / 15 min) que abriu o app fechado, pelo LembretePlugin (Kotlin).
//! O plugin de notificações dispara essa ação antes de o front escutar; o front pergunta aqui na montagem.

use serde_json::Value;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

pub struct LembreteAndroid<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("lembrete")
        .setup(|app, api| {
            let h = api.register_android_plugin("br.familia.arquivosaude", "LembretePlugin")?;
            app.manage(LembreteAndroid(h));
            Ok(())
        })
        .build()
}

/// `{ actionId, notification }` como no evento `actionPerformed` do plugin, ou `{}` sem ação pendente. Lê uma vez só.
pub async fn acao_pendente<R: Runtime>(app: &AppHandle<R>) -> Value {
    let Some(h) = app.try_state::<LembreteAndroid<R>>() else { return Value::Null };
    h.0.run_mobile_plugin_async("acaoPendente", serde_json::json!({})).await.unwrap_or(Value::Null)
}
