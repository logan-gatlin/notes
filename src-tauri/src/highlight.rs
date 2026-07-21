//! Syntax highlighting for fenced code blocks, powered by tree-sitter.
//!
//! The frontend sends a code string and an optional language hint (the info
//! string of a markdown fence). We parse with the matching tree-sitter grammar,
//! run `tree-sitter-highlight`, and return a pre-escaped HTML fragment made of
//! `<span class="hh-…">` tokens. Class names are stable and themed in the
//! frontend CSS. When no grammar matches (or parsing fails) we fall back to the
//! HTML-escaped source so the caller can always render *something*.

use serde::Serialize;
use tree_sitter::Language;
use tree_sitter_highlight::{HighlightConfiguration, HighlightEvent, Highlighter};

/// Capture names we recognize, in a fixed order. The index of a name is used to
/// pick the matching CSS class (see `CLASSES`). tree-sitter maps a grammar's
/// finer-grained captures (e.g. `function.macro`) onto the closest prefix here.
const HIGHLIGHT_NAMES: &[&str] = &[
    "attribute",
    "comment",
    "comment.documentation",
    "constant",
    "constant.builtin",
    "constructor",
    "embedded",
    "escape",
    "function",
    "function.builtin",
    "function.method",
    "keyword",
    "label",
    "module",
    "number",
    "operator",
    "property",
    "punctuation",
    "punctuation.bracket",
    "punctuation.delimiter",
    "punctuation.special",
    "string",
    "string.escape",
    "string.regexp",
    "string.special",
    "tag",
    "type",
    "type.builtin",
    "variable",
    "variable.builtin",
    "variable.parameter",
];

/// CSS class for each recognized name: `attribute` -> `hh-attribute`,
/// `constant.builtin` -> `hh-constant-builtin`.
fn class_for(index: usize) -> String {
    format!("hh-{}", HIGHLIGHT_NAMES[index].replace('.', "-"))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightResult {
    /// Highlighted inner HTML for a `<code>` element (already escaped).
    pub html: String,
    /// The canonical language that was applied, or `null` if the block was
    /// rendered as plain (unknown language / no hint).
    pub language: Option<String>,
}

/// Escape text for safe insertion as HTML text content.
fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

/// Normalize a fence info string / language hint to a canonical grammar key.
fn canonical(lang: &str) -> Option<&'static str> {
    // Only the first token matters (e.g. ```ts title=foo).
    let key = lang.trim().split_whitespace().next().unwrap_or("").to_ascii_lowercase();
    let canon = match key.as_str() {
        "rust" | "rs" => "rust",
        "python" | "py" => "python",
        "javascript" | "js" | "mjs" | "cjs" | "node" => "javascript",
        "jsx" => "jsx",
        "typescript" | "ts" => "typescript",
        "tsx" => "tsx",
        "json" | "jsonc" | "json5" => "json",
        "bash" | "sh" | "shell" | "zsh" | "shellscript" => "bash",
        "go" | "golang" => "go",
        "c" | "h" => "c",
        "html" | "htm" | "xhtml" => "html",
        "css" => "css",
        _ => return None,
    };
    Some(canon)
}

/// Build a configured `HighlightConfiguration` for a canonical language key.
fn build_config(canon: &str) -> Result<HighlightConfiguration, String> {
    // Some crates expose singular `HIGHLIGHT_QUERY`, others `HIGHLIGHTS_QUERY`.
    // TypeScript/TSX inherit the JavaScript highlight rules and layer their own
    // on top, matching the convention used by editors like Neovim.
    let (language, highlights, injections, locals): (Language, String, String, String) =
        match canon {
            "rust" => (
                tree_sitter_rust::LANGUAGE.into(),
                tree_sitter_rust::HIGHLIGHTS_QUERY.to_string(),
                tree_sitter_rust::INJECTIONS_QUERY.to_string(),
                String::new(),
            ),
            "python" => (
                tree_sitter_python::LANGUAGE.into(),
                tree_sitter_python::HIGHLIGHTS_QUERY.to_string(),
                String::new(),
                String::new(),
            ),
            "javascript" => (
                tree_sitter_javascript::LANGUAGE.into(),
                tree_sitter_javascript::HIGHLIGHT_QUERY.to_string(),
                tree_sitter_javascript::INJECTIONS_QUERY.to_string(),
                tree_sitter_javascript::LOCALS_QUERY.to_string(),
            ),
            "jsx" => (
                tree_sitter_javascript::LANGUAGE.into(),
                format!(
                    "{}\n{}",
                    tree_sitter_javascript::HIGHLIGHT_QUERY,
                    tree_sitter_javascript::JSX_HIGHLIGHT_QUERY
                ),
                tree_sitter_javascript::INJECTIONS_QUERY.to_string(),
                tree_sitter_javascript::LOCALS_QUERY.to_string(),
            ),
            "typescript" => (
                tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
                format!(
                    "{}\n{}",
                    tree_sitter_javascript::HIGHLIGHT_QUERY,
                    tree_sitter_typescript::HIGHLIGHTS_QUERY
                ),
                tree_sitter_javascript::INJECTIONS_QUERY.to_string(),
                format!(
                    "{}\n{}",
                    tree_sitter_javascript::LOCALS_QUERY,
                    tree_sitter_typescript::LOCALS_QUERY
                ),
            ),
            "tsx" => (
                tree_sitter_typescript::LANGUAGE_TSX.into(),
                format!(
                    "{}\n{}\n{}",
                    tree_sitter_javascript::HIGHLIGHT_QUERY,
                    tree_sitter_javascript::JSX_HIGHLIGHT_QUERY,
                    tree_sitter_typescript::HIGHLIGHTS_QUERY
                ),
                tree_sitter_javascript::INJECTIONS_QUERY.to_string(),
                format!(
                    "{}\n{}",
                    tree_sitter_javascript::LOCALS_QUERY,
                    tree_sitter_typescript::LOCALS_QUERY
                ),
            ),
            "json" => (
                tree_sitter_json::LANGUAGE.into(),
                tree_sitter_json::HIGHLIGHTS_QUERY.to_string(),
                String::new(),
                String::new(),
            ),
            "bash" => (
                tree_sitter_bash::LANGUAGE.into(),
                tree_sitter_bash::HIGHLIGHT_QUERY.to_string(),
                String::new(),
                String::new(),
            ),
            "go" => (
                tree_sitter_go::LANGUAGE.into(),
                tree_sitter_go::HIGHLIGHTS_QUERY.to_string(),
                String::new(),
                String::new(),
            ),
            "c" => (
                tree_sitter_c::LANGUAGE.into(),
                tree_sitter_c::HIGHLIGHT_QUERY.to_string(),
                String::new(),
                String::new(),
            ),
            "html" => (
                tree_sitter_html::LANGUAGE.into(),
                tree_sitter_html::HIGHLIGHTS_QUERY.to_string(),
                tree_sitter_html::INJECTIONS_QUERY.to_string(),
                String::new(),
            ),
            "css" => (
                tree_sitter_css::LANGUAGE.into(),
                tree_sitter_css::HIGHLIGHTS_QUERY.to_string(),
                String::new(),
                String::new(),
            ),
            other => return Err(format!("unsupported language '{other}'")),
        };

    let mut config = HighlightConfiguration::new(language, canon, &highlights, &injections, &locals)
        .map_err(|e| e.to_string())?;
    config.configure(HIGHLIGHT_NAMES);
    Ok(config)
}

/// Highlight `code` as `canon`, producing escaped `<span>`-annotated HTML.
fn render(code: &str, canon: &str) -> Result<String, String> {
    let config = build_config(canon)?;
    let mut highlighter = Highlighter::new();
    let events = highlighter
        .highlight(&config, code.as_bytes(), None, |_: &str| None)
        .map_err(|e| e.to_string())?;

    let mut out = String::with_capacity(code.len() * 2);
    for event in events {
        match event.map_err(|e| e.to_string())? {
            HighlightEvent::Source { start, end } => {
                // tree-sitter reports byte offsets; guard against slicing on a
                // non-char boundary so malformed input can never panic.
                let piece = code.get(start..end).map(str::to_owned).unwrap_or_else(|| {
                    String::from_utf8_lossy(&code.as_bytes()[start..end]).into_owned()
                });
                out.push_str(&escape(&piece));
            }
            HighlightEvent::HighlightStart(h) => {
                out.push_str(&format!("<span class=\"{}\">", class_for(h.0)));
            }
            HighlightEvent::HighlightEnd => out.push_str("</span>"),
        }
    }
    Ok(out)
}

/// Highlight a code block. Never fails: unknown languages and parse errors both
/// fall back to escaped plain text.
#[tauri::command]
pub fn highlight_code(code: String, language: Option<String>) -> HighlightResult {
    let canon = language.as_deref().and_then(canonical);
    match canon {
        Some(canon) => match render(&code, canon) {
            Ok(html) => HighlightResult {
                html,
                language: Some(canon.to_string()),
            },
            Err(_) => HighlightResult {
                html: escape(&code),
                language: None,
            },
        },
        None => HighlightResult {
            html: escape(&code),
            language: None,
        },
    }
}
