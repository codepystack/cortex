use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

/// GET /health
pub async fn health_check() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "service": "cortex-backend",
            "version": env!("CARGO_PKG_VERSION"),
        })),
    )
}
