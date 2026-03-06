use axum::{extract::State, response::IntoResponse, Json};
use serde_json::json;

use crate::{error::AppError, AppState};

/// GET /v1/models
///
/// Returns a list of available AI models, sourced from configured providers.
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

    Ok(Json(json!({
        "object": "list",
        "data": models,
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
