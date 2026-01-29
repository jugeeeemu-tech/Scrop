use std::sync::Arc;
use tauri::{Emitter, State};

use scrop_capture::AppState as CaptureState;
use scrop_capture::types::CaptureStats;

pub struct AppState {
    inner: Arc<CaptureState>,
}

impl AppState {
    fn new() -> Self {
        Self {
            inner: Arc::new(CaptureState::new()),
        }
    }
}

const EVENT_CAPTURED: &str = "packet:captured";

#[tauri::command]
async fn start_capture(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let inner = &state.inner;
    let capture = inner.capture.lock().await;
    capture.start(inner.event_tx.clone());

    // ブリッジ: broadcast → Tauri event
    let mut rx = inner.event_tx.subscribe();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(packet) = rx.recv().await {
            let _ = app_clone.emit(EVENT_CAPTURED, &packet);
        }
    });
    Ok(())
}

#[tauri::command]
async fn stop_capture(state: State<'_, AppState>) -> Result<(), String> {
    let capture = state.inner.capture.lock().await;
    capture.stop();
    Ok(())
}

#[tauri::command]
async fn get_capture_status(state: State<'_, AppState>) -> Result<CaptureStatusResponse, String> {
    let capture = state.inner.capture.lock().await;
    let stats = capture.get_stats();
    Ok(CaptureStatusResponse {
        is_capturing: capture.is_running(),
        stats,
        mode: capture.mode().to_string(),
    })
}

#[tauri::command]
async fn reset_capture(state: State<'_, AppState>) -> Result<(), String> {
    let capture = state.inner.capture.lock().await;
    if capture.is_running() {
        capture.stop();
    }
    capture.reset();
    Ok(())
}

#[tauri::command]
async fn list_interfaces(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let capture = state.inner.capture.lock().await;
    Ok(capture.list_interfaces())
}

#[tauri::command]
async fn attach_interface(state: State<'_, AppState>, interface: String) -> Result<(), String> {
    let capture = state.inner.capture.lock().await;
    capture.attach_interface(&interface).await
}

#[tauri::command]
async fn detach_interface(state: State<'_, AppState>, interface: String) -> Result<(), String> {
    let capture = state.inner.capture.lock().await;
    capture.detach_interface(&interface).await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatusResponse {
    is_capturing: bool,
    stats: CaptureStats,
    mode: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(feature = "ebpf")]
    if let Err(e) = scrop_capture::check_permissions() {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            start_capture,
            stop_capture,
            get_capture_status,
            reset_capture,
            list_interfaces,
            attach_interface,
            detach_interface
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
