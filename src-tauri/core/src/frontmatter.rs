use crate::types::{Note, NoteMetadata};

#[derive(Debug)]
pub enum FrontmatterError {
    /// No `---` frontmatter block found at the start of the file.
    Missing,
    /// The frontmatter opened but never closed with a `---` line.
    Unterminated,
    /// YAML failed to parse/deserialize into `NoteMetadata`.
    Yaml(String),
}

impl std::fmt::Display for FrontmatterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FrontmatterError::Missing => write!(f, "no frontmatter block found"),
            FrontmatterError::Unterminated => write!(f, "unterminated frontmatter block"),
            FrontmatterError::Yaml(e) => write!(f, "frontmatter yaml error: {e}"),
        }
    }
}

impl std::error::Error for FrontmatterError {}

/// Split a note file's contents into its YAML frontmatter and markdown body.
///
/// Expects the canonical form:
/// ```text
/// ---
/// <yaml>
/// ---
/// <body>
/// ```
fn split_frontmatter(content: &str) -> Result<(&str, &str), FrontmatterError> {
    // Normalise leading BOM / whitespace-free check: must begin with a `---` line.
    let stripped = content.strip_prefix('\u{feff}').unwrap_or(content);
    let after_open = stripped
        .strip_prefix("---\n")
        .or_else(|| stripped.strip_prefix("---\r\n"))
        .ok_or(FrontmatterError::Missing)?;

    // Find the closing delimiter line (`---` on its own line).
    let mut search_start = 0usize;
    loop {
        let rel = after_open[search_start..]
            .find("---")
            .ok_or(FrontmatterError::Unterminated)?;
        let idx = search_start + rel;

        // Must be at the beginning of a line.
        let at_line_start = idx == 0 || after_open.as_bytes()[idx - 1] == b'\n';
        // Must be followed by newline or EOF.
        let end = idx + 3;
        let followed_ok = end >= after_open.len()
            || after_open.as_bytes()[end] == b'\n'
            || after_open.as_bytes()[end] == b'\r';

        if at_line_start && followed_ok {
            let yaml = &after_open[..idx];
            let mut body = &after_open[end..];
            // Strip the single newline immediately after the closing delimiter.
            body = body
                .strip_prefix("\r\n")
                .or_else(|| body.strip_prefix('\n'))
                .unwrap_or(body);
            return Ok((yaml, body));
        }
        search_start = idx + 3;
    }
}

/// Parse a full note file (frontmatter + body) into a [`Note`].
pub fn parse_note(content: &str) -> Result<Note, FrontmatterError> {
    let (yaml, body) = split_frontmatter(content)?;
    let metadata: NoteMetadata =
        serde_yaml::from_str(yaml).map_err(|e| FrontmatterError::Yaml(e.to_string()))?;
    Ok(Note {
        metadata,
        body: body.to_string(),
        path: None,
    })
}

/// Serialize metadata + body back into the canonical note file form.
pub fn serialize_note(metadata: &NoteMetadata, body: &str) -> Result<String, FrontmatterError> {
    let yaml = serde_yaml::to_string(metadata).map_err(|e| FrontmatterError::Yaml(e.to_string()))?;
    // serde_yaml already ends with a newline.
    let yaml = yaml.trim_end_matches('\n');
    Ok(format!("---\n{yaml}\n---\n{body}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::NoteSource;
    use chrono::DateTime;

    fn sample_body() -> &'static str {
        "## Agenda\n-\n\n## Notes\n\n## Action Items\n-\n"
    }

    fn sample_metadata() -> NoteMetadata {
        NoteMetadata {
            id: "6f1a2e3b-0000-0000-0000-000000000000".into(),
            title: "Weekly Sync".into(),
            meeting_type_id: Some("weekly-sync".into()),
            start: Some(DateTime::parse_from_rfc3339("2026-07-09T14:00:00-04:00").unwrap()),
            end: Some(DateTime::parse_from_rfc3339("2026-07-09T14:30:00-04:00").unwrap()),
            created_at: DateTime::parse_from_rfc3339("2026-07-09T13:52:11-04:00").unwrap(),
            source: NoteSource::Auto,
            archived: None,
        }
    }

    #[test]
    fn round_trip_preserves_metadata_and_body() {
        let meta = sample_metadata();
        let body = sample_body();
        let serialized = serialize_note(&meta, body).unwrap();
        let parsed = parse_note(&serialized).unwrap();
        assert_eq!(parsed.metadata, meta);
        assert_eq!(parsed.body, body);
    }

    #[test]
    fn parses_misc_note_with_null_fields() {
        let content = "---\nid: abc\ntitle: Random Idea\nsource: misc\ncreatedAt: 2026-07-09T13:52:11-04:00\n---\nhello world\n";
        let note = parse_note(content).unwrap();
        assert_eq!(note.metadata.source, NoteSource::Misc);
        assert!(note.metadata.meeting_type_id.is_none());
        assert!(note.metadata.start.is_none());
        assert_eq!(note.body, "hello world\n");
    }

    #[test]
    fn missing_frontmatter_errors() {
        let err = parse_note("just some text\n").unwrap_err();
        assert!(matches!(err, FrontmatterError::Missing));
    }

    #[test]
    fn unterminated_frontmatter_errors() {
        let err = parse_note("---\nid: abc\ntitle: x\n").unwrap_err();
        assert!(matches!(err, FrontmatterError::Unterminated));
    }

    #[test]
    fn body_containing_triple_dash_survives() {
        let meta = sample_metadata();
        let body = "before\n\n---\n\nafter horizontal rule\n";
        let serialized = serialize_note(&meta, body).unwrap();
        let parsed = parse_note(&serialized).unwrap();
        assert_eq!(parsed.body, body);
    }

    #[test]
    fn empty_body_round_trips() {
        let meta = sample_metadata();
        let serialized = serialize_note(&meta, "").unwrap();
        let parsed = parse_note(&serialized).unwrap();
        assert_eq!(parsed.body, "");
    }
}
