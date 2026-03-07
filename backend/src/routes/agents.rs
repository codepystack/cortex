use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{
    error::AppError,
    models::{ChatRequest, Message, Role},
    registry::RegisteredAgent,
    routes::chat::dispatch_to_provider,
    AppState,
};

/// GET /v1/agents
///
/// List all registered agents.
pub async fn list_agents(State(state): State<AppState>) -> impl IntoResponse {
    let agents = state.registry.list_agents();
    Json(json!({ "agents": agents }))
}

// ─── Register agent ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub name: String,
    pub description: String,
    pub model: String,
    pub tools: Vec<String>,
    pub system_prompt: Option<String>,
}

/// POST /v1/agents/register
///
/// Register a new agent definition at runtime.
pub async fn register_agent(
    State(state): State<AppState>,
    Json(req): Json<RegisterAgentRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.name.is_empty() {
        return Err(AppError::BadRequest("Agent name is required".into()));
    }
    if req.model.is_empty() {
        return Err(AppError::BadRequest("Agent model is required".into()));
    }

    let agent = RegisteredAgent {
        name: req.name.clone(),
        description: req.description.clone(),
        model: req.model.clone(),
        tools: req.tools.clone(),
        system_prompt: req.system_prompt.clone(),
    };

    state.registry.register_agent(agent);

    tracing::info!(agent = %req.name, model = %req.model, "Agent registered");

    Ok(Json(json!({
        "status": "registered",
        "name": req.name,
        "model": req.model,
    })))
}

// ─── Run agent ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RunAgentRequest {
    /// Name of a registered agent to use.
    pub agent: String,
    /// The user's input message.
    pub input: String,
    /// Optional session ID for persistent conversation memory.
    pub session_id: Option<String>,
}

/// POST /v1/agents/run
///
/// Run a registered agent with the given input.
///
/// Implements a simplified ReAct-style reasoning loop:
/// 1. Build context from conversation memory + system prompt.
/// 2. Call the agent's configured LLM.
/// 3. Store the exchange in memory.
/// 4. Return the response.
pub async fn run_agent(
    State(state): State<AppState>,
    Json(req): Json<RunAgentRequest>,
) -> Result<impl IntoResponse, AppError> {
    let agent = state
        .registry
        .get_agent(&req.agent)
        .ok_or_else(|| AppError::NotFound(format!("Agent '{}' not found", req.agent)))?;

    let session_id = req
        .session_id
        .clone()
        .unwrap_or_else(|| format!("agent-{}", uuid::Uuid::new_v4()));

    // Build message list
    let mut messages: Vec<Message> = Vec::new();

    // System prompt
    if let Some(sys) = &agent.system_prompt {
        messages.push(Message {
            role: Role::System,
            content: sys.clone(),
        });
    }

    // Replay conversation memory for this session
    for entry in state.registry.get_memory(&session_id) {
        let role = match entry.role.as_str() {
            "assistant" => Role::Assistant,
            "system" => Role::System,
            _ => Role::User,
        };
        messages.push(Message {
            role,
            content: entry.content,
        });
    }

    // Current user input
    messages.push(Message {
        role: Role::User,
        content: req.input.clone(),
    });

    let chat_req = ChatRequest {
        model: agent.model.clone(),
        messages,
        stream: false,
        temperature: Some(0.7),
        max_tokens: None,
    };

    let output = dispatch_to_provider(&state, &chat_req).await?;

    // Persist to memory
    state.registry.append_memory(
        &session_id,
        crate::registry::MemoryEntry {
            role: "user".to_string(),
            content: req.input.clone(),
        },
    );
    state.registry.append_memory(
        &session_id,
        crate::registry::MemoryEntry {
            role: "assistant".to_string(),
            content: output.clone(),
        },
    );

    tracing::info!(agent = %req.agent, session = %session_id, "Agent run completed");

    Ok(Json(json!({
        "agent": req.agent,
        "session_id": session_id,
        "output": output,
        "tools_available": agent.tools,
    })))
}
