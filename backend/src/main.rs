use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::{
    cors::{Any, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod auth;
mod config;
mod error;
mod models;
mod routes;

use auth::User;
use config::Config;

// ─── Application state ───────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub http_client: reqwest::Client,
    /// Simple in-memory user store – swap for a real DB in production.
    pub user_store: Arc<Mutex<Vec<User>>>,
}

impl AppState {
    fn new(config: Config) -> Self {
        AppState {
            config: Arc::new(config),
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("Failed to build HTTP client"),
            user_store: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

// ─── Router ──────────────────────────────────────────────────────────────────

fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health
        .route("/health", get(routes::health::health_check))
        // AI routes
        .route("/v1/models", get(routes::models::list_models))
        .route(
            "/v1/chat/completions",
            post(routes::chat::chat_completions),
        )
        // Auth routes
        .route("/v1/auth/register", post(routes::auth::register))
        .route("/v1/auth/login", post(routes::auth::login))
        .route("/v1/auth/me", get(routes::auth::me))
        // Middleware
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT,
            std::time::Duration::from_secs(120),
        ))
        .with_state(state)
}

// ─── Entry point ─────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("Invalid address");

    let state = AppState::new(config);
    let app = build_router(state);

    tracing::info!("Cortex backend listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use serde_json::json;

    fn test_state() -> AppState {
        AppState::new(Config::from_env())
    }

    fn test_server() -> TestServer {
        let state = test_state();
        let app = build_router(state);
        TestServer::new(app).unwrap()
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let server = test_server();
        let resp = server.get("/health").await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert_eq!(body["status"], "ok");
    }

    #[tokio::test]
    async fn list_models_returns_list() {
        let server = test_server();
        let resp = server.get("/v1/models").await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert_eq!(body["object"], "list");
        let ids: Vec<&str> = body["data"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m["id"].as_str().unwrap())
            .collect();
        assert!(ids.contains(&"cortex-echo"));
    }

    #[tokio::test]
    async fn register_and_login() {
        let server = test_server();

        let reg = server
            .post("/v1/auth/register")
            .json(&json!({"email": "test@example.com", "password": "password123"}))
            .await;
        reg.assert_status_ok();
        let reg_body: serde_json::Value = reg.json();
        assert!(reg_body["token"].is_string());

        let login = server
            .post("/v1/auth/login")
            .json(&json!({"email": "test@example.com", "password": "password123"}))
            .await;
        login.assert_status_ok();
        let login_body: serde_json::Value = login.json();
        assert!(login_body["token"].is_string());
    }

    #[tokio::test]
    async fn duplicate_register_fails() {
        let server = test_server();
        let payload = json!({"email": "dup@example.com", "password": "password123"});
        server.post("/v1/auth/register").json(&payload).await;
        let resp = server.post("/v1/auth/register").json(&payload).await;
        resp.assert_status_bad_request();
    }

    #[tokio::test]
    async fn chat_with_echo_model() {
        let server = test_server();
        let resp = server
            .post("/v1/chat/completions")
            .json(&json!({
                "model": "cortex-echo",
                "messages": [{"role": "user", "content": "Hello!"}],
                "stream": false
            }))
            .await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert_eq!(body["choices"][0]["message"]["role"], "assistant");
        assert!(body["choices"][0]["message"]["content"]
            .as_str()
            .unwrap()
            .contains("Hello!"));
    }

    #[tokio::test]
    async fn chat_with_unknown_model_fails() {
        let server = test_server();
        let resp = server
            .post("/v1/chat/completions")
            .json(&json!({
                "model": "not-a-real-model",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": false
            }))
            .await;
        resp.assert_status_not_found();
    }

    #[tokio::test]
    async fn login_wrong_password_is_unauthorized() {
        let server = test_server();
        server
            .post("/v1/auth/register")
            .json(&json!({"email": "u@example.com", "password": "correct-password"}))
            .await;
        let resp = server
            .post("/v1/auth/login")
            .json(&json!({"email": "u@example.com", "password": "wrong-password"}))
            .await;
        resp.assert_status_unauthorized();
    }
}
