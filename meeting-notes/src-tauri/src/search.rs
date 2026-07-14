use crate::fsstore::NoteEntry;
use anyhow::Result;
use notes_core::note_matches;
use std::path::Path;
use walkdir::WalkDir;

/// Walk the notes root and return notes whose title or body match `query`.
pub fn search_notes(root: &Path, query: &str) -> Result<Vec<NoteEntry>> {
    let mut results = Vec::new();
    if !root.exists() {
        return Ok(results);
    }
    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().map(|e| e == "md").unwrap_or(false) {
            if let Ok(note) = crate::fsstore::read_note(path) {
                if note_matches(&note.metadata.title, &note.body, query) {
                    results.push(note);
                }
            }
        }
    }
    Ok(results)
}
