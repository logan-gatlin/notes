use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, FixedOffset, Local, Utc};
use notes_core::{
    parse_note, serialize_note, slug::unique_filename, Note, NoteMetadata, NoteSource,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

pub const MISC_FOLDER: &str = "_misc";

/// Default body template for a freshly created note.
pub fn default_body() -> String {
    "## Agenda\n-\n\n## Notes\n\n## Action Items\n-\n".to_string()
}

/// Input payload for creating a note (manual or misc).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub title: String,
    #[serde(default)]
    pub meeting_type_id: Option<String>,
    #[serde(default)]
    pub start: Option<DateTime<FixedOffset>>,
    #[serde(default)]
    pub end: Option<DateTime<FixedOffset>>,
    pub source: NoteSource,
    /// Optional pre-filled body; defaults to the standard template.
    #[serde(default)]
    pub body: Option<String>,
}

/// A note plus its (guaranteed) path, as returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct NoteEntry {
    pub metadata: NoteMetadata,
    pub body: String,
    pub path: String,
}

impl NoteEntry {
    fn from_note(note: Note, path: &Path) -> Self {
        NoteEntry {
            metadata: note.metadata,
            body: note.body,
            path: path.to_string_lossy().to_string(),
        }
    }
}

fn now_offset() -> DateTime<FixedOffset> {
    Local::now().fixed_offset()
}

/// The folder (relative to the notes root) a note of this input belongs in.
fn folder_for(input: &CreateNoteInput) -> String {
    match input.source {
        NoteSource::Misc => MISC_FOLDER.to_string(),
        _ => input
            .meeting_type_id
            .clone()
            .unwrap_or_else(|| MISC_FOLDER.to_string()),
    }
}

/// Collect existing `.md` filenames in a directory (non-recursive).
fn existing_filenames(dir: &Path) -> HashSet<String> {
    let mut set = HashSet::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".md") {
                    set.insert(name.to_string());
                }
            }
        }
    }
    set
}

/// Create a new note file on disk and return it.
pub fn create_note(root: &Path, input: CreateNoteInput) -> Result<NoteEntry> {
    let created_at = now_offset();
    let date_source = input.start.unwrap_or(created_at);
    let date_str = date_source.date_naive().format("%Y-%m-%d").to_string();

    let folder = folder_for(&input);
    let dir = root.join(&folder);
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating note folder {}", dir.display()))?;

    let existing = existing_filenames(&dir);
    let filename = unique_filename(&date_str, &input.title, &existing);
    let path = dir.join(&filename);

    let metadata = NoteMetadata {
        id: Uuid::new_v4().to_string(),
        title: input.title,
        meeting_type_id: input.meeting_type_id,
        start: input.start,
        end: input.end,
        created_at,
        source: input.source,
    };
    let body = input.body.unwrap_or_else(default_body);

    let content = serialize_note(&metadata, &body).map_err(|e| anyhow!(e.to_string()))?;
    std::fs::write(&path, content).with_context(|| format!("writing note {}", path.display()))?;

    Ok(NoteEntry {
        metadata,
        body,
        path: path.to_string_lossy().to_string(),
    })
}

/// Read and parse a single note file.
pub fn read_note(path: &Path) -> Result<NoteEntry> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("reading note {}", path.display()))?;
    let note = parse_note(&raw).map_err(|e| anyhow!("{}: {}", path.display(), e))?;
    Ok(NoteEntry::from_note(note, path))
}

/// Overwrite a note file with new metadata + body (used by autosave).
pub fn write_note(path: &Path, metadata: &NoteMetadata, body: &str) -> Result<()> {
    let content = serialize_note(metadata, body).map_err(|e| anyhow!(e.to_string()))?;
    std::fs::write(path, content).with_context(|| format!("writing note {}", path.display()))?;
    Ok(())
}

/// Delete a note file.
pub fn delete_note(path: &Path) -> Result<()> {
    std::fs::remove_file(path).with_context(|| format!("deleting note {}", path.display()))?;
    Ok(())
}

/// List notes under the root, optionally filtered to a meeting type folder.
///
/// Sorted by note start (or created_at) descending — most recent first.
pub fn list_notes(root: &Path, meeting_type_id: Option<&str>) -> Result<Vec<NoteEntry>> {
    let scan_root: PathBuf = match meeting_type_id {
        Some(id) => root.join(id),
        None => root.to_path_buf(),
    };
    if !scan_root.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(&scan_root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().map(|e| e == "md").unwrap_or(false) {
            match read_note(path) {
                Ok(note) => entries.push(note),
                Err(err) => eprintln!("skipping unreadable note: {err}"),
            }
        }
    }

    entries.sort_by(|a, b| sort_key(&b.metadata).cmp(&sort_key(&a.metadata)));
    Ok(entries)
}

fn sort_key(meta: &NoteMetadata) -> DateTime<Utc> {
    meta.start.unwrap_or(meta.created_at).with_timezone(&Utc)
}
