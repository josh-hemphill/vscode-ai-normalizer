mod adapters;
mod config;
mod openai;
mod profiles;
mod router;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use config::{AppState, ProxyConfigPayload};
use openai::{ChatCompletionRequest, ModelsListResponse, ModelObject};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use tracing::info;

#[derive(Clone)]
struct SharedState {
    inner: Arc<RwLock<AppState>>,
    client: reqwest::Client,
}

fn stderr_uses_ansi() -> bool {
    if std::env::var_os("NO_COLOR").is_some() {
        return false;
    }
    std::io::IsTerminal::is_terminal(&std::io::stderr())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_ansi(stderr_uses_ansi())
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let port: u16 = std::env::var("AI_NORMALIZER_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3847);
    let payload = load_initial_payload();
    let app_state = AppState::from_payload(payload);

    let shared = SharedState {
        inner: Arc::new(RwLock::new(app_state)),
        client: reqwest::Client::new(),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/models", get(list_models))
        .route("/v1/chat/completions", post(chat_completions))
        .route("/v1/completions", post(completions_pass_through))
        .route("/admin/reload", post(admin_reload))
        .layer(TraceLayer::new_for_http())
        .with_state(shared);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    info!("normalizer-proxy listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn list_models(State(state): State<SharedState>) -> impl IntoResponse {
    let guard = state.inner.read().await;
    let mut data = Vec::new();
    for ep in &guard.endpoints {
        for m in &ep.models {
            data.push(ModelObject {
                id: m.id.clone(),
                object: "model".into(),
                owned_by: ep.id.clone(),
            });
        }
    }
    Json(ModelsListResponse {
        object: "list".into(),
        data,
    })
}

async fn chat_completions(
    State(state): State<SharedState>,
    Json(request): Json<ChatCompletionRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let guard = state.inner.read().await;
    router::route_chat(&guard, &state.client, request)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

async fn completions_pass_through(
    State(state): State<SharedState>,
    body: axum::body::Bytes,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let guard = state.inner.read().await;
    let upstream = guard
        .endpoints
        .first()
        .map(|e| e.upstream_url.replace("/chat/completions", "/completions"))
        .unwrap_or_else(|| "http://127.0.0.1/v1/completions".into());
    let mut req = state.client.post(&upstream).body(body);
    if let Some(key) = guard.endpoints.first().and_then(|e| e.api_key.clone()) {
        if !key.is_empty() {
            req = req.bearer_auth(key);
        }
    }
    let resp = req
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
    let status = resp.status();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok((status, bytes))
}

async fn admin_reload(
    State(state): State<SharedState>,
    Json(payload): Json<ProxyConfigPayload>,
) -> impl IntoResponse {
    let next = AppState::from_payload(payload);
    let mut guard = state.inner.write().await;
    *guard = next;
    Json(serde_json::json!({ "reloaded": true }))
}

fn load_initial_payload() -> ProxyConfigPayload {
    if let Ok(path) = std::env::var("AI_NORMALIZER_CONFIG_PATH") {
        match std::fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str(&text) {
                Ok(payload) => return payload,
                Err(err) => tracing::error!("invalid config at {path}: {err}"),
            },
            Err(err) => tracing::error!("failed to read config at {path}: {err}"),
        }
    }
    let config_json = std::env::var("AI_NORMALIZER_CONFIG").unwrap_or_else(|_| "{}".into());
    match serde_json::from_str(&config_json) {
        Ok(payload) => payload,
        Err(err) => {
            tracing::error!("invalid AI_NORMALIZER_CONFIG json: {err}");
            ProxyConfigPayload::default()
        }
    }
}

impl Default for ProxyConfigPayload {
    fn default() -> Self {
        Self {
            profiles: std::collections::HashMap::new(),
            endpoints: vec![],
        }
    }
}
