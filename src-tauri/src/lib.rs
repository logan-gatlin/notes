mod commands;
mod config;
mod fsstore;
mod search;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle();

            // Load persisted config (or default) and register shared state.
            let mut cfg = config::load(handle).unwrap_or_default();

            // Default the notes folder to ~/Documents/notes-app on first run so
            // no setup step is required.
            if cfg.notes_root.is_none() {
                if let Ok(docs) = handle.path().document_dir() {
                    let default_root = docs.join("notes-app");
                    cfg.notes_root = Some(default_root.to_string_lossy().to_string());
                    let _ = config::save(handle, &cfg);
                }
            }

            app.manage(AppState::new(cfg));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_meeting_types,
            commands::create_meeting_type,
            commands::update_meeting_type,
            commands::delete_meeting_type,
            commands::list_notes,
            commands::read_note,
            commands::create_note,
            commands::write_note,
            commands::delete_note,
            commands::search_notes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
