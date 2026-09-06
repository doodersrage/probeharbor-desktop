mod auth;
mod open_url;

use auth::{
    api_form_post, api_request, disconnect_companion, has_companion_session, start_companion_login,
};
use open_url::open_https_url;
use tauri::Manager;

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    open_https_url(&url)
}

#[tauri::command]
fn set_kiosk_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window missing".to_string())?;
    window
        .set_fullscreen(enabled)
        .map_err(|e| format!("fullscreen: {e}"))?;
    window
        .set_always_on_top(enabled)
        .map_err(|e| format!("always on top: {e}"))?;
    // Decorations off in kiosk for a cleaner shop display.
    let _ = window.set_decorations(!enabled);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            open_external,
            start_companion_login,
            disconnect_companion,
            has_companion_session,
            api_request,
            api_form_post,
            set_kiosk_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ThermalTrace Desktop");
}
