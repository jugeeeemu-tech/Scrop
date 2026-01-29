use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde::Serialize;

use scrop_capture::AppState;
use scrop_capture::types::CaptureStats;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatusResponse {
    pub is_capturing: bool,
    pub stats: CaptureStats,
    pub mode: String,
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub message: String,
}

pub async fn start_capture(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, (StatusCode, String)> {
    let capture = state.capture.lock().await;
    capture.start(state.event_tx.clone());
    Ok(Json(MessageResponse {
        message: "Capture started".to_string(),
    }))
}

pub async fn stop_capture(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, (StatusCode, String)> {
    let capture = state.capture.lock().await;
    capture.stop();
    Ok(Json(MessageResponse {
        message: "Capture stopped".to_string(),
    }))
}

pub async fn get_capture_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CaptureStatusResponse>, (StatusCode, String)> {
    let capture = state.capture.lock().await;
    let stats = capture.get_stats();
    Ok(Json(CaptureStatusResponse {
        is_capturing: capture.is_running(),
        stats,
        mode: capture.mode().to_string(),
    }))
}

pub async fn reset_capture(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, (StatusCode, String)> {
    let capture = state.capture.lock().await;
    if capture.is_running() {
        capture.stop();
    }
    capture.reset();
    Ok(Json(MessageResponse {
        message: "Capture reset".to_string(),
    }))
}

pub async fn list_interfaces(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<String>>, (StatusCode, String)> {
    let capture = state.capture.lock().await;
    Ok(Json(capture.list_interfaces()))
}

pub async fn attach_interface(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<MessageResponse>, (StatusCode, String)> {
    let capture = state.capture.lock().await;
    capture
        .attach_interface(&name)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(MessageResponse {
        message: format!("Interface {} attached", name),
    }))
}

pub async fn detach_interface(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<MessageResponse>, (StatusCode, String)> {
    let capture = state.capture.lock().await;
    capture
        .detach_interface(&name)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(MessageResponse {
        message: format!("Interface {} detached", name),
    }))
}
