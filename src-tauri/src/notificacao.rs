//! Notificação do sistema para um lembrete. No Windows: notificação nativa com
//! os botões Tomei / Lembrar em 15 min / Pular esta dose (M15). Nos outros
//! sistemas, por enquanto, só registra no terminal.

use crate::lembretes::{Agendador, Lembrete};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

/// Mesmo valor do `identifier` em tauri.conf.json.
#[cfg_attr(not(windows), allow(dead_code))]
const APP_ID: &str = "br.familia.arquivosaude";

#[cfg_attr(not(windows), allow(dead_code))]
#[derive(Clone, Serialize)]
struct Acao {
    id: String,
    acao: String,
}

/// Registra o app no Windows (HKCU, sem administrador) para as notificações
/// aparecerem como "Prontuário de Casa". Vale também para `npm run app:dev`.
#[cfg(windows)]
pub fn registrar() {
    use windows_registry::CURRENT_USER;
    if let Ok(k) = CURRENT_USER.create(format!(r"SOFTWARE\Classes\AppUserModelId\{APP_ID}")) {
        let _ = k.set_string("DisplayName", "Prontuário de Casa");
    }
}

#[cfg(not(windows))]
pub fn registrar() {}

#[cfg_attr(not(windows), allow(dead_code))]
fn focar(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        #[cfg(desktop)]
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg(windows)]
pub fn mostrar(app: &AppHandle, ag: &Arc<Agendador>, l: Lembrete) {
    use tauri::Emitter;
    use tauri_winrt_notification::{Scenario, Toast};

    let (app2, ag2, id) = (app.clone(), ag.clone(), l.id.clone());
    let mut t = Toast::new(APP_ID).title(&l.titulo).text1(&l.corpo);
    if l.acoes {
        t = t
            .scenario(Scenario::Reminder)
            .add_button("Tomei", "tomada")
            .add_button("Lembrar em 15 min", "adiar")
            .add_button("Pular esta dose", "pulada");
    }
    let t = t.on_activated(move |acao| {
        match acao.as_deref() {
            Some("adiar") => ag2.adiar(&id),
            Some(a @ ("tomada" | "pulada")) => {
                let _ = app2.emit("lembrete-acao", Acao { id: id.clone(), acao: a.into() });
            }
            _ => focar(&app2),
        }
        Ok(())
    });
    if let Err(e) = t.show() {
        eprintln!("notificação não mostrada: {e}");
    }
}

#[cfg(not(windows))]
pub fn mostrar(_app: &AppHandle, _ag: &Arc<Agendador>, l: Lembrete) {
    eprintln!("lembrete: {} — {}", l.titulo, l.corpo);
}
