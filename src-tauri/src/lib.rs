mod capture;
mod events;
mod packet;

use capture::CaptureBackend;
use packet::CaptureStats;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct AppState {
    capture: Arc<Mutex<CaptureBackend>>,
}

impl AppState {
    fn new() -> Self {
        let backend = create_backend();
        Self {
            capture: Arc::new(Mutex::new(backend)),
        }
    }
}

fn create_backend() -> CaptureBackend {
    #[cfg(feature = "ebpf")]
    {
        let interfaces = detect_all_interfaces();
        eprintln!("Using eBPF capture on interfaces: {:?}", interfaces);
        CaptureBackend::Ebpf(capture::ebpf::EbpfCapture::new(interfaces))
    }
    #[cfg(not(feature = "ebpf"))]
    {
        eprintln!("Using mock capture backend");
        CaptureBackend::Mock(capture::mock::MockCapture::new())
    }
}

#[cfg(feature = "ebpf")]
fn detect_all_interfaces() -> Vec<String> {
    // /sys/class/net/ からすべてのネットワークインターフェースを列挙
    if let Ok(entries) = std::fs::read_dir("/sys/class/net/") {
        let ifaces: Vec<String> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        if !ifaces.is_empty() {
            return ifaces;
        }
    }
    vec!["eth0".to_string()]
}

#[tauri::command]
async fn start_capture(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let capture = state.capture.lock().await;
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
    let stats = capture.get_stats();
    Ok(CaptureStatusResponse {
        is_capturing: capture.is_running(),
        stats,
        mode: capture.mode().to_string(),
    })
}

#[tauri::command]
async fn reset_capture(state: State<'_, AppState>) -> Result<(), String> {
    let capture = state.capture.lock().await;
    if capture.is_running() {
        capture.stop();
    }
    capture.reset();
    Ok(())
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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            start_capture,
            stop_capture,
            get_capture_status,
            reset_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
