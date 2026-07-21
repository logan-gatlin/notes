use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};

/// How a note came into existence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteSource {
    /// Legacy: previously created automatically for a scheduled meeting.
    /// Retained so older notes on disk still parse.
    Auto,
    /// Created manually by the user for a meeting type.
    Manual,
    /// A misc note with no meeting type.
    Misc,
}

/// Structured YAML frontmatter for a note file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMetadata {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meeting_type_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start: Option<DateTime<FixedOffset>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end: Option<DateTime<FixedOffset>>,
    pub created_at: DateTime<FixedOffset>,
    pub source: NoteSource,
    /// Whether the note has been archived. Omitted from frontmatter when unset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub archived: Option<bool>,
}

/// A fully parsed note: structured metadata + raw markdown body.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Note {
    pub metadata: NoteMetadata,
    pub body: String,
    /// Filesystem path (absolute). Optional in core; set by the storage layer.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// A recurring meeting type used to group notes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingType {
    pub id: String,
    pub name: String,
}

/// AI integration settings for the Cloudflare AI Gateway.
///
/// The gateway sits behind Cloudflare Access (Zero Trust); the only runtime
/// credential is an Access session JWT obtained via the browser (see the
/// `access` module in the app crate). Provider (Anthropic) credentials are held
/// by the gateway itself (Unified Billing / BYOK), so no provider API key is
/// stored here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    /// Base URL of the Access-protected gateway, up to and including the
    /// gateway id, e.g. `https://ai-gw.example.com/v1/<account>/<gateway>`.
    /// The provider path (`/compat/chat/completions`) is appended by the app.
    pub base_url: String,
    /// Model identifier, e.g. `anthropic/claude-3-5-sonnet-20241022`.
    pub model: String,
    /// Optional AI Gateway token sent as `cf-aig-authorization`. Usually unset
    /// when the gateway is reached through Cloudflare Access.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gateway_token: Option<String>,
}

/// Application configuration persisted to `config.json`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes_root: Option<String>,
    #[serde(default)]
    pub meeting_types: Vec<MeetingType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai: Option<AiConfig>,
}
