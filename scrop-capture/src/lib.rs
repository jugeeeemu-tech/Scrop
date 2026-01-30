pub mod types;
#[cfg(not(feature = "ebpf"))]
pub mod mock;
#[cfg(feature = "ebpf")]
pub mod drop_reason;
#[cfg(feature = "ebpf")]
pub mod ebpf;

use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use types::{CapturedPacket, CaptureStats};

#[derive(Debug)]
#[allow(dead_code)]
pub enum CaptureError {
    PermissionDenied(String),
    InterfaceNotFound(String),
    InvalidState(String),
    #[cfg(feature = "ebpf")]
    EbpfLoadFailed(String),
    Other(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            CaptureError::InterfaceNotFound(msg) => write!(f, "Interface not found: {}", msg),
            CaptureError::InvalidState(msg) => write!(f, "Invalid state: {}", msg),
            #[cfg(feature = "ebpf")]
            CaptureError::EbpfLoadFailed(msg) => write!(f, "eBPF load failed: {}", msg),
            CaptureError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

pub enum CaptureBackend {
    #[cfg(not(feature = "ebpf"))]
    Mock(mock::MockCapture),
    #[cfg(feature = "ebpf")]
    Ebpf(ebpf::EbpfCapture),
}

impl CaptureBackend {
    pub fn start(&self, tx: broadcast::Sender<CapturedPacket>) {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.start(tx),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.start(tx),
        }
    }

    pub fn stop(&self) {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.stop(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.stop(),
        }
    }

    pub fn is_running(&self) -> bool {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.is_running(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.is_running(),
        }
    }

    pub fn get_stats(&self) -> CaptureStats {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.get_stats(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.get_stats(),
        }
    }

    pub fn reset(&self) {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.reset(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.reset(),
        }
    }

    pub fn mode(&self) -> &'static str {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(_) => "mock",
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(_) => "ebpf",
        }
    }

    pub async fn attach_interface(&self, name: &str) -> Result<(), CaptureError> {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.attach_interface(name),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.attach_interface(name).await,
        }
    }

    pub async fn detach_interface(&self, name: &str) -> Result<(), CaptureError> {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.detach_interface(name),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.detach_interface(name).await,
        }
    }

    pub fn list_interfaces(&self) -> Vec<String> {
        match self {
            #[cfg(not(feature = "ebpf"))]
            CaptureBackend::Mock(m) => m.list_interfaces(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(_) => detect_all_interfaces(),
        }
    }

    #[cfg(not(feature = "ebpf"))]
    pub fn get_mock_config(&self) -> mock::MockConfig {
        match self {
            CaptureBackend::Mock(m) => m.get_config(),
        }
    }

    #[cfg(not(feature = "ebpf"))]
    pub fn update_mock_config(
        &self,
        interval_ms: Option<u64>,
        nic_drop_rate: Option<f64>,
        fw_drop_rate: Option<f64>,
    ) -> Result<mock::MockConfig, CaptureError> {
        match self {
            CaptureBackend::Mock(m) => m.update_config(interval_ms, nic_drop_rate, fw_drop_rate),
        }
    }
}

/// /sys/class/net/ からすべてのネットワークインターフェースを列挙
pub fn detect_all_interfaces() -> Vec<String> {
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

fn create_backend() -> CaptureBackend {
    #[cfg(feature = "ebpf")]
    {
        eprintln!("Using eBPF capture backend");
        CaptureBackend::Ebpf(ebpf::EbpfCapture::new())
    }
    #[cfg(not(feature = "ebpf"))]
    {
        eprintln!("Using mock capture backend");
        CaptureBackend::Mock(mock::MockCapture::new())
    }
}

pub struct AppState {
    pub capture: Arc<Mutex<CaptureBackend>>,
    pub event_tx: broadcast::Sender<CapturedPacket>,
}

impl AppState {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(1024);
        Self {
            capture: Arc::new(Mutex::new(create_backend())),
            event_tx,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capture_error_display() {
        let err = CaptureError::PermissionDenied("test".to_string());
        assert_eq!(format!("{}", err), "Permission denied: test");

        let err = CaptureError::InterfaceNotFound("eth0".to_string());
        assert_eq!(format!("{}", err), "Interface not found: eth0");

        let err = CaptureError::InvalidState("not running".to_string());
        assert_eq!(format!("{}", err), "Invalid state: not running");

        let err = CaptureError::Other("something".to_string());
        assert_eq!(format!("{}", err), "something");
    }

    #[test]
    fn detect_all_interfaces_returns_non_empty() {
        let ifaces = detect_all_interfaces();
        assert!(!ifaces.is_empty());
    }

    #[test]
    fn app_state_new_does_not_panic() {
        let _state = AppState::new();
    }

    #[test]
    fn app_state_default_does_not_panic() {
        let _state = AppState::default();
    }

    #[tokio::test]
    async fn capture_backend_mock_mode() {
        let state = AppState::new();
        let capture = state.capture.lock().await;
        assert_eq!(capture.mode(), "mock");
    }

    #[tokio::test]
    async fn capture_backend_list_interfaces() {
        let state = AppState::new();
        let capture = state.capture.lock().await;
        let ifaces = capture.list_interfaces();
        assert!(!ifaces.is_empty());
    }

    #[tokio::test]
    async fn capture_backend_attach_detach() {
        let state = AppState::new();
        let capture = state.capture.lock().await;
        assert!(capture.attach_interface("eth0").await.is_ok());
        assert!(capture.detach_interface("eth0").await.is_ok());
        // Detach without prior attach returns error
        assert!(capture.detach_interface("eth0").await.is_err());
        // Attach unknown interface returns error
        assert!(capture.attach_interface("nonexistent").await.is_err());
    }

    #[tokio::test]
    async fn capture_backend_start_stop() {
        let state = AppState::new();
        let capture = state.capture.lock().await;
        assert!(capture.attach_interface("eth0").await.is_ok());
        assert!(!capture.is_running());
        capture.start(state.event_tx.clone());
        assert!(capture.is_running());
        capture.stop();
        assert!(!capture.is_running());
    }

    #[tokio::test]
    async fn capture_backend_reset() {
        let state = AppState::new();
        let capture = state.capture.lock().await;
        assert!(capture.attach_interface("eth0").await.is_ok());
        capture.start(state.event_tx.clone());
        capture.stop();
        capture.reset();
        let stats = capture.get_stats();
        assert_eq!(stats.total_packets, 0);
    }
}

/// eBPFキャプチャに必要な権限があるかチェックする。
/// 権限不足の場合はエラーメッセージを返す。
#[cfg(feature = "ebpf")]
pub fn check_permissions() -> Result<(), String> {
    let status = std::fs::read_to_string("/proc/self/status")
        .map_err(|e| format!("/proc/self/status の読み取りに失敗: {}", e))?;

    let cap_eff = status
        .lines()
        .find(|line| line.starts_with("CapEff:"))
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|hex| u64::from_str_radix(hex, 16).ok())
        .unwrap_or(0);

    const CAP_NET_ADMIN: u64 = 1 << 12;
    const CAP_BPF: u64 = 1 << 39;
    const REQUIRED: u64 = CAP_NET_ADMIN | CAP_BPF;

    if cap_eff & REQUIRED == REQUIRED {
        return Ok(());
    }

    let mut missing = Vec::new();
    if cap_eff & CAP_BPF == 0 {
        missing.push("CAP_BPF");
    }
    if cap_eff & CAP_NET_ADMIN == 0 {
        missing.push("CAP_NET_ADMIN");
    }

    Err(format!(
        "eBPF の実行に必要な権限がありません (不足: {})\n\
         \n\
         以下のいずれかの方法で実行してください:\n\
         \n\
         1. sudo で実行:\n\
         \x20  sudo {}\n\
         \n\
         2. capability を付与:\n\
         \x20  sudo setcap 'cap_bpf,cap_net_admin,cap_perfmon+ep' {}",
        missing.join(", "),
        std::env::args().collect::<Vec<_>>().join(" "),
        std::env::current_exe()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "<binary>".to_string()),
    ))
}
