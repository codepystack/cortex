use axum::{extract::State, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;

use crate::{error::AppError, AppState};

/// GET /v1/tools
///
/// List all registered tools (built-in + MCP + custom).
pub async fn list_tools(State(state): State<AppState>) -> impl IntoResponse {
    let tools = state.registry.list_tools();
    Json(json!({ "tools": tools }))
}

// ─── Run tool ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RunToolRequest {
    pub tool: String,
    pub args: serde_json::Value,
}

/// POST /v1/tools/run
///
/// Execute a registered tool by name with the given arguments.
pub async fn run_tool(
    State(state): State<AppState>,
    Json(req): Json<RunToolRequest>,
) -> Result<impl IntoResponse, AppError> {
    let _tool = state
        .registry
        .get_tool(&req.tool)
        .ok_or_else(|| AppError::NotFound(format!("Tool '{}' not found", req.tool)))?;

    let output = execute_tool_internal(&req.tool, &req.args, &state).await?;

    tracing::info!(tool = %req.tool, "Tool executed");

    Ok(Json(json!({
        "tool": req.tool,
        "output": output,
    })))
}

// ─── Internal tool executor (shared with workflow engine) ─────────────────────

/// Execute a built-in or registered tool by name and return the JSON output.
pub(crate) async fn execute_tool_internal(
    name: &str,
    args: &serde_json::Value,
    state: &AppState,
) -> Result<serde_json::Value, AppError> {
    match name {
        "echo" => {
            let message = args["message"]
                .as_str()
                .ok_or_else(|| AppError::BadRequest("Missing 'message' argument".into()))?;
            Ok(json!({ "message": message }))
        }

        "calculator" => {
            let expression = args["expression"]
                .as_str()
                .ok_or_else(|| AppError::BadRequest("Missing 'expression' argument".into()))?;
            let result = eval_arithmetic(expression)?;
            Ok(json!({ "result": result, "expression": expression }))
        }

        "http_request" => {
            let url = args["url"]
                .as_str()
                .ok_or_else(|| AppError::BadRequest("Missing 'url' argument".into()))?;
            let method = args["method"].as_str().unwrap_or("GET");

            let resp = match method.to_uppercase().as_str() {
                "POST" => {
                    let body = args["body"].as_str().unwrap_or("");
                    state
                        .http_client
                        .post(url)
                        .body(body.to_string())
                        .send()
                        .await
                }
                _ => state.http_client.get(url).send().await,
            };

            match resp {
                Ok(r) => {
                    let status = r.status().as_u16();
                    let text = r.text().await.unwrap_or_default();
                    Ok(json!({ "status": status, "body": text }))
                }
                Err(e) => Err(AppError::ProviderError(e.to_string())),
            }
        }

        other => {
            // MCP / custom tools – check source and return placeholder
            if let Some(t) = state.registry.get_tool(other) {
                if t.source.starts_with("mcp:") {
                    return Ok(json!({
                        "status": "mcp_dispatch",
                        "message": format!("Tool '{}' is provided by '{}'.", other, t.source),
                        "args": args,
                    }));
                }
            }
            Err(AppError::NotFound(format!(
                "No executor for tool '{}'",
                other
            )))
        }
    }
}

/// Very simple integer/float arithmetic evaluator for the calculator tool.
/// Supports: +, -, *, / with basic left-to-right precedence (no parentheses).
fn eval_arithmetic(expr: &str) -> Result<f64, AppError> {
    let tokens: Vec<&str> = expr.split_whitespace().collect();
    if tokens.is_empty() {
        return Err(AppError::BadRequest("Empty expression".into()));
    }

    let parse = |s: &str| -> Result<f64, AppError> {
        s.parse::<f64>()
            .map_err(|_| AppError::BadRequest(format!("Invalid number: {s}")))
    };

    let mut result = parse(tokens[0])?;
    let mut i = 1;
    while i < tokens.len() {
        if i + 1 >= tokens.len() {
            return Err(AppError::BadRequest(
                "Expected operand after operator".into(),
            ));
        }
        let op = tokens[i];
        let operand = parse(tokens[i + 1])?;
        match op {
            "+" => result += operand,
            "-" => result -= operand,
            "*" => result *= operand,
            "/" => {
                if operand == 0.0 {
                    return Err(AppError::BadRequest("Division by zero".into()));
                }
                result /= operand;
            }
            other => {
                return Err(AppError::BadRequest(format!(
                    "Unknown operator: {other}"
                )))
            }
        }
        i += 2;
    }
    Ok(result)
}
