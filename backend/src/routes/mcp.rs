use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{error::AppError, registry::RegisteredMcpServer, AppState};

/// GET /v1/mcp
///
/// List all registered MCP servers.
pub async fn list_mcp_servers(State(state): State<AppState>) -> impl IntoResponse {
    let servers = state.registry.list_mcp_servers();
    Json(json!({ "servers": servers }))
}

// ─── Register MCP server ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterMcpServerRequest {
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    /// Tools exposed by this MCP server.
    pub tools: Vec<String>,
}

/// POST /v1/mcp/register
///
/// Register an MCP server at runtime. All tools advertised by the server are
/// automatically added to the tool registry so agents can use them.
pub async fn register_mcp_server(
    State(state): State<AppState>,
    Json(req): Json<RegisterMcpServerRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.name.is_empty() {
        return Err(AppError::BadRequest("MCP server name is required".into()));
    }
    if req.url.is_empty() {
        return Err(AppError::BadRequest("MCP server URL is required".into()));
    }

    let tool_count = req.tools.len();
    let server = RegisteredMcpServer {
        name: req.name.clone(),
        url: req.url.clone(),
        description: req.description,
        tools: req.tools,
    };

    state.registry.register_mcp_server(server);

    tracing::info!(
        server = %req.name,
        url = %req.url,
        tools = tool_count,
        "MCP server registered"
    );

    Ok(Json(json!({
        "status": "registered",
        "name": req.name,
        "url": req.url,
        "tools_registered": tool_count,
    })))
}
