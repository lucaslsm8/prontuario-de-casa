//! Android: a chave do banco vem do CofrePlugin (Kotlin), cifrada pelo AndroidKeyStore.
//! Nos outros sistemas este módulo não existe (cripto.rs usa o cofre do sistema ou um arquivo).

use serde::Deserialize;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

pub struct Cofre<R: Runtime>(PluginHandle<R>);

#[derive(Deserialize)]
struct Resposta {
    chave: String,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("cofre")
        .setup(|app, api| {
            let h = api.register_android_plugin("br.familia.arquivosaude", "CofrePlugin")?;
            app.manage(Cofre(h));
            Ok(())
        })
        .build()
}

pub fn chave<R: Runtime>(app: &AppHandle<R>) -> Result<[u8; 32], String> {
    let c = app.state::<Cofre<R>>();
    let r: Resposta = c.0.run_mobile_plugin("chave", ()).map_err(|e| e.to_string())?;
    let mut out = [0u8; 32];
    if r.chave.len() != 64 || !r.chave.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("chave do cofre inválida".into());
    }
    for (i, par) in r.chave.as_bytes().chunks(2).enumerate() {
        out[i] = u8::from_str_radix(std::str::from_utf8(par).unwrap_or("00"), 16).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

pub fn apagar<R: Runtime>(app: &AppHandle<R>) {
    let c = app.state::<Cofre<R>>();
    let _: Result<serde_json::Value, _> = c.0.run_mobile_plugin("apagar", ());
}
