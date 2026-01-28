pub mod mock;
#[cfg(feature = "ebpf")]
pub mod ebpf;

use crate::packet::CaptureStats;
use mock::MockCapture;
use tauri::AppHandle;

#[derive(Debug)]
#[allow(dead_code)]
pub enum CaptureError {
    PermissionDenied(String),
    InterfaceNotFound(String),
    #[cfg(feature = "ebpf")]
    EbpfLoadFailed(String),
    Other(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            CaptureError::InterfaceNotFound(msg) => write!(f, "Interface not found: {}", msg),
            #[cfg(feature = "ebpf")]
            CaptureError::EbpfLoadFailed(msg) => write!(f, "eBPF load failed: {}", msg),
            CaptureError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

#[allow(dead_code)]
pub enum CaptureBackend {
    Mock(MockCapture),
    #[cfg(feature = "ebpf")]
    Ebpf(ebpf::EbpfCapture),
}

impl CaptureBackend {
    pub fn start(&self, app: AppHandle) {
        match self {
            CaptureBackend::Mock(m) => m.start(app),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.start(app),
        }
    }

    pub fn stop(&self) {
        match self {
            CaptureBackend::Mock(m) => m.stop(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.stop(),
        }
    }

    pub fn is_running(&self) -> bool {
        match self {
            CaptureBackend::Mock(m) => m.is_running(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.is_running(),
        }
    }

    pub fn get_stats(&self) -> CaptureStats {
        match self {
            CaptureBackend::Mock(m) => m.get_stats(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.get_stats(),
        }
    }

    pub fn reset(&self) {
        match self {
            CaptureBackend::Mock(m) => m.reset(),
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(e) => e.reset(),
        }
    }

    pub fn mode(&self) -> &'static str {
        match self {
            CaptureBackend::Mock(_) => "mock",
            #[cfg(feature = "ebpf")]
            CaptureBackend::Ebpf(_) => "ebpf",
        }
    }
}
