//! Cloudflare Access authentication via the `cloudflared` CLI.
//!
//! The AI Gateway is fronted by Cloudflare Access (Zero Trust). The only
//! runtime credential we need is an Access session JWT, which is minted by an
//! interactive browser SSO flow (including hardware-key / WebAuthn). Because
//! embedded WebViews cannot reliably perform WebAuthn on Linux, we drive the
//! user's real system browser through `cloudflared access`, then attach the
//! resulting JWT to gateway requests as the `cf-access-token` header.

use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

/// Interactive browser login can take a while (SSO + hardware key).
const LOGIN_TIMEOUT: Duration = Duration::from_secs(300);

/// True when the `cloudflared` binary is available on PATH.
pub fn is_available() -> bool {
    std::process::Command::new("cloudflared")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// A cloudflared token value looks like a JWT: three dot-separated,
/// url-safe-base64 segments and no whitespace. This filters out the various
/// human-readable error strings cloudflared prints to stdout on some versions.
fn looks_like_jwt(s: &str) -> bool {
    let s = s.trim();
    !s.is_empty()
        && !s.contains(char::is_whitespace)
        && s.matches('.').count() == 2
        && s
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

/// Return a cached Access JWT for `app_url`, if one exists and is unexpired.
pub async fn cached_token(app_url: &str) -> Option<String> {
    let out = Command::new("cloudflared")
        .args(["access", "token", "--app", app_url])
        .output()
        .await
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let tok = String::from_utf8_lossy(&out.stdout).trim().to_string();
    looks_like_jwt(&tok).then_some(tok)
}

/// Run the interactive browser login flow and return the freshly minted JWT.
/// This opens the user's system browser and blocks until they complete SSO.
pub async fn login(app_url: &str) -> Result<String, String> {
    let fut = Command::new("cloudflared")
        .args([
            "access",
            "login",
            "--no-verbose",
            "--auto-close",
            "--app",
            app_url,
        ])
        .output();

    let out = timeout(LOGIN_TIMEOUT, fut)
        .await
        .map_err(|_| "Cloudflare sign-in timed out. Please try again.".to_string())?
        .map_err(|e| format!("failed to launch cloudflared: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("cloudflared login failed: {}", stderr.trim()));
    }

    // With `--no-verbose`, cloudflared prints only the JWT to stdout.
    let tok = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if looks_like_jwt(&tok) {
        return Ok(tok);
    }

    // Some versions still cache the token but don't echo it cleanly; fall back
    // to reading it back.
    cached_token(app_url)
        .await
        .ok_or_else(|| "Signed in, but could not read the Access token from cloudflared.".to_string())
}

/// Obtain a valid Access JWT for `app_url`, triggering an interactive login
/// only when no valid cached token is available.
///
/// When `force` is set, any cached token is ignored and a fresh login is run
/// (used to recover from an expired/rejected token).
pub async fn get_token(app_url: &str, force: bool) -> Result<String, String> {
    if !is_available() {
        return Err(
            "cloudflared is not installed or not on your PATH. Install it from \
             https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ \
             to sign in to Cloudflare Access."
                .to_string(),
        );
    }

    if !force {
        if let Some(tok) = cached_token(app_url).await {
            return Ok(tok);
        }
    }

    login(app_url).await
}
