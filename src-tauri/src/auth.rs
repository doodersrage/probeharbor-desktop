use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

use crate::open_url::open_https_url;

const API_BASE: &str = "https://thermaltrace.dev";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTokens {
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse {
    pub status: u16,
    pub body: String,
    pub location: Option<String>,
}

fn session_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("config dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("create config dir: {e}"))?;
    Ok(dir.join("session.json"))
}

pub fn load_session(app: &AppHandle) -> Option<SessionTokens> {
    let path = session_path(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save_session(app: &AppHandle, tokens: &SessionTokens) -> Result<(), String> {
    let path = session_path(app)?;
    let raw = serde_json::to_string_pretty(tokens).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

pub fn clear_session(app: &AppHandle) -> Result<(), String> {
    let path = session_path(app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len() * 3);
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hex = &value[i + 1..i + 3];
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    out.push(byte);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_exchange_from_request(request: &str) -> Option<String> {
    let (headers, body) = request
        .split_once("\r\n\r\n")
        .or_else(|| request.split_once("\n\n"))
        .unwrap_or((request, ""));

    let first = headers.lines().next()?;
    let path = first.split_whitespace().nth(1)?;

    if let Some(query) = path.split('?').nth(1) {
        for pair in query.split('&') {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?;
            let value = parts.next().unwrap_or("");
            if key == "exchange" {
                return Some(percent_decode(value));
            }
        }
    }

    for pair in body.split('&') {
        let mut parts = pair.splitn(2, '=');
        let key = parts.next()?;
        let value = parts.next().unwrap_or("");
        if key == "exchange" {
            return Some(percent_decode(value.trim()));
        }
    }

    None
}

fn read_http_request(stream: &mut std::net::TcpStream) -> Result<String, String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(15)))
        .ok();

    let mut data = Vec::with_capacity(64 * 1024);
    let mut buf = [0u8; 16 * 1024];
    loop {
        let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        data.extend_from_slice(&buf[..n]);
        if data.len() > 512 * 1024 {
            return Err("Browser return request too large".into());
        }
        let text = String::from_utf8_lossy(&data);
        if let Some(header_end) = text.find("\r\n\r\n").or_else(|| text.find("\n\n")) {
            let sep_len = if text[header_end..].starts_with("\r\n\r\n") {
                4
            } else {
                2
            };
            let headers = &text[..header_end];
            let mut content_length = 0usize;
            for line in headers.lines().skip(1) {
                let lower = line.to_ascii_lowercase();
                if let Some(v) = lower.strip_prefix("content-length:") {
                    content_length = v.trim().parse().unwrap_or(0);
                }
            }
            let body_start = header_end + sep_len;
            if data.len() >= body_start + content_length {
                break;
            }
        }
    }
    Ok(String::from_utf8_lossy(&data).into_owned())
}

fn wait_for_loopback_exchange(listener: TcpListener) -> Result<String, String> {
    listener
        .set_nonblocking(true)
        .map_err(|e| e.to_string())?;

    let started = std::time::Instant::now();
    let (mut stream, _) = loop {
        match listener.accept() {
            Ok(conn) => break conn,
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                if started.elapsed() > Duration::from_secs(300) {
                    return Err("Timed out waiting for browser sign-in".into());
                }
                std::thread::sleep(Duration::from_millis(200));
            }
            Err(err) => return Err(format!("waiting for browser return: {err}")),
        }
    };

    stream
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;

    let request = read_http_request(&mut stream)?;
    let exchange = parse_exchange_from_request(&request).ok_or_else(|| {
        format!(
            "Browser returned without an exchange token (received {} bytes)",
            request.len()
        )
    })?;

    let body = "<!doctype html><html><body style=\"font-family:system-ui;background:#090b0f;color:#f3f6fb;padding:2rem\"><h1>ThermalTrace connected</h1><p>You can close this tab and return to the desktop app.</p></body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    Ok(exchange)
}

async fn exchange_token(exchange: &str) -> Result<SessionTokens, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{API_BASE}/api/auth/mobile/exchange"))
        .header("Accept", "application/json")
        .json(&serde_json::json!({ "exchange_token": exchange }))
        .send()
        .await
        .map_err(|e| format!("exchange request failed: {e}"))?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("exchange failed: {body}"));
    }

    #[derive(Deserialize)]
    struct ExchangeResponse {
        access_token: String,
        refresh_token: String,
    }

    let body: ExchangeResponse = res
        .json()
        .await
        .map_err(|e| format!("exchange parse failed: {e}"))?;

    Ok(SessionTokens {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
    })
}

/// Open ThermalTrace companion sign-in and wait for the loopback handoff.
#[tauri::command]
pub async fn start_companion_login(
    app: AppHandle,
    provider: Option<String>,
) -> Result<(), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let loopback = format!("http://127.0.0.1:{port}/oauth");

    let mut start_url = format!(
        "{API_BASE}/api/auth/companion/start?client=desktop&loopback={}",
        percent_encode(&loopback)
    );
    if let Some(provider) = provider {
        let p = provider.trim().to_lowercase();
        if matches!(p.as_str(), "google" | "github" | "discord") {
            start_url.push_str("&provider=");
            start_url.push_str(&p);
        }
    }

    open_https_url(&start_url)?;

    let exchange = tauri::async_runtime::spawn_blocking(move || wait_for_loopback_exchange(listener))
        .await
        .map_err(|e| format!("login wait task failed: {e}"))??;

    let tokens = exchange_token(&exchange).await?;
    save_session(&app, &tokens)?;
    let _ = app.emit("auth://connected", ());
    Ok(())
}

#[tauri::command]
pub fn disconnect_companion(app: AppHandle) -> Result<(), String> {
    clear_session(&app)?;
    let _ = app.emit("auth://disconnected", ());
    Ok(())
}

#[tauri::command]
pub fn has_companion_session(app: AppHandle) -> bool {
    load_session(&app).is_some()
}

fn parse_method(method: &str) -> Result<reqwest::Method, String> {
    match method.trim().to_uppercase().as_str() {
        "GET" => Ok(reqwest::Method::GET),
        "POST" => Ok(reqwest::Method::POST),
        "PUT" => Ok(reqwest::Method::PUT),
        "PATCH" => Ok(reqwest::Method::PATCH),
        "DELETE" => Ok(reqwest::Method::DELETE),
        other => Err(format!("Unsupported method: {other}")),
    }
}

fn validate_api_path(path: &str) -> Result<(), String> {
    if !path.starts_with('/') {
        return Err("API path must start with /".into());
    }
    if path.contains("://") || path.contains("..") {
        return Err("Invalid API path".into());
    }
    Ok(())
}

async fn send_authed(
    tokens: &SessionTokens,
    method: reqwest::Method,
    path: &str,
    json_body: Option<&Value>,
    form_body: Option<&[(String, String)]>,
) -> Result<ApiResponse, String> {
    if tokens.access_token.is_empty() || tokens.refresh_token.is_empty() {
        return Err("Missing session tokens".into());
    }
    validate_api_path(path)?;

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    // Many dashboard routes still resolve auth from cookies (Android-style).
    // Send both Bearer companion headers and session cookies so either path works.
    let cookie = format!(
        "sb-access-token={}; sb-refresh-token={}; sb-mfa-required=0",
        tokens.access_token, tokens.refresh_token
    );

    let mut req = client
        .request(method, format!("{API_BASE}{path}"))
        .header("Accept", "application/json")
        .header(
            "Authorization",
            format!("Bearer {}", tokens.access_token),
        )
        .header("X-SB-Refresh-Token", tokens.refresh_token.as_str())
        .header("X-SB-MFA-Required", "0")
        .header("Cookie", cookie);

    if let Some(payload) = json_body {
        req = req
            .header("Content-Type", "application/json")
            .json(payload);
    } else if let Some(fields) = form_body {
        req = req
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(
                fields
                    .iter()
                    .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
                    .collect::<Vec<_>>()
                    .join("&"),
            );
    }

    let res = req
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = res.status().as_u16();
    let location = res
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let body = res.text().await.unwrap_or_default();

    if status == 401 && body.contains("MFA required") {
        return Err(
            "MFA required — finish MFA in the browser on thermaltrace.dev, then connect again"
                .into(),
        );
    }

    Ok(ApiResponse {
        status,
        body,
        location,
    })
}

/// Authenticated JSON API request. Returns status + raw body (+ Location for redirects).
#[tauri::command]
pub async fn api_request(
    app: AppHandle,
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<ApiResponse, String> {
    let tokens = load_session(&app).ok_or_else(|| "Not connected".to_string())?;
    let method = parse_method(&method)?;
    send_authed(&tokens, method, &path, body.as_ref(), None).await
}

/// Authenticated form POST (dashboard settings writes). Does not follow redirects.
#[tauri::command]
pub async fn api_form_post(
    app: AppHandle,
    path: String,
    fields: Vec<(String, String)>,
) -> Result<ApiResponse, String> {
    let tokens = load_session(&app).ok_or_else(|| "Not connected".to_string())?;
    send_authed(
        &tokens,
        reqwest::Method::POST,
        &path,
        None,
        Some(&fields),
    )
    .await
}
