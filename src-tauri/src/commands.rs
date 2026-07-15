use crate::config;
use crate::fsstore::{self, CreateNoteInput, NoteEntry};
use crate::search;
use crate::state::AppState;
use notes_core::{slugify, MeetingType, NoteMetadata};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

type CmdResult<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// Persist the current in-memory config to disk.
fn persist(app: &AppHandle, state: &AppState) -> CmdResult<()> {
    let cfg = state.config.lock().unwrap().clone();
    config::save(app, &cfg).map_err(err)
}

fn require_root(state: &AppState) -> CmdResult<PathBuf> {
    state
        .config
        .lock()
        .unwrap()
        .notes_root
        .clone()
        .map(PathBuf::from)
        .ok_or_else(|| "notes root not configured".to_string())
}

// ---------------------------------------------------------------------------
// Meeting types
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_meeting_types(state: State<AppState>) -> CmdResult<Vec<MeetingType>> {
    Ok(state.config.lock().unwrap().meeting_types.clone())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingTypeInput {
    pub name: String,
}

fn unique_type_id(base: &str, existing: &[MeetingType]) -> String {
    let slug = slugify(base);
    if !existing.iter().any(|t| t.id == slug) {
        return slug;
    }
    let mut n = 2;
    loop {
        let candidate = format!("{slug}-{n}");
        if !existing.iter().any(|t| t.id == candidate) {
            return candidate;
        }
        n += 1;
    }
}

#[tauri::command]
pub fn create_meeting_type(
    app: AppHandle,
    state: State<AppState>,
    input: MeetingTypeInput,
) -> CmdResult<MeetingType> {
    let mt = {
        let mut cfg = state.config.lock().unwrap();
        let id = unique_type_id(&input.name, &cfg.meeting_types);
        let mt = MeetingType {
            id,
            name: input.name,
        };
        cfg.meeting_types.push(mt.clone());
        mt
    };
    persist(&app, &state)?;
    Ok(mt)
}

#[tauri::command]
pub fn update_meeting_type(
    app: AppHandle,
    state: State<AppState>,
    meeting_type: MeetingType,
) -> CmdResult<MeetingType> {
    {
        let mut cfg = state.config.lock().unwrap();
        let found = cfg
            .meeting_types
            .iter_mut()
            .find(|t| t.id == meeting_type.id);
        match found {
            Some(slot) => *slot = meeting_type.clone(),
            None => return Err(format!("meeting type '{}' not found", meeting_type.id)),
        }
    }
    persist(&app, &state)?;
    Ok(meeting_type)
}

#[tauri::command]
pub fn delete_meeting_type(app: AppHandle, state: State<AppState>, id: String) -> CmdResult<()> {
    {
        let mut cfg = state.config.lock().unwrap();
        cfg.meeting_types.retain(|t| t.id != id);
    }
    persist(&app, &state)
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_notes(
    state: State<AppState>,
    meeting_type_id: Option<String>,
) -> CmdResult<Vec<NoteEntry>> {
    let root = require_root(&state)?;
    fsstore::list_notes(&root, meeting_type_id.as_deref()).map_err(err)
}

#[tauri::command]
pub fn read_note(path: String) -> CmdResult<NoteEntry> {
    fsstore::read_note(Path::new(&path)).map_err(err)
}

#[tauri::command]
pub fn create_note(state: State<AppState>, input: CreateNoteInput) -> CmdResult<NoteEntry> {
    let root = require_root(&state)?;
    fsstore::create_note(&root, input).map_err(err)
}

#[tauri::command]
pub fn write_note(path: String, metadata: NoteMetadata, body: String) -> CmdResult<()> {
    fsstore::write_note(Path::new(&path), &metadata, &body).map_err(err)
}

#[tauri::command]
pub fn set_archived(
    state: State<AppState>,
    path: String,
    archived: bool,
) -> CmdResult<NoteEntry> {
    let root = require_root(&state)?;
    fsstore::set_archived(&root, Path::new(&path), archived).map_err(err)
}

#[tauri::command]
pub fn delete_note(path: String) -> CmdResult<()> {
    fsstore::delete_note(Path::new(&path)).map_err(err)
}

#[tauri::command]
pub fn search_notes(state: State<AppState>, query: String) -> CmdResult<Vec<NoteEntry>> {
    let root = require_root(&state)?;
    search::search_notes(&root, &query).map_err(err)
}
