use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{
    error::AppError,
    models::{ChatRequest, Message, Role},
    registry::{RegisteredWorkflow, WorkflowNodeDef},
    routes::chat::dispatch_to_provider,
    AppState,
};

/// GET /v1/workflows
///
/// List all registered workflows.
pub async fn list_workflows(State(state): State<AppState>) -> impl IntoResponse {
    let workflows = state.registry.list_workflows();
    Json(json!({ "workflows": workflows }))
}

// ─── Register workflow ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterWorkflowRequest {
    pub name: String,
    pub description: String,
    pub nodes: Vec<WorkflowNodeDef>,
}

/// POST /v1/workflows/register
///
/// Register a new workflow definition at runtime.
pub async fn register_workflow(
    State(state): State<AppState>,
    Json(req): Json<RegisterWorkflowRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.name.is_empty() {
        return Err(AppError::BadRequest("Workflow name is required".into()));
    }
    if req.nodes.is_empty() {
        return Err(AppError::BadRequest(
            "Workflow must have at least one node".into(),
        ));
    }

    let workflow = RegisteredWorkflow {
        name: req.name.clone(),
        description: req.description.clone(),
        nodes: req.nodes,
    };

    state.registry.register_workflow(workflow);

    tracing::info!(workflow = %req.name, "Workflow registered");

    Ok(Json(json!({
        "status": "registered",
        "name": req.name,
    })))
}

// ─── Run workflow ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RunWorkflowRequest {
    /// Name of a registered workflow to execute.
    pub workflow: String,
    /// Initial input to the workflow.
    pub input: String,
}

/// POST /v1/workflow/run
///
/// Execute a registered workflow.
///
/// Each workflow is a sequence of nodes:
/// - `input`     – initialises the state with the user's input.
/// - `llm`       – calls an LLM model; uses the `model` field from `config`.
/// - `tool`      – invokes a registered tool; uses `tool` field from `config`.
/// - `transform` – applies a simple string transformation.
/// - `output`    – finalises and returns the current state.
pub async fn run_workflow(
    State(state): State<AppState>,
    Json(req): Json<RunWorkflowRequest>,
) -> Result<impl IntoResponse, AppError> {
    let workflow = state
        .registry
        .get_workflow(&req.workflow)
        .ok_or_else(|| AppError::NotFound(format!("Workflow '{}' not found", req.workflow)))?;

    let mut current_value = req.input.clone();

    for node in &workflow.nodes {
        current_value = execute_node(node, &current_value, &state).await?;
    }

    tracing::info!(workflow = %req.workflow, "Workflow run completed");

    Ok(Json(json!({
        "workflow": req.workflow,
        "input": req.input,
        "output": current_value,
    })))
}

// ─── Node execution ───────────────────────────────────────────────────────────

async fn execute_node(
    node: &WorkflowNodeDef,
    state_value: &str,
    app_state: &AppState,
) -> Result<String, AppError> {
    match node.kind.as_str() {
        "input" => {
            // Input node: just passes through the initial value.
            Ok(state_value.to_string())
        }

        "output" => {
            // Output node: finalises the value.
            Ok(state_value.to_string())
        }

        "llm" => {
            // LLM node: call the configured model with the current state as prompt.
            let model = node.config["model"]
                .as_str()
                .unwrap_or("cortex-echo")
                .to_string();

            let system_prompt = node.config["system_prompt"].as_str();

            let mut messages: Vec<Message> = Vec::new();
            if let Some(sys) = system_prompt {
                messages.push(Message {
                    role: Role::System,
                    content: sys.to_string(),
                });
            }
            messages.push(Message {
                role: Role::User,
                content: state_value.to_string(),
            });

            let chat_req = ChatRequest {
                model,
                messages,
                stream: false,
                temperature: Some(0.7),
                max_tokens: None,
            };

            dispatch_to_provider(app_state, &chat_req).await
        }

        "tool" => {
            // Tool node: run the specified tool with the current state as the
            // primary argument.
            let tool_name = node.config["tool"]
                .as_str()
                .ok_or_else(|| AppError::BadRequest("Tool node missing 'tool' field".into()))?;

            // Build args: merge config args with state value
            let mut args = node.config["args"].clone();
            if args.is_null() {
                args = serde_json::json!({});
            }

            // Check if tool exists
            app_state
                .registry
                .get_tool(tool_name)
                .ok_or_else(|| AppError::NotFound(format!("Tool '{}' not found", tool_name)))?;

            // Inject current pipeline state into the argument field specified by
            // "input_arg" in the node config (defaults to "message" if unset).
            let input_arg = node.config["input_arg"].as_str().unwrap_or("message");
            if args[input_arg].is_null() {
                args[input_arg] = serde_json::json!(state_value);
            }

            let result =
                crate::routes::tools::execute_tool_internal(tool_name, &args, app_state).await?;

            Ok(result.to_string())
        }

        "transform" => {
            // Transform node: apply a simple string operation.
            let op = node.config["op"].as_str().unwrap_or("passthrough");
            match op {
                "uppercase" => Ok(state_value.to_uppercase()),
                "lowercase" => Ok(state_value.to_lowercase()),
                "trim" => Ok(state_value.trim().to_string()),
                "prefix" => {
                    let prefix = node.config["value"].as_str().unwrap_or("");
                    Ok(format!("{prefix}{state_value}"))
                }
                "suffix" => {
                    let suffix = node.config["value"].as_str().unwrap_or("");
                    Ok(format!("{state_value}{suffix}"))
                }
                _ => Ok(state_value.to_string()),
            }
        }

        unknown => Err(AppError::BadRequest(format!(
            "Unknown workflow node kind: '{unknown}'"
        ))),
    }
}
