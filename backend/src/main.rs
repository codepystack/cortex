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
mod registry;
mod routes;

use auth::User;
use config::Config;
use registry::Registry;

// ─── Application state ───────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub http_client: reqwest::Client,
    /// Simple in-memory user store – swap for a real DB in production.
    pub user_store: Arc<Mutex<Vec<User>>>,
    /// Central resource registry (models, tools, agents, workflows, MCP, memory).
    pub registry: Registry,
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
            registry: Registry::new(),
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
        // AI / chat routes
        .route("/v1/models", get(routes::models::list_models))
        .route("/v1/models/register", post(routes::models::register_model))
        .route(
            "/v1/chat/completions",
            post(routes::chat::chat_completions),
        )
        // Tools
        .route("/v1/tools", get(routes::tools::list_tools))
        .route("/v1/tools/run", post(routes::tools::run_tool))
        // Agents
        .route("/v1/agents", get(routes::agents::list_agents))
        .route("/v1/agents/register", post(routes::agents::register_agent))
        .route("/v1/agents/run", post(routes::agents::run_agent))
        // Workflows
        .route("/v1/workflows", get(routes::workflows::list_workflows))
        .route(
            "/v1/workflows/register",
            post(routes::workflows::register_workflow),
        )
        .route("/v1/workflow/run", post(routes::workflows::run_workflow))
        // MCP
        .route("/v1/mcp", get(routes::mcp::list_mcp_servers))
        .route("/v1/mcp/register", post(routes::mcp::register_mcp_server))
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

    // ── New platform tests ───────────────────────────────────────────────────

    #[tokio::test]
    async fn register_model_and_appears_in_list() {
        let server = test_server();
        let resp = server
            .post("/v1/models/register")
            .json(&json!({
                "name": "my-ollama",
                "provider": "ollama",
                "endpoint": "http://localhost:11434",
                "description": "Local Llama model"
            }))
            .await;
        resp.assert_status_ok();

        let list = server.get("/v1/models").await;
        list.assert_status_ok();
        let body: serde_json::Value = list.json();
        let ids: Vec<&str> = body["data"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m["id"].as_str().unwrap())
            .collect();
        assert!(ids.contains(&"my-ollama"));
    }

    #[tokio::test]
    async fn list_tools_returns_builtins() {
        let server = test_server();
        let resp = server.get("/v1/tools").await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        let names: Vec<&str> = body["tools"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["name"].as_str().unwrap())
            .collect();
        assert!(names.contains(&"echo"));
        assert!(names.contains(&"calculator"));
        assert!(names.contains(&"http_request"));
    }

    #[tokio::test]
    async fn run_echo_tool() {
        let server = test_server();
        let resp = server
            .post("/v1/tools/run")
            .json(&json!({
                "tool": "echo",
                "args": { "message": "ping" }
            }))
            .await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert_eq!(body["output"]["message"], "ping");
    }

    #[tokio::test]
    async fn run_unknown_tool_is_not_found() {
        let server = test_server();
        let resp = server
            .post("/v1/tools/run")
            .json(&json!({
                "tool": "nonexistent_tool",
                "args": {}
            }))
            .await;
        resp.assert_status_not_found();
    }

    #[tokio::test]
    async fn register_agent_and_list() {
        let server = test_server();
        let resp = server
            .post("/v1/agents/register")
            .json(&json!({
                "name": "test-agent",
                "description": "A test agent",
                "model": "cortex-echo",
                "tools": ["echo"],
                "system_prompt": "You are a helpful assistant."
            }))
            .await;
        resp.assert_status_ok();

        let list = server.get("/v1/agents").await;
        list.assert_status_ok();
        let body: serde_json::Value = list.json();
        let names: Vec<&str> = body["agents"]
            .as_array()
            .unwrap()
            .iter()
            .map(|a| a["name"].as_str().unwrap())
            .collect();
        assert!(names.contains(&"test-agent"));
    }

    #[tokio::test]
    async fn run_agent_with_echo_model() {
        let server = test_server();

        // Register agent first
        server
            .post("/v1/agents/register")
            .json(&json!({
                "name": "echo-agent",
                "description": "Echo agent",
                "model": "cortex-echo",
                "tools": [],
                "system_prompt": null
            }))
            .await;

        let resp = server
            .post("/v1/agents/run")
            .json(&json!({
                "agent": "echo-agent",
                "input": "Hello from agent test"
            }))
            .await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert!(body["output"].is_string());
    }

    #[tokio::test]
    async fn register_workflow_and_list() {
        let server = test_server();
        let resp = server
            .post("/v1/workflows/register")
            .json(&json!({
                "name": "simple-pipeline",
                "description": "A simple test workflow",
                "nodes": [
                    { "id": "n1", "kind": "input", "config": {} },
                    { "id": "n2", "kind": "llm", "config": { "model": "cortex-echo" } },
                    { "id": "n3", "kind": "output", "config": {} }
                ]
            }))
            .await;
        resp.assert_status_ok();

        let list = server.get("/v1/workflows").await;
        list.assert_status_ok();
        let body: serde_json::Value = list.json();
        let names: Vec<&str> = body["workflows"]
            .as_array()
            .unwrap()
            .iter()
            .map(|w| w["name"].as_str().unwrap())
            .collect();
        assert!(names.contains(&"simple-pipeline"));
    }

    #[tokio::test]
    async fn run_workflow() {
        let server = test_server();

        // Register first
        server
            .post("/v1/workflows/register")
            .json(&json!({
                "name": "echo-workflow",
                "description": "Workflow that echoes input",
                "nodes": [
                    { "id": "n1", "kind": "input", "config": {} },
                    { "id": "n2", "kind": "llm", "config": { "model": "cortex-echo" } },
                    { "id": "n3", "kind": "output", "config": {} }
                ]
            }))
            .await;

        let resp = server
            .post("/v1/workflow/run")
            .json(&json!({
                "workflow": "echo-workflow",
                "input": "Workflow test input"
            }))
            .await;
        resp.assert_status_ok();
        let body: serde_json::Value = resp.json();
        assert!(body["output"].is_string());
    }

    #[tokio::test]
    async fn register_mcp_server_and_list() {
        let server = test_server();
        let resp = server
            .post("/v1/mcp/register")
            .json(&json!({
                "name": "github-mcp",
                "url": "http://localhost:3100",
                "description": "GitHub MCP server",
                "tools": ["github_search", "github_read_file"]
            }))
            .await;
        resp.assert_status_ok();

        let list = server.get("/v1/mcp").await;
        list.assert_status_ok();
        let body: serde_json::Value = list.json();
        let names: Vec<&str> = body["servers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| s["name"].as_str().unwrap())
            .collect();
        assert!(names.contains(&"github-mcp"));

        // Tools from MCP should now appear in the tool list
        let tools = server.get("/v1/tools").await;
        let tools_body: serde_json::Value = tools.json();
        let tool_names: Vec<&str> = tools_body["tools"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["name"].as_str().unwrap())
            .collect();
        assert!(tool_names.contains(&"github_search"));
    }
}
