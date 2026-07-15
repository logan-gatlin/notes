use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, FixedOffset, Local, Utc};
use notes_core::{
    parse_note, serialize_note, slug::unique_filename, Note, NoteMetadata, NoteSource,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use walkdir::WalkDir;

pub const MISC_FOLDER: &str = "_misc";

/// Dedicated folder holding archived notes. Archived notes keep their
/// `meetingTypeId` in frontmatter so they remember (and can be restored to)
/// their original meeting type.
pub const ARCHIVE_FOLDER: &str = "_archive";

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

/// The non-archive "home" folder a note belongs in, derived from its metadata.
/// Used to restore a note when it is unarchived.
fn origin_folder(meta: &NoteMetadata) -> String {
    match meta.source {
        NoteSource::Misc => MISC_FOLDER.to_string(),
        _ => meta
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
        archived: None,
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

/// Move a note into or out of the archive folder, updating its `archived` flag.
///
/// Archived notes keep their `meetingTypeId`, so unarchiving restores them to
/// their original meeting-type (or misc) folder. Returns the note at its new
/// path (the caller must use the returned path, which changes on move).
pub fn set_archived(root: &Path, path: &Path, archived: bool) -> Result<NoteEntry> {
    let mut entry = read_note(path)?;
    entry.metadata.archived = if archived { Some(true) } else { None };

    let dest_folder = if archived {
        ARCHIVE_FOLDER.to_string()
    } else {
        origin_folder(&entry.metadata)
    };
    let dir = root.join(&dest_folder);
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating note folder {}", dir.display()))?;

    let current_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| anyhow!("note path has no filename: {}", path.display()))?
        .to_string();

    // Preserve the filename across the move; only rename on a genuine collision
    // with a *different* file already in the destination folder.
    let mut existing = existing_filenames(&dir);
    if dir.as_path() == path.parent().unwrap_or(root) {
        existing.remove(&current_name);
    }
    let filename = if existing.contains(&current_name) {
        let date_source = entry.metadata.start.unwrap_or(entry.metadata.created_at);
        let date_str = date_source.date_naive().format("%Y-%m-%d").to_string();
        unique_filename(&date_str, &entry.metadata.title, &existing)
    } else {
        current_name
    };
    let dest_path = dir.join(&filename);

    let content =
        serialize_note(&entry.metadata, &entry.body).map_err(|e| anyhow!(e.to_string()))?;
    std::fs::write(&dest_path, content)
        .with_context(|| format!("writing note {}", dest_path.display()))?;
    if dest_path.as_path() != path {
        std::fs::remove_file(path)
            .with_context(|| format!("removing old note {}", path.display()))?;
    }

    entry.path = dest_path.to_string_lossy().to_string();
    Ok(entry)
}

/// Delete a note file.
pub fn delete_note(path: &Path) -> Result<()> {
    std::fs::remove_file(path).with_context(|| format!("deleting note {}", path.display()))?;
    Ok(())
}

/// List notes under the root, optionally filtered.
///
/// `filter` may be a meeting type folder id, [`MISC_FOLDER`], [`ARCHIVE_FOLDER`],
/// or `None` for all notes. Each explicit filter scans its own folder; the
/// unfiltered "all" view skips the archive folder so archived notes only surface
/// under the archive view.
///
/// Sorted by note start (or created_at) descending — most recent first.
pub fn list_notes(root: &Path, filter: Option<&str>) -> Result<Vec<NoteEntry>> {
    let scan_root: PathBuf = match filter {
        Some(id) => root.join(id),
        None => root.to_path_buf(),
    };
    if !scan_root.exists() {
        return Ok(Vec::new());
    }

    // Only the unfiltered view walks the whole tree, so the archive folder is
    // excluded there; every other view already targets a single folder.
    let skip_archive = filter.is_none();

    let mut entries = Vec::new();
    let walker = WalkDir::new(&scan_root)
        .into_iter()
        .filter_entry(|e| {
            !(skip_archive
                && e.file_type().is_dir()
                && e.file_name() == OsStr::new(ARCHIVE_FOLDER))
        })
        .filter_map(|e| e.ok());
    for entry in walker {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// A unique temp directory per test invocation (no external crate needed).
    fn temp_root() -> PathBuf {
        static N: AtomicU32 = AtomicU32::new(0);
        let n = N.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("notes-test-{}-{n}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn input(title: &str, mt: Option<&str>, source: NoteSource) -> CreateNoteInput {
        CreateNoteInput {
            title: title.into(),
            meeting_type_id: mt.map(str::to_string),
            start: None,
            end: None,
            source,
            body: None,
        }
    }

    #[test]
    fn archive_moves_to_archive_folder_then_restores_to_origin() {
        let root = temp_root();
        let note =
            create_note(&root, input("Standup", Some("standup"), NoteSource::Manual)).unwrap();
        let orig_path = PathBuf::from(&note.path);
        assert!(orig_path.starts_with(root.join("standup")));

        // Archive: file moves into _archive, keeps meetingTypeId, flag set.
        let archived = set_archived(&root, &orig_path, true).unwrap();
        let archived_path = PathBuf::from(&archived.path);
        assert!(archived_path.starts_with(root.join(ARCHIVE_FOLDER)));
        assert_eq!(archived.metadata.archived, Some(true));
        assert_eq!(archived.metadata.meeting_type_id.as_deref(), Some("standup"));
        assert!(!orig_path.exists());

        // Hidden from "all" and its meeting type; visible only under archive.
        assert_eq!(list_notes(&root, None).unwrap().len(), 0);
        assert_eq!(list_notes(&root, Some("standup")).unwrap().len(), 0);
        assert_eq!(list_notes(&root, Some(ARCHIVE_FOLDER)).unwrap().len(), 1);

        // Unarchive: restored to the original meeting-type folder, flag cleared.
        let restored = set_archived(&root, &archived_path, false).unwrap();
        let restored_path = PathBuf::from(&restored.path);
        assert!(restored_path.starts_with(root.join("standup")));
        assert_eq!(restored.metadata.archived, None);
        assert!(!archived_path.exists());
        assert_eq!(list_notes(&root, Some("standup")).unwrap().len(), 1);
        assert_eq!(list_notes(&root, Some(ARCHIVE_FOLDER)).unwrap().len(), 0);

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn archived_misc_note_restores_to_misc_folder() {
        let root = temp_root();
        let note = create_note(&root, input("Idea", None, NoteSource::Misc)).unwrap();
        let orig_path = PathBuf::from(&note.path);
        assert!(orig_path.starts_with(root.join(MISC_FOLDER)));

        let archived = set_archived(&root, &orig_path, true).unwrap();
        let restored =
            set_archived(&root, &PathBuf::from(&archived.path), false).unwrap();
        assert!(PathBuf::from(&restored.path).starts_with(root.join(MISC_FOLDER)));

        std::fs::remove_dir_all(&root).ok();
    }
}
