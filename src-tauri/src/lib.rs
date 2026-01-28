mod capture;
mod events;
mod packet;

use capture::MockCapture;
use packet::CaptureStats;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

const DEFAULT_PORT_COUNT: u8 = 5;

pub struct AppState {
    capture: Arc<Mutex<MockCapture>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            capture: Arc::new(Mutex::new(MockCapture::new(DEFAULT_PORT_COUNT))),
        }
    }
}

#[tauri::command]
async fn start_capture(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let capture = state.capture.lock().await;
    if capture.is_running() {
        return Err("Capture is already running".to_string());
    }
    capture.start(app);
    Ok(())
}

#[tauri::command]
async fn stop_capture(state: State<'_, AppState>) -> Result<(), String> {
    let capture = state.capture.lock().await;
    capture.stop();
    Ok(())
}

#[tauri::command]
async fn get_capture_status(state: State<'_, AppState>) -> Result<CaptureStatusResponse, String> {
    let capture = state.capture.lock().await;
    let stats = capture.get_stats().await;
    Ok(CaptureStatusResponse {
        is_capturing: capture.is_running(),
        stats,
    })
}

#[tauri::command]
async fn reset_capture(state: State<'_, AppState>) -> Result<(), String> {
    let capture = state.capture.lock().await;
    if capture.is_running() {
        return Err("Cannot reset while capturing".to_string());
    }
    capture.reset().await;
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatusResponse {
    is_capturing: bool,
    stats: CaptureStats,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_capture,
            stop_capture,
            get_capture_status,
            reset_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
