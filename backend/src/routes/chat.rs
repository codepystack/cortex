use axum::{
    extract::State,
    response::{IntoResponse, Response, Sse},
    Json,
};
use axum::response::sse::{Event, KeepAlive};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::AppError,
    models::{ChatRequest, ChatResponse, ChatChoice, Message, Role, StreamChunk, StreamChoice, StreamDelta, Usage},
    AppState,
};

/// POST /v1/chat/completions
pub async fn chat_completions(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Response, AppError> {
    if req.stream {
        stream_chat(state, req).await
    } else {
        non_stream_chat(state, req).await
    }
}

// ─── Non-streaming ───────────────────────────────────────────────────────────

async fn non_stream_chat(
    state: AppState,
    req: ChatRequest,
) -> Result<Response, AppError> {
    let content = dispatch_to_provider(&state, &req).await?;

    let response = ChatResponse {
        id: format!("chatcmpl-{}", Uuid::new_v4()),
        object: "chat.completion".to_string(),
        created: Utc::now().timestamp(),
        model: req.model.clone(),
        choices: vec![ChatChoice {
            index: 0,
            message: Message {
                role: Role::Assistant,
                content,
            },
            finish_reason: "stop".to_string(),
        }],
        usage: Usage {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
    };

    Ok(Json(response).into_response())
}

// ─── Streaming ───────────────────────────────────────────────────────────────

async fn stream_chat(
    state: AppState,
    req: ChatRequest,
) -> Result<Response, AppError> {
    let content = dispatch_to_provider(&state, &req).await?;
    let model = req.model.clone();
    let id = format!("chatcmpl-{}", Uuid::new_v4());

    // Simulate streaming by splitting content into words
    let words: Vec<String> = content
        .split_inclusive(' ')
        .map(|s| s.to_string())
        .collect();

    let stream = async_stream::stream! {
        let chunk_id = id.clone();
        let chunk_model = model.clone();
        let created = Utc::now().timestamp();

        // First chunk with role
        let first = StreamChunk {
            id: chunk_id.clone(),
            object: "chat.completion.chunk".to_string(),
            created,
            model: chunk_model.clone(),
            choices: vec![StreamChoice {
                index: 0,
                delta: StreamDelta {
                    role: Some(Role::Assistant),
                    content: None,
                },
                finish_reason: None,
            }],
        };
        yield Ok::<Event, std::convert::Infallible>(
            Event::default().data(serde_json::to_string(&first).unwrap())
        );

        // Content chunks
        for word in &words {
            let chunk = StreamChunk {
                id: chunk_id.clone(),
                object: "chat.completion.chunk".to_string(),
                created,
                model: chunk_model.clone(),
                choices: vec![StreamChoice {
                    index: 0,
                    delta: StreamDelta {
                        role: None,
                        content: Some(word.clone()),
                    },
                    finish_reason: None,
                }],
            };
            yield Ok::<Event, std::convert::Infallible>(
                Event::default().data(serde_json::to_string(&chunk).unwrap())
            );
        }

        // Final stop chunk
        let stop = StreamChunk {
            id: chunk_id.clone(),
            object: "chat.completion.chunk".to_string(),
            created,
            model: chunk_model.clone(),
            choices: vec![StreamChoice {
                index: 0,
                delta: StreamDelta {
                    role: None,
                    content: None,
                },
                finish_reason: Some("stop".to_string()),
            }],
        };
        yield Ok::<Event, std::convert::Infallible>(
            Event::default().data(serde_json::to_string(&stop).unwrap())
        );

        yield Ok::<Event, std::convert::Infallible>(
            Event::default().data("[DONE]")
        );
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()).into_response())
}

// ─── Provider dispatch ───────────────────────────────────────────────────────

pub(crate) async fn dispatch_to_provider(
    state: &AppState,
    req: &ChatRequest,
) -> Result<String, AppError> {
    // 1. Check statically configured providers by model name prefix.
    if req.model.starts_with("gpt-") || req.model.starts_with("o1") {
        if let Some(key) = &state.config.openai_api_key {
            return call_openai(&state.http_client, key, req).await;
        }
        return Err(AppError::BadRequest(
            "OpenAI API key not configured".to_string(),
        ));
    }

    if req.model.starts_with("claude-") {
        if let Some(key) = &state.config.anthropic_api_key {
            return call_anthropic(&state.http_client, key, req).await;
        }
        return Err(AppError::BadRequest(
            "Anthropic API key not configured".to_string(),
        ));
    }

    // 2. Local echo model for demos.
    if req.model == "cortex-echo" {
        return Ok(echo_response(req));
    }

    // 3. Check dynamically registered models in the registry.
    if let Some(registered) = state.registry.get_model(&req.model) {
        return dispatch_registered_model(state, &registered, req).await;
    }

    Err(AppError::NotFound(format!(
        "Model '{}' not found or provider not configured",
        req.model
    )))
}

/// Dispatch a request to a dynamically registered model.
async fn dispatch_registered_model(
    state: &AppState,
    model: &crate::registry::RegisteredModel,
    req: &ChatRequest,
) -> Result<String, AppError> {
    match model.provider.as_str() {
        "openai" => {
            let key = model
                .api_key
                .as_deref()
                .or(state.config.openai_api_key.as_deref())
                .ok_or_else(|| AppError::BadRequest("OpenAI API key not configured".into()))?;
            let endpoint = model
                .endpoint
                .as_deref()
                .unwrap_or("https://api.openai.com/v1/chat/completions");
            call_openai_endpoint(&state.http_client, key, endpoint, req).await
        }
        "anthropic" => {
            let key = model
                .api_key
                .as_deref()
                .or(state.config.anthropic_api_key.as_deref())
                .ok_or_else(|| AppError::BadRequest("Anthropic API key not configured".into()))?;
            call_anthropic(&state.http_client, key, req).await
        }
        "ollama" => {
            let base = model
                .endpoint
                .as_deref()
                .unwrap_or(&state.config.ollama_base_url);
            let endpoint = format!("{}/api/chat", base);
            call_ollama(&state.http_client, &endpoint, req).await
        }
        other => Err(AppError::BadRequest(format!(
            "Unknown provider '{}' for registered model '{}'",
            other, model.name
        ))),
    }
}

// ─── OpenAI proxy ────────────────────────────────────────────────────────────

async fn call_openai(
    client: &reqwest::Client,
    api_key: &str,
    req: &ChatRequest,
) -> Result<String, AppError> {
    call_openai_endpoint(
        client,
        api_key,
        "https://api.openai.com/v1/chat/completions",
        req,
    )
    .await
}

async fn call_openai_endpoint(
    client: &reqwest::Client,
    api_key: &str,
    endpoint: &str,
    req: &ChatRequest,
) -> Result<String, AppError> {
    let body = json!({
        "model": req.model,
        "messages": req.messages,
        "temperature": req.temperature.unwrap_or(0.7),
        "max_tokens": req.max_tokens,
        "stream": false,
    });

    let resp = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::ProviderError(e.to_string()))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::ProviderError(format!("OpenAI error: {text}")));
    }

    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::ProviderError(e.to_string()))?;

    Ok(value["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

// ─── Anthropic proxy ─────────────────────────────────────────────────────────

async fn call_anthropic(
    client: &reqwest::Client,
    api_key: &str,
    req: &ChatRequest,
) -> Result<String, AppError> {
    // Separate system message from conversation messages
    let system_msg: Option<String> = req.messages.iter().find_map(|m| {
        if matches!(m.role, Role::System) {
            Some(m.content.clone())
        } else {
            None
        }
    });

    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .filter(|m| !matches!(m.role, Role::System))
        .map(|m| {
            json!({
                "role": match m.role { Role::User => "user", _ => "assistant" },
                "content": m.content,
            })
        })
        .collect();

    let mut body = json!({
        "model": req.model,
        "messages": messages,
        "max_tokens": req.max_tokens.unwrap_or(1024),
    });

    if let Some(sys) = system_msg {
        body["system"] = json!(sys);
    }

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::ProviderError(e.to_string()))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::ProviderError(format!("Anthropic error: {text}")));
    }

    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::ProviderError(e.to_string()))?;

    Ok(value["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

// ─── Ollama proxy ─────────────────────────────────────────────────────────────

async fn call_ollama(
    client: &reqwest::Client,
    endpoint: &str,
    req: &ChatRequest,
) -> Result<String, AppError> {
    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .map(|m| {
            json!({
                "role": match m.role {
                    Role::System => "system",
                    Role::User => "user",
                    Role::Assistant => "assistant",
                    Role::Tool => "tool",
                },
                "content": m.content,
            })
        })
        .collect();

    let body = json!({
        "model": req.model,
        "messages": messages,
        "stream": false,
    });

    let resp = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::ProviderError(e.to_string()))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::ProviderError(format!("Ollama error: {text}")));
    }

    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::ProviderError(e.to_string()))?;

    Ok(value["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

// ─── Local echo ──────────────────────────────────────────────────────────────

fn echo_response(req: &ChatRequest) -> String {
    if let Some(last) = req.messages.last() {
        format!("Echo: {}", last.content)
    } else {
        "Hello from Cortex AI Platform!".to_string()
    }
}
