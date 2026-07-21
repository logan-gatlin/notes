//! AI integration against the opencode Cloudflare AI Gateway
//! (`https://opencode.cloudflare.dev`), which is fronted by Cloudflare Access.
//!
//! The frontend builds the `system` + `user_content` messages (see
//! `src/lib/aiActions.ts`) and calls [`ai_edit`]. This module resolves an
//! Access JWT (via the `access` module / `cloudflared`), POSTs an Anthropic
//! Messages API request to the gateway's `/anthropic/v1/messages` endpoint with
//! a single forced tool call (`apply_edits`), and returns the structured edit
//! operations for the frontend to apply to the document.
//!
//! Auth mirrors what opencode itself does for this provider: the gateway's
//! `/.well-known/opencode` document specifies
//! `cloudflared access login -app=https://opencode.cloudflare.dev`, and the
//! resulting token is sent as the `cf-access-token` header. The gateway also
//! requires an `X-Requested-With: xmlhttprequest` header.

use crate::access;
use crate::state::AppState;
use notes_core::AiConfig;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

type CmdResult<T> = Result<T, String>;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEditRequest {
    /// System prompt describing the task and required output format.
    pub system: String,
    /// User message: the note context plus the instruction.
    pub user_content: String,
}

/// A single anchored edit. `old_text` is the exact substring to replace; an
/// empty `old_text` means "insert at the cursor".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEdit {
    pub old_text: String,
    pub new_text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEditResponse {
    pub edits: Vec<AiEdit>,
    /// Optional assistant commentary (used when no edits are produced).
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAuthStatus {
    /// Whether the `cloudflared` binary is available on PATH.
    pub cloudflared_available: bool,
    /// Whether AI settings (base URL + model) are configured.
    pub configured: bool,
    /// Whether a valid cached Access token exists (no login prompt needed).
    pub signed_in: bool,
}

// ---------------------------------------------------------------------------
// Gateway response shapes (Anthropic Messages API)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct MessagesResponse {
    #[serde(default)]
    content: Vec<ContentBlock>,
}

/// A block in an Anthropic assistant message. We only care about `text` and
/// `tool_use`; other block types are ignored.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ContentBlock {
    Text {
        #[serde(default)]
        text: String,
    },
    ToolUse {
        #[serde(default)]
        name: String,
        #[serde(default)]
        input: serde_json::Value,
    },
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct ToolArgs {
    #[serde(default)]
    edits: Vec<AiEdit>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn read_ai_config(state: &AppState) -> CmdResult<AiConfig> {
    state
        .config
        .lock()
        .unwrap()
        .ai
        .clone()
        .ok_or_else(|| "AI is not configured. Open AI settings to set the gateway URL and model.".to_string())
}

fn messages_url(base_url: &str) -> String {
    format!("{}/anthropic/v1/messages", base_url.trim_end_matches('/'))
}

/// The opencode gateway publishes its provider/model catalogue here.
fn config_url(base_url: &str) -> String {
    format!("{}/config/opencode.json", base_url.trim_end_matches('/'))
}

/// A reqwest client that does not follow redirects, so an Access redirect to
/// the identity provider surfaces as a 3xx we can treat as an auth failure.
fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("could not create HTTP client: {e}"))
}

/// The Anthropic tool definition the model must call. Property names are
/// camelCase so the tool input deserializes straight into [`AiEdit`].
fn edit_tool() -> serde_json::Value {
    json!({
        "name": "apply_edits",
        "description": "Apply a set of text edits to the user's markdown note. Each edit finds an exact snippet of the current document and replaces it. Use this to answer prompts, insert content, or rewrite text in place.",
        "input_schema": {
            "type": "object",
            "properties": {
                "edits": {
                    "type": "array",
                    "description": "Ordered list of edits to apply to the note.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "oldText": {
                                "type": "string",
                                "description": "The exact, verbatim substring from the current document to replace (including any surrounding markers such as an angle-bracket prompt). Use an empty string to insert new text at the cursor position."
                            },
                            "newText": {
                                "type": "string",
                                "description": "The replacement text. Use an empty string to delete the matched text."
                            }
                        },
                        "required": ["oldText", "newText"]
                    }
                }
            },
            "required": ["edits"]
        }
    })
}

fn request_body(cfg: &AiConfig, req: &AiEditRequest) -> serde_json::Value {
    json!({
        "model": cfg.model,
        "max_tokens": 8192,
        "system": req.system,
        "messages": [
            { "role": "user", "content": req.user_content },
        ],
        "tools": [edit_tool()],
        "tool_choice": { "type": "tool", "name": "apply_edits" },
    })
}

/// Apply the headers the opencode gateway requires: the Access token, the
/// `X-Requested-With` header, and any optional gateway token.
fn with_auth(
    mut builder: reqwest::RequestBuilder,
    cfg: &AiConfig,
    token: &str,
) -> reqwest::RequestBuilder {
    builder = builder
        .header("cf-access-token", token)
        .header("X-Requested-With", "xmlhttprequest");
    if let Some(gw) = cfg.gateway_token.as_deref().filter(|s| !s.is_empty()) {
        builder = builder.header("cf-aig-authorization", format!("Bearer {gw}"));
    }
    builder
}

/// Perform one POST to the Anthropic messages endpoint with the given token.
async fn send(
    client: &reqwest::Client,
    cfg: &AiConfig,
    body: &serde_json::Value,
    token: &str,
) -> Result<reqwest::Response, String> {
    with_auth(
        client
            .post(messages_url(&cfg.base_url))
            .header("content-type", "application/json")
            .header("anthropic-version", "2023-06-01"),
        cfg,
        token,
    )
    .json(body)
    .send()
    .await
    .map_err(|e| format!("request to AI gateway failed: {e}"))
}

/// Perform one GET to the gateway with the given Access token.
async fn send_get(
    client: &reqwest::Client,
    url: &str,
    cfg: &AiConfig,
    token: &str,
) -> Result<reqwest::Response, String> {
    with_auth(client.get(url), cfg, token)
        .send()
        .await
        .map_err(|e| format!("request to AI gateway failed: {e}"))
}

/// True for responses that indicate the Access session was rejected/expired
/// (a 401/403, or a redirect to the identity-provider login page).
fn is_auth_failure(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::UNAUTHORIZED
        || status == reqwest::StatusCode::FORBIDDEN
        || status.is_redirection()
}

fn parse_response(text: &str) -> CmdResult<AiEditResponse> {
    let parsed: MessagesResponse = serde_json::from_str(text)
        .map_err(|e| format!("could not parse AI gateway response: {e}"))?;

    let mut edits: Vec<AiEdit> = Vec::new();
    let mut texts: Vec<String> = Vec::new();

    for block in parsed.content {
        match block {
            ContentBlock::ToolUse { name, input } if name == "apply_edits" => {
                let args: ToolArgs = serde_json::from_value(input)
                    .map_err(|e| format!("could not parse edit operations from AI: {e}"))?;
                edits.extend(args.edits);
            }
            ContentBlock::Text { text } if !text.trim().is_empty() => texts.push(text),
            _ => {}
        }
    }

    let message = (!texts.is_empty()).then(|| texts.join("\n\n"));

    if edits.is_empty() && message.is_none() {
        return Err("The AI returned no edits.".to_string());
    }

    Ok(AiEditResponse { edits, message })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Send a note + instruction to the AI gateway and return structured edits.
#[tauri::command]
pub async fn ai_edit(state: State<'_, AppState>, req: AiEditRequest) -> CmdResult<AiEditResponse> {
    let cfg = read_ai_config(&state)?;
    let body = request_body(&cfg, &req);
    let client = http_client()?;

    // First attempt with any cached token, then retry once with a fresh login
    // if the Access session was rejected.
    let mut token = access::get_token(&cfg.base_url, false).await?;
    let mut resp = send(&client, &cfg, &body, &token).await?;

    if is_auth_failure(resp.status()) {
        token = access::get_token(&cfg.base_url, true).await?;
        resp = send(&client, &cfg, &body, &token).await?;
    }

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("could not read AI gateway response: {e}"))?;

    if is_auth_failure(status) {
        return Err("Cloudflare Access rejected the session. Please sign in again.".to_string());
    }
    if !status.is_success() {
        return Err(format!(
            "AI gateway returned {}: {}",
            status.as_u16(),
            text.chars().take(300).collect::<String>()
        ));
    }

    parse_response(&text)
}

/// List the Anthropic model ids the gateway advertises, by reading its config
/// catalogue at `/config/opencode.json` (the `/anthropic/v1/models` endpoint is
/// not available). Blacklisted models are filtered out.
#[tauri::command]
pub async fn ai_list_models(state: State<'_, AppState>) -> CmdResult<Vec<String>> {
    let cfg = read_ai_config(&state)?;
    let client = http_client()?;
    let url = config_url(&cfg.base_url);

    let mut token = access::get_token(&cfg.base_url, false).await?;
    let mut resp = send_get(&client, &url, &cfg, &token).await?;

    if is_auth_failure(resp.status()) {
        token = access::get_token(&cfg.base_url, true).await?;
        resp = send_get(&client, &url, &cfg, &token).await?;
    }

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("could not read AI gateway response: {e}"))?;

    if is_auth_failure(status) {
        return Err("Cloudflare Access rejected the session. Please sign in again.".to_string());
    }
    if !status.is_success() {
        return Err(format!(
            "AI gateway returned {}: {}",
            status.as_u16(),
            text.chars().take(300).collect::<String>()
        ));
    }

    let root: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("could not parse gateway config: {e}"))?;
    let anthropic = &root["provider"]["anthropic"];

    let blacklist: std::collections::HashSet<&str> = anthropic["blacklist"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
        .unwrap_or_default();

    let mut ids: Vec<String> = anthropic["models"]
        .as_object()
        .map(|m| {
            m.keys()
                .filter(|k| !blacklist.contains(k.as_str()))
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    ids.sort();
    Ok(ids)
}

/// Force an interactive Cloudflare Access sign-in for the configured gateway.
#[tauri::command]
pub async fn ai_login(state: State<'_, AppState>) -> CmdResult<()> {
    let cfg = read_ai_config(&state)?;
    access::get_token(&cfg.base_url, true).await.map(|_| ())
}

/// Report whether cloudflared is present, AI is configured, and a valid token
/// is already cached.
#[tauri::command]
pub async fn ai_auth_status(state: State<'_, AppState>) -> CmdResult<AiAuthStatus> {
    let cloudflared_available = access::is_available();
    let cfg = state.config.lock().unwrap().ai.clone();

    let (configured, signed_in) = match &cfg {
        Some(c) if !c.base_url.is_empty() && !c.model.is_empty() => {
            let signed_in = cloudflared_available && access::cached_token(&c.base_url).await.is_some();
            (true, signed_in)
        }
        _ => (false, false),
    };

    Ok(AiAuthStatus {
        cloudflared_available,
        configured,
        signed_in,
    })
}
