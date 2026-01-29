use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};

use crate::types::{AnimatingPacket, CapturedPacket, CaptureStats, PacketResult};

const PACKET_GENERATION_INTERVAL_MS: u64 = 2000;

pub struct MockCapture {
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
}

impl MockCapture {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            packet_counter: Arc::new(AtomicU64::new(0)),
            stats: Arc::new(std::sync::Mutex::new(CaptureStats::default())),
        }
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

        tokio::spawn(async move {
            while is_running.load(Ordering::SeqCst) {
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
