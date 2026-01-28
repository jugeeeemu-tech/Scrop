use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::AppHandle;

use aya::maps::AsyncPerfEventArray;
use aya::programs::{Xdp, XdpFlags};
use aya::util::online_cpus;
use aya::EbpfLoader;
use bytes::BytesMut;

use crate::events::emit_captured;
use crate::packet::{AnimatingPacket, CapturedPacket, CaptureStats, PacketResult, Protocol};
use scrop_common::PacketEvent;

use super::CaptureError;

static EBPF_ELF: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/scrop-ebpf"));

pub struct EbpfCapture {
    interface: String,
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
}

impl EbpfCapture {
    pub fn new(interface: &str) -> Self {
        Self {
            interface: interface.to_string(),
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

    pub fn start(&self, app: AppHandle) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return;
        }

        let is_running = Arc::clone(&self.is_running);
        let packet_counter = Arc::clone(&self.packet_counter);
        let stats = Arc::clone(&self.stats);
        let interface = self.interface.clone();

        tokio::spawn(async move {
            if let Err(e) = run_ebpf_capture(app, &interface, is_running.clone(), packet_counter, stats).await {
                eprintln!("eBPF capture error: {}", e);
                is_running.store(false, Ordering::SeqCst);
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

async fn run_ebpf_capture(
    app: AppHandle,
    interface: &str,
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
) -> Result<(), CaptureError> {
    let mut ebpf = EbpfLoader::new()
        .load(EBPF_ELF)
        .map_err(|e| CaptureError::EbpfLoadFailed(e.to_string()))?;

    if let Err(e) = aya_log::EbpfLogger::init(&mut ebpf) {
        eprintln!("eBPF logger init failed (non-fatal): {}", e);
    }

    let program: &mut Xdp = ebpf
        .program_mut("scrop_xdp")
        .ok_or_else(|| CaptureError::EbpfLoadFailed("XDP program 'scrop_xdp' not found".into()))?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| CaptureError::EbpfLoadFailed(e.to_string()))?;

    program
        .load()
        .map_err(|e| CaptureError::EbpfLoadFailed(format!("XDP load: {}", e)))?;

    // DRV_MODE → SKB_MODE フォールバック
    let attach_result = program
        .attach(interface, XdpFlags::DRV_MODE)
        .or_else(|_| {
            eprintln!("DRV_MODE failed, falling back to SKB_MODE");
            program.attach(interface, XdpFlags::SKB_MODE)
        })
        .or_else(|_| {
            eprintln!("SKB_MODE failed, falling back to default");
            program.attach(interface, XdpFlags::default())
        });

    let _link_id = attach_result.map_err(|e| {
        CaptureError::InterfaceNotFound(format!("Failed to attach XDP to {}: {}", interface, e))
    })?;

    eprintln!("XDP program attached to {}", interface);

    let mut perf_array: AsyncPerfEventArray<_> = ebpf
        .take_map("EVENTS")
        .ok_or_else(|| CaptureError::EbpfLoadFailed("EVENTS map not found".into()))?
        .try_into()
        .map_err(|e: aya::maps::MapError| CaptureError::EbpfLoadFailed(e.to_string()))?;

    let cpus = online_cpus()
        .map_err(|e| CaptureError::Other(format!("Failed to get online CPUs: {:?}", e)))?;

    // CPUごとにリーダーを起動
    for cpu_id in cpus {
        let mut buf = perf_array
            .open(cpu_id, None)
            .map_err(|e| CaptureError::Other(format!("Failed to open perf buffer for CPU {}: {}", cpu_id, e)))?;

        let app = app.clone();
        let is_running = Arc::clone(&is_running);
        let packet_counter = Arc::clone(&packet_counter);
        let stats = Arc::clone(&stats);

        tokio::spawn(async move {
            let mut buffers = (0..10)
                .map(|_| BytesMut::with_capacity(std::mem::size_of::<PacketEvent>()))
                .collect::<Vec<_>>();

            while is_running.load(Ordering::SeqCst) {
                let events = match buf.read_events(&mut buffers).await {
                    Ok(events) => events,
                    Err(e) => {
                        eprintln!("Error reading perf events (CPU {}): {}", cpu_id, e);
                        continue;
                    }
                };

                for i in 0..events.read {
                    let event_buf = &buffers[i];
                    if event_buf.len() < std::mem::size_of::<PacketEvent>() {
                        continue;
                    }

                    let event: PacketEvent =
                        unsafe { std::ptr::read_unaligned(event_buf.as_ptr() as *const PacketEvent) };

                    let counter = packet_counter.fetch_add(1, Ordering::SeqCst);
                    let captured = convert_event(&event, counter);

                    {
                        let mut s = stats.lock().unwrap();
                        s.total_packets += 1;
                        match captured.result {
                            PacketResult::Delivered => s.delivered += 1,
                            PacketResult::NicDrop => s.nic_dropped += 1,
                            PacketResult::FwDrop => s.fw_dropped += 1,
                        }
                    }

                    if let Err(e) = emit_captured(&app, &captured) {
                        eprintln!("Failed to emit captured event: {}", e);
                    }
                }
            }
        });
    }

    // メインループ: is_runningがfalseになるまで待機
    while is_running.load(Ordering::SeqCst) {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    // ebpfがdropされるとXDPプログラムは自動的にデタッチされる
    eprintln!("XDP program detached from {}", interface);
    Ok(())
}

fn convert_event(event: &PacketEvent, counter: u64) -> CapturedPacket {
    use rand::Rng;
    let mut rng = rand::rng();

    let id = format!(
        "pkt-{}-{}",
        counter,
        (0..6)
            .map(|_| {
                let idx: u8 = rng.random_range(0..36);
                if idx < 10 {
                    (b'0' + idx) as char
                } else {
                    (b'a' + idx - 10) as char
                }
            })
            .collect::<String>()
    );

    let protocol = match event.protocol {
        6 => Protocol::Tcp,
        17 => Protocol::Udp,
        _ => Protocol::Tcp,
    };

    let source = Ipv4Addr::from(u32::from_be(event.src_addr)).to_string();
    let destination = Ipv4Addr::from(u32::from_be(event.dst_addr)).to_string();

    let packet = AnimatingPacket {
        id,
        protocol,
        size: event.pkt_len,
        source,
        destination,
        dest_port: event.dst_port,
        target_port: None,
        timestamp: chrono::Utc::now().timestamp_millis(),
        reason: None,
    };

    // この段階では全パケットをDeliveredとして扱う
    CapturedPacket {
        packet,
        result: PacketResult::Delivered,
    }
}
