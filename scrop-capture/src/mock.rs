use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};

use crate::types::{
    generate_session_id, AnimatingPacket, CaptureStats, CapturedPacket, CapturedPacketBatch,
    PacketResult,
};
use crate::CaptureError;

pub const AVAILABLE_INTERFACES: &[&str] = &["eth0", "lo", "wlan0", "docker0"];

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockConfig {
    pub interval_ms: u64,
    pub nic_drop_rate: f64,
    pub fw_drop_rate: f64,
    pub batch_size: u32,
}

impl Default for MockConfig {
    fn default() -> Self {
        Self {
            interval_ms: 2000,
            nic_drop_rate: 0.10,
            fw_drop_rate: 0.15,
            batch_size: 1,
        }
    }
}

pub struct MockCapture {
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
    attached_interfaces: Arc<std::sync::Mutex<HashSet<String>>>,
    config: Arc<std::sync::Mutex<MockConfig>>,
}

impl MockCapture {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            packet_counter: Arc::new(AtomicU64::new(0)),
            stats: Arc::new(std::sync::Mutex::new(CaptureStats::default())),
            attached_interfaces: Arc::new(std::sync::Mutex::new(HashSet::new())),
            config: Arc::new(std::sync::Mutex::new(MockConfig::default())),
        }
    }

    pub fn get_config(&self) -> MockConfig {
        self.config.lock().unwrap().clone()
    }

    pub fn update_config(
        &self,
        interval_ms: Option<u64>,
        nic_drop_rate: Option<f64>,
        fw_drop_rate: Option<f64>,
        batch_size: Option<u32>,
    ) -> Result<MockConfig, CaptureError> {
        let mut config = self.config.lock().unwrap();

        let new_interval = interval_ms.unwrap_or(config.interval_ms);
        let new_nic = nic_drop_rate.unwrap_or(config.nic_drop_rate);
        let new_fw = fw_drop_rate.unwrap_or(config.fw_drop_rate);
        let new_batch = batch_size.unwrap_or(config.batch_size);

        if new_interval == 0 {
            return Err(CaptureError::InvalidState(
                "intervalMs must be greater than 0".to_string(),
            ));
        }
        if !(0.0..=1.0).contains(&new_nic) {
            return Err(CaptureError::InvalidState(
                "nicDropRate must be between 0.0 and 1.0".to_string(),
            ));
        }
        if !(0.0..=1.0).contains(&new_fw) {
            return Err(CaptureError::InvalidState(
                "fwDropRate must be between 0.0 and 1.0".to_string(),
            ));
        }
        if new_nic + new_fw > 1.0 {
            return Err(CaptureError::InvalidState(
                "nicDropRate + fwDropRate must be <= 1.0".to_string(),
            ));
        }
        if new_batch == 0 {
            return Err(CaptureError::InvalidState(
                "batchSize must be greater than 0".to_string(),
            ));
        }

        config.interval_ms = new_interval;
        config.nic_drop_rate = new_nic;
        config.fw_drop_rate = new_fw;
        config.batch_size = new_batch;

        Ok(config.clone())
    }

    pub fn attach_interface(&self, name: &str) -> Result<(), CaptureError> {
        if !AVAILABLE_INTERFACES.contains(&name) {
            return Err(CaptureError::InterfaceNotFound(format!(
                "Interface {} not found",
                name
            )));
        }
        self.attached_interfaces
            .lock()
            .unwrap()
            .insert(name.to_string());
        Ok(())
    }

    pub fn detach_interface(&self, name: &str) -> Result<(), CaptureError> {
        if !self.attached_interfaces.lock().unwrap().remove(name) {
            return Err(CaptureError::InvalidState(format!(
                "Interface {} is not attached",
                name
            )));
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

    pub fn start(&self, tx: broadcast::Sender<CapturedPacketBatch>) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        let is_running = Arc::clone(&self.is_running);
        let packet_counter = Arc::clone(&self.packet_counter);
        let stats = Arc::clone(&self.stats);
        let attached_interfaces = Arc::clone(&self.attached_interfaces);
        let config = Arc::clone(&self.config);
        let session_id = generate_session_id();

        tokio::spawn(async move {
            while is_running.load(Ordering::SeqCst) {
                let (interval_ms, nic_drop_rate, fw_drop_rate, batch_size) = {
                    let cfg = config.lock().unwrap();
                    (
                        cfg.interval_ms,
                        cfg.nic_drop_rate,
                        cfg.fw_drop_rate,
                        cfg.batch_size,
                    )
                };

                // Skip packet generation if no interfaces are attached
                if attached_interfaces.lock().unwrap().is_empty() {
                    sleep(Duration::from_millis(interval_ms)).await;
                    continue;
                }

                let mut out_batch = Vec::with_capacity(batch_size as usize);
                for _ in 0..batch_size {
                    let counter = packet_counter.fetch_add(1, Ordering::SeqCst);
                    let packet = AnimatingPacket::generate(&session_id, counter);

                    // Determine result immediately
                    let random: f64 = rand::random();

                    let (result, packet) = if random < nic_drop_rate {
                        (PacketResult::NicDrop, packet.with_reason("Buffer overflow"))
                    } else if random < nic_drop_rate + fw_drop_rate {
                        (PacketResult::FwDrop, packet.with_reason("Blocked by rule"))
                    } else {
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
                    out_batch.push(captured);
                }

                if !out_batch.is_empty() {
                    let _ = tx.send(out_batch);
                }

                sleep(Duration::from_millis(interval_ms)).await;
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

    fn parse_packet_id(id: &str) -> (String, u64) {
        let parts: Vec<&str> = id.split('-').collect();
        assert_eq!(parts.len(), 3, "unexpected packet id format: {}", id);
        assert_eq!(parts[0], "pkt");
        let counter = parts[2]
            .parse::<u64>()
            .expect("packet counter should be valid u64");
        (parts[1].to_string(), counter)
    }

    fn first_packet(batch: CapturedPacketBatch) -> CapturedPacket {
        batch.into_iter().next().expect("batch should not be empty")
    }

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
        let result = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await;

        mock.stop();
        assert!(result.is_ok(), "Timed out waiting for packet");
        let captured = first_packet(result.unwrap().unwrap());
        assert!(!captured.packet.id.is_empty());
    }

    #[tokio::test]
    async fn stats_accumulate() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        let (tx, mut rx) = broadcast::channel(64);
        mock.start(tx);

        // Receive at least a few packets across one or more batches.
        let mut received_packets = 0usize;
        while received_packets < 3 {
            let batch = tokio::time::timeout(Duration::from_secs(5), rx.recv())
                .await
                .expect("timed out waiting for batch")
                .expect("failed receiving batch");
            received_packets += batch.len();
        }

        mock.stop();
        let stats = mock.get_stats();
        assert!(
            stats.total_packets >= 3,
            "Expected at least 3 packets, got {}",
            stats.total_packets
        );
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
        assert!(
            result.is_err(),
            "Should not receive packets without attached interfaces"
        );
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
        assert!(
            result.is_ok(),
            "Should receive packets with attached interface"
        );

        // Detach all interfaces
        mock.detach_interface("eth0").unwrap();

        // Reset stats to check no new packets arrive
        mock.reset();

        // Wait and verify no new packets
        let result = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
        mock.stop();
        assert!(
            result.is_err(),
            "Should not receive packets after detaching all interfaces"
        );
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

    #[test]
    fn config_default_values() {
        let mock = MockCapture::new();
        let config = mock.get_config();
        assert_eq!(config.interval_ms, 2000);
        assert!((config.nic_drop_rate - 0.10).abs() < f64::EPSILON);
        assert!((config.fw_drop_rate - 0.15).abs() < f64::EPSILON);
    }

    #[test]
    fn config_partial_update() {
        let mock = MockCapture::new();

        // Update only interval
        let config = mock.update_config(Some(100), None, None, None).unwrap();
        assert_eq!(config.interval_ms, 100);
        assert!((config.nic_drop_rate - 0.10).abs() < f64::EPSILON);
        assert!((config.fw_drop_rate - 0.15).abs() < f64::EPSILON);

        // Update only drop rates
        let config = mock
            .update_config(None, Some(0.3), Some(0.2), None)
            .unwrap();
        assert_eq!(config.interval_ms, 100);
        assert!((config.nic_drop_rate - 0.3).abs() < f64::EPSILON);
        assert!((config.fw_drop_rate - 0.2).abs() < f64::EPSILON);
    }

    #[test]
    fn config_validation_interval_zero() {
        let mock = MockCapture::new();
        let result = mock.update_config(Some(0), None, None, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("intervalMs"));
    }

    #[test]
    fn config_validation_nic_drop_rate_out_of_range() {
        let mock = MockCapture::new();
        let result = mock.update_config(None, Some(1.5), None, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("nicDropRate"));

        let result = mock.update_config(None, Some(-0.1), None, None);
        assert!(result.is_err());
    }

    #[test]
    fn config_validation_fw_drop_rate_out_of_range() {
        let mock = MockCapture::new();
        let result = mock.update_config(None, None, Some(1.5), None);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("fwDropRate"));
    }

    #[test]
    fn config_validation_combined_rates_exceed_one() {
        let mock = MockCapture::new();
        let result = mock.update_config(None, Some(0.6), Some(0.5), None);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("<= 1.0"));
    }

    #[test]
    fn config_default_batch_size() {
        let mock = MockCapture::new();
        let config = mock.get_config();
        assert_eq!(config.batch_size, 1);
    }

    #[test]
    fn config_update_batch_size() {
        let mock = MockCapture::new();
        let config = mock.update_config(None, None, None, Some(5)).unwrap();
        assert_eq!(config.batch_size, 5);
        // Other fields unchanged
        assert_eq!(config.interval_ms, 2000);
    }

    #[test]
    fn config_validation_batch_size_zero() {
        let mock = MockCapture::new();
        let result = mock.update_config(None, None, None, Some(0));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("batchSize"));
    }

    #[tokio::test]
    async fn config_affects_generation_interval() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();

        // Set very fast interval
        mock.update_config(Some(50), None, None, None).unwrap();

        let (tx, mut rx) = broadcast::channel(64);
        mock.start(tx);

        // Should receive packets quickly with 50ms interval
        let result = tokio::time::timeout(Duration::from_secs(1), rx.recv()).await;
        mock.stop();
        assert!(
            result.is_ok(),
            "Should receive packet within 1s with 50ms interval"
        );
    }

    #[tokio::test]
    async fn start_stop_start_rotates_session_id_without_reset() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        mock.update_config(Some(50), None, None, None).unwrap();

        let (tx1, mut rx1) = broadcast::channel(16);
        mock.start(tx1);
        let first = first_packet(
            tokio::time::timeout(Duration::from_secs(2), rx1.recv())
                .await
                .expect("first packet timeout")
                .expect("first packet receive failed"),
        );
        mock.stop();
        sleep(Duration::from_millis(100)).await;

        let (tx2, mut rx2) = broadcast::channel(16);
        mock.start(tx2);
        let second = first_packet(
            tokio::time::timeout(Duration::from_secs(2), rx2.recv())
                .await
                .expect("second packet timeout")
                .expect("second packet receive failed"),
        );
        mock.stop();

        let (first_session, first_counter) = parse_packet_id(&first.packet.id);
        let (second_session, second_counter) = parse_packet_id(&second.packet.id);

        assert_ne!(
            first_session, second_session,
            "session_id should change on each start"
        );
        assert!(
            second_counter > first_counter,
            "counter should continue without reset"
        );
    }

    #[tokio::test]
    async fn reset_then_restart_restarts_counter_from_zero() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        mock.update_config(Some(50), None, None, None).unwrap();

        let (tx1, mut rx1) = broadcast::channel(16);
        mock.start(tx1);
        let _ = tokio::time::timeout(Duration::from_secs(2), rx1.recv())
            .await
            .expect("first run packet timeout")
            .expect("first run packet receive failed");
        mock.stop();
        sleep(Duration::from_millis(100)).await;

        mock.reset();

        let (tx2, mut rx2) = broadcast::channel(16);
        mock.start(tx2);
        let second = first_packet(
            tokio::time::timeout(Duration::from_secs(2), rx2.recv())
                .await
                .expect("second run packet timeout")
                .expect("second run packet receive failed"),
        );
        mock.stop();

        let (_, second_counter) = parse_packet_id(&second.packet.id);
        assert_eq!(
            second_counter, 0,
            "counter should restart from zero after reset"
        );
    }

    #[tokio::test]
    async fn generation_sends_packets_as_single_batch() {
        let mock = MockCapture::new();
        mock.attach_interface("eth0").unwrap();
        mock.update_config(Some(50), None, None, Some(5)).unwrap();

        let (tx, mut rx) = broadcast::channel(16);
        mock.start(tx);

        let batch = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .expect("batch timeout")
            .expect("batch receive failed");

        mock.stop();
        assert_eq!(batch.len(), 5);
    }
}
