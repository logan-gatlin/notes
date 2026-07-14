use notes_core::Config;
use std::sync::Mutex;

/// Shared, mutable application state managed by Tauri.
pub struct AppState {
    pub config: Mutex<Config>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        AppState {
            config: Mutex::new(config),
        }
    }
}
