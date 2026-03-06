use axum::{extract::State, response::IntoResponse, Json};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{auth::{Claims, User}, error::AppError, AppState};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
}

/// POST /v1/auth/register
pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.email.is_empty() || req.password.is_empty() {
        return Err(AppError::BadRequest("Email and password are required".into()));
    }
    if req.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    let mut store = state.user_store.lock().unwrap();

    if store.iter().any(|u| u.email == req.email) {
        return Err(AppError::BadRequest("Email already registered".into()));
    }

    let user = User::new(&req.email, &req.password)?;
    let token = Claims::encode(&user.id, &user.email, &state.config.jwt_secret)?;

    let resp = AuthResponse {
        token,
        user: UserInfo {
            id: user.id.clone(),
            email: user.email.clone(),
        },
    };

    store.push(user);

    Ok(Json(resp))
}

/// POST /v1/auth/login
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let store = state.user_store.lock().unwrap();

    let user = store
        .iter()
        .find(|u| u.email == req.email)
        .ok_or_else(|| AppError::Unauthorized("Invalid credentials".into()))?;

    if !user.verify_password(&req.password) {
        return Err(AppError::Unauthorized("Invalid credentials".into()));
    }

    let token = Claims::encode(&user.id, &user.email, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse {
        token,
        user: UserInfo {
            id: user.id.clone(),
            email: user.email.clone(),
        },
    }))
}

/// GET /v1/auth/me  (requires JWT via Authorization: Bearer <token>)
pub async fn me(
    State(state): State<AppState>,
    TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
) -> Result<impl IntoResponse, AppError> {
    let claims = Claims::verify(auth.token(), &state.config.jwt_secret)?;

    Ok(Json(json!({
        "id": claims.sub,
        "email": claims.email,
    })))
}
