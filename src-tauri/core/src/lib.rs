//! Pure, dependency-light business logic for Meeting Notes.
//!
//! This crate deliberately has **no** Tauri, OS, filesystem, or network
//! dependencies so it can be unit-tested quickly and in isolation. The Tauri
//! application crate wires these functions to real IO (filesystem, keyring,
//! HTTP) and the IPC surface.

pub mod frontmatter;
pub mod search;
pub mod slug;
pub mod types;

pub use frontmatter::{parse_note, serialize_note, FrontmatterError};
pub use search::note_matches;
pub use slug::{slugify, unique_filename};
pub use types::{Config, MeetingType, Note, NoteMetadata, NoteSource};
