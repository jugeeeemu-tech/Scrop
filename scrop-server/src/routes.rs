use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json, Response};
use serde::Serialize;

use scrop_capture::{AppState, CaptureError};
use scrop_capture::types::CaptureStats;

#[cfg(not(feature = "ebpf"))]
use serde::Deserialize;

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

pub struct ApiError {
    status: StatusCode,
    error: String,
}

#[derive(Serialize)]
struct ApiErrorBody {
    error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(ApiErrorBody { error: self.error })).into_response()
    }
}

impl From<CaptureError> for ApiError {
    fn from(err: CaptureError) -> Self {
        let status = match &err {
            CaptureError::InterfaceNotFound(_) | CaptureError::InvalidState(_) => StatusCode::BAD_REQUEST,
            CaptureError::PermissionDenied(_) => StatusCode::FORBIDDEN,
            #[cfg(feature = "ebpf")]
            CaptureError::EbpfLoadFailed(_) => StatusCode::INTERNAL_SERVER_ERROR,
            CaptureError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        Self { status, error: err.to_string() }
    }
}

pub async fn start_capture(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, ApiError> {
    let capture = state.capture.lock().await;
    capture.start(state.event_tx.clone());
    Ok(Json(MessageResponse {
        message: "Capture started".to_string(),
    }))
}

pub async fn stop_capture(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, ApiError> {
    let capture = state.capture.lock().await;
    capture.stop();
    Ok(Json(MessageResponse {
        message: "Capture stopped".to_string(),
    }))
}

pub async fn get_capture_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CaptureStatusResponse>, ApiError> {
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
) -> Result<Json<MessageResponse>, ApiError> {
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
) -> Result<Json<Vec<String>>, ApiError> {
    let capture = state.capture.lock().await;
    Ok(Json(capture.list_interfaces()))
}

pub async fn attach_interface(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<MessageResponse>, ApiError> {
    let capture = state.capture.lock().await;
    capture
        .attach_interface(&name)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(MessageResponse {
        message: format!("Interface {} attached", name),
    }))
}

pub async fn detach_interface(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<MessageResponse>, ApiError> {
    let capture = state.capture.lock().await;
    capture
        .detach_interface(&name)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(MessageResponse {
        message: format!("Interface {} detached", name),
    }))
}

#[cfg(not(feature = "ebpf"))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMockConfigRequest {
    pub interval_ms: Option<u64>,
    pub nic_drop_rate: Option<f64>,
    pub fw_drop_rate: Option<f64>,
}

#[cfg(not(feature = "ebpf"))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockConfigResponse {
    pub interval_ms: u64,
    pub nic_drop_rate: f64,
    pub fw_drop_rate: f64,
}

#[cfg(not(feature = "ebpf"))]
pub async fn get_mock_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MockConfigResponse>, ApiError> {
    let capture = state.capture.lock().await;
    let config = capture.get_mock_config();
    Ok(Json(MockConfigResponse {
        interval_ms: config.interval_ms,
        nic_drop_rate: config.nic_drop_rate,
        fw_drop_rate: config.fw_drop_rate,
    }))
}

#[cfg(not(feature = "ebpf"))]
pub async fn update_mock_config(
    State(state): State<Arc<AppState>>,
    Json(req): Json<UpdateMockConfigRequest>,
) -> Result<Json<MockConfigResponse>, ApiError> {
    let capture = state.capture.lock().await;
    let config = capture
        .update_mock_config(req.interval_ms, req.nic_drop_rate, req.fw_drop_rate)
        .map_err(ApiError::from)?;
    Ok(Json(MockConfigResponse {
        interval_ms: config.interval_ms,
        nic_drop_rate: config.nic_drop_rate,
        fw_drop_rate: config.fw_drop_rate,
    }))
}
