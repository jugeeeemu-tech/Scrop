use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};

use crate::types::{AnimatingPacket, CapturedPacket, CaptureStats, PacketResult};
use crate::CaptureError;

const PACKET_GENERATION_INTERVAL_MS: u64 = 2000;

pub const AVAILABLE_INTERFACES: &[&str] = &["eth0", "lo", "wlan0", "docker0"];

pub struct MockCapture {
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
    attached_interfaces: Arc<std::sync::Mutex<HashSet<String>>>,
}

impl MockCapture {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            packet_counter: Arc::new(AtomicU64::new(0)),
            stats: Arc::new(std::sync::Mutex::new(CaptureStats::default())),
            attached_interfaces: Arc::new(std::sync::Mutex::new(HashSet::new())),
        }
    }

    pub fn attach_interface(&self, name: &str) -> Result<(), CaptureError> {
        if !AVAILABLE_INTERFACES.contains(&name) {
            return Err(CaptureError::InterfaceNotFound(format!("Interface {} not found", name)));
        }
        self.attached_interfaces
            .lock()
            .unwrap()
            .insert(name.to_string());
        Ok(())
    }

    pub fn detach_interface(&self, name: &str) -> Result<(), CaptureError> {
        if !self.attached_interfaces.lock().unwrap().remove(name) {
            return Err(CaptureError::InvalidState(format!("Interface {} is not attached", name)));
        }
        Ok(())
    }

    pub fn attached_interfaces(&self) -> HashSet<String> {
        self.attached_interfaces.lock().unwrap().clone()
    }

    pub fn list_interfaces(&self) -> Vec<String> {
        AVAILABLE_INTERFACES.iter().map(|s| s.to_string()).collect()
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn get_stats(&self) -> CaptureStats {
        self.stats.lock().unwrap().clone()
    }

    pub fn start(&self, tx: broadcast::Sender<CapturedPacket>) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        let is_running = Arc::clone(&self.is_running);
        let packet_counter = Arc::clone(&self.packet_counter);
        let stats = Arc::clone(&self.stats);
        let attached_interfaces = Arc::clone(&self.attached_interfaces);

        tokio::spawn(async move {
            while is_running.load(Ordering::SeqCst) {
                // Skip packet generation if no interfaces are attached
                if attached_interfaces.lock().unwrap().is_empty() {
                    sleep(Duration::from_millis(PACKET_GENERATION_INTERVAL_MS)).await;
                    continue;
                }

                let counter = packet_counter.fetch_add(1, Ordering::SeqCst);
                let packet = AnimatingPacket::generate(counter);

                // Determine result immediately
                let random: f64 = rand::random();

                let (result, packet) = if random < 0.1 {
                    // 10%: Dropped at NIC
                    (PacketResult::NicDrop, packet.with_reason("Buffer overflow"))
                } else if random < 0.25 {
                    // 15%: Dropped at FW
                    (PacketResult::FwDrop, packet.with_reason("Blocked by rule"))
                } else {
                    // 75%: Delivered successfully
                    (PacketResult::Delivered, packet)
                };

                // Update stats
                {
                    let mut s = stats.lock().unwrap();
                    s.total_packets += 1;
                    match result {
                        PacketResult::NicDrop => s.nic_dropped += 1,
                        PacketResult::FwDrop => s.fw_dropped += 1,
                        PacketResult::Delivered => s.delivered += 1,
                    }
                }

                // Send via broadcast channel
                let captured = CapturedPacket { packet, result };
                let _ = tx.send(captured);

                sleep(Duration::from_millis(PACKET_GENERATION_INTERVAL_MS)).await;
            }
        });
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn reset(&self) {
        self.packet_counter.store(0, Ordering::SeqCst);
        *self.stats.lock().unwrap() = CaptureStats::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_creates_stopped_instance() {
        let mock = MockCapture::new();
        assert!(!mock.is_running());
        let stats = mock.get_stats();
        assert_eq!(stats.total_packets, 0);
    }

    #[tokio::test]
    async fn start_stop_lifecycle() {
        let mock = MockCapture::new();
        let (tx, _rx) = broadcast::channel(16);
        mock.start(tx);
        assert!(mock.is_running());
        mock.stop();
        assert!(!mock.is_running());
    }

    #[tokio::test]
    async fn double_start_is_idempotent() {
        let mock = MockCapture::new();
        let (tx, _rx) = broadcast::channel(16);
        mock.start(tx.clone());
        assert!(mock.is_running());
        mock.start(tx); // second call should not panic
        assert!(mock.is_running());
        mock.stop();
    }

    #[tokio::test]
    async fn broadcast_receives_packets() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        let (tx, mut rx) = broadcast::channel(16);
        mock.start(tx);

        // Wait for at least one packet
        let result = tokio::time::timeout(
            Duration::from_secs(5),
            rx.recv(),
        )
        .await;

        mock.stop();
        assert!(result.is_ok(), "Timed out waiting for packet");
        let captured = result.unwrap().unwrap();
        assert!(!captured.packet.id.is_empty());
    }

    #[tokio::test]
    async fn stats_accumulate() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        let (tx, mut rx) = broadcast::channel(64);
        mock.start(tx);

        // Receive a few packets
        for _ in 0..3 {
            let _ = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await;
        }

        mock.stop();
        let stats = mock.get_stats();
        assert!(stats.total_packets >= 3, "Expected at least 3 packets, got {}", stats.total_packets);
        assert_eq!(
            stats.total_packets,
            stats.nic_dropped + stats.fw_dropped + stats.delivered
        );
    }

    #[tokio::test]
    async fn reset_clears_state() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        let (tx, mut rx) = broadcast::channel(16);
        mock.start(tx);

        // Wait for at least one packet
        let _ = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await;
        mock.stop();

        let stats_before = mock.get_stats();
        assert!(stats_before.total_packets > 0);

        mock.reset();
        let stats_after = mock.get_stats();
        assert_eq!(stats_after.total_packets, 0);
        assert_eq!(stats_after.nic_dropped, 0);
        assert_eq!(stats_after.fw_dropped, 0);
        assert_eq!(stats_after.delivered, 0);
    }

    #[tokio::test]
    async fn no_packets_without_attached_interfaces() {
        let mock = MockCapture::new();
        let (tx, mut rx) = broadcast::channel(16);
        mock.start(tx);

        let result = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
        mock.stop();
        assert!(result.is_err(), "Should not receive packets without attached interfaces");
        assert_eq!(mock.get_stats().total_packets, 0);
    }

    #[test]
    fn attach_unknown_interface_returns_error() {
        let mock = MockCapture::new();
        let result = mock.attach_interface("nonexistent");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }

    #[test]
    fn detach_unattached_interface_returns_error() {
        let mock = MockCapture::new();
        let result = mock.detach_interface("eth0");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not attached"));
    }

    #[test]
    fn double_attach_is_idempotent() {
        let mock = MockCapture::new();
        assert!(mock.attach_interface("eth0").is_ok());
        assert!(mock.attach_interface("eth0").is_ok());
        assert_eq!(mock.attached_interfaces().len(), 1);
    }

    #[test]
    fn attach_then_detach_lifecycle() {
        let mock = MockCapture::new();
        assert!(mock.attached_interfaces().is_empty());

        mock.attach_interface("eth0").unwrap();
        assert!(mock.attached_interfaces().contains("eth0"));

        mock.attach_interface("lo").unwrap();
        assert_eq!(mock.attached_interfaces().len(), 2);

        mock.detach_interface("eth0").unwrap();
        assert_eq!(mock.attached_interfaces().len(), 1);
        assert!(!mock.attached_interfaces().contains("eth0"));
        assert!(mock.attached_interfaces().contains("lo"));

        mock.detach_interface("lo").unwrap();
        assert!(mock.attached_interfaces().is_empty());
    }

    #[tokio::test]
    async fn packets_stop_after_detach_all() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        let (tx, mut rx) = broadcast::channel(16);
        mock.start(tx);

        // Wait for at least one packet
        let result = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await;
        assert!(result.is_ok(), "Should receive packets with attached interface");

        // Detach all interfaces
        mock.detach_interface("eth0").unwrap();

        // Reset stats to check no new packets arrive
        mock.reset();

        // Wait and verify no new packets
        let result = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
        mock.stop();
        assert!(result.is_err(), "Should not receive packets after detaching all interfaces");
        assert_eq!(mock.get_stats().total_packets, 0);
    }

    #[test]
    fn list_interfaces_returns_all_available() {
        let mock = MockCapture::new();
        let interfaces = mock.list_interfaces();
        assert_eq!(interfaces.len(), AVAILABLE_INTERFACES.len());
        for iface in AVAILABLE_INTERFACES {
            assert!(interfaces.contains(&iface.to_string()));
        }
    }
}
