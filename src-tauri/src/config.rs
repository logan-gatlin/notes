use anyhow::{Context, Result};
use notes_core::Config;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Absolute path to the config.json file in the app config directory.
pub fn config_path(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .context("could not resolve app config dir")?;
    Ok(dir.join("config.json"))
}

/// Load config.json, returning a default config if the file does not exist.
pub fn load(app: &AppHandle) -> Result<Config> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(Config::default());
    }
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("reading config at {}", path.display()))?;
    let config: Config = serde_json::from_str(&raw).context("parsing config.json")?;
    Ok(config)
}

/// Persist config.json (creating the config directory if necessary).
pub fn save(app: &AppHandle, config: &Config) -> Result<()> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating config dir {}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(config).context("serializing config")?;
    std::fs::write(&path, raw).with_context(|| format!("writing config at {}", path.display()))?;
    Ok(())
}
