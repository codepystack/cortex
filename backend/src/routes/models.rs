use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{
    error::AppError,
    registry::RegisteredModel,
    AppState,
};

/// GET /v1/models
///
/// Returns the union of statically configured models (from API keys) and any
/// dynamically registered models from the runtime registry.
pub async fn list_models(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let mut models = Vec::new();

    // OpenAI models (only if key is set)
    if state.config.openai_api_key.is_some() {
        models.extend([
            build_model("gpt-4o", "openai", "OpenAI GPT-4o"),
            build_model("gpt-4o-mini", "openai", "OpenAI GPT-4o Mini"),
            build_model("gpt-4-turbo", "openai", "OpenAI GPT-4 Turbo"),
            build_model("gpt-3.5-turbo", "openai", "OpenAI GPT-3.5 Turbo"),
        ]);
    }

    // Anthropic models (only if key is set)
    if state.config.anthropic_api_key.is_some() {
        models.extend([
            build_model("claude-3-5-sonnet-20241022", "anthropic", "Claude 3.5 Sonnet"),
            build_model("claude-3-5-haiku-20241022", "anthropic", "Claude 3.5 Haiku"),
            build_model("claude-3-opus-20240229", "anthropic", "Claude 3 Opus"),
        ]);
    }

    // Always include a local/mock model for testing without API keys
    models.push(build_model("cortex-echo", "local", "Cortex Echo (demo)"));

    // Dynamically registered models from the registry
    for m in state.registry.list_registered_models() {
        models.push(json!({
            "id": m.name,
            "object": "model",
            "created": 1_700_000_000u64,
            "owned_by": m.provider,
            "display_name": m.description.unwrap_or_else(|| m.provider.clone()),
        }));
    }

    Ok(Json(json!({
        "object": "list",
        "data": models,
    })))
}

// ─── Register model ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterModelRequest {
    pub name: String,
    pub provider: String,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub description: Option<String>,
}

/// POST /v1/models/register
///
/// Dynamically register a new model at runtime without restarting the server.
/// Supports providers: openai, anthropic, ollama, custom.
pub async fn register_model(
    State(state): State<AppState>,
    Json(req): Json<RegisterModelRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.name.is_empty() {
        return Err(AppError::BadRequest("Model name is required".into()));
    }
    if req.provider.is_empty() {
        return Err(AppError::BadRequest("Provider is required".into()));
    }

    let model = RegisteredModel {
        name: req.name.clone(),
        provider: req.provider.clone(),
        endpoint: req.endpoint,
        api_key: req.api_key,
        description: req.description,
    };

    state.registry.register_model(model);

    tracing::info!(model = %req.name, provider = %req.provider, "Model registered");

    Ok(Json(json!({
        "status": "registered",
        "name": req.name,
        "provider": req.provider,
    })))
}

fn build_model(id: &str, owned_by: &str, display_name: &str) -> serde_json::Value {
    json!({
        "id": id,
        "object": "model",
        "created": 1_700_000_000u64,
        "owned_by": owned_by,
        "display_name": display_name,
    })
}
