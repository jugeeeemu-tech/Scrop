use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{broadcast, mpsc, oneshot};

use aya::maps::{AsyncPerfEventArray, HashMap as AyaHashMap};
use aya::programs::{TracePoint, Xdp, XdpFlags};
use aya::programs::xdp::XdpLinkId;
use aya::util::online_cpus;
use aya::{Btf, EbpfLoader};
use bytes::BytesMut;

use crate::types::{AnimatingPacket, CapturedPacket, CaptureStats, PacketResult, Protocol};
use scrop_common::{PacketEvent, ACTION_KFREE_SKB, ACTION_XDP_PASS};

use crate::drop_reason::DropReasonResolver;
use crate::CaptureError;

// ELF64 ヘッダは 8-byte アラインメントが必要だが、include_bytes! は 1-byte しか保証しない。
// object クレートがアラインメントを検証するため、明示的に 8-byte 境界に配置する。
#[repr(C, align(8))]
struct AlignedBytes<const N: usize>([u8; N]);

static EBPF_ELF_ALIGNED: &AlignedBytes<{ include_bytes!(concat!(env!("OUT_DIR"), "/scrop-ebpf")).len() }> =
    &AlignedBytes(*include_bytes!(concat!(env!("OUT_DIR"), "/scrop-ebpf")));
static EBPF_ELF: &[u8] = &EBPF_ELF_ALIGNED.0;

// ---------------------------------------------------------------------------
// コマンドチャネル
// ---------------------------------------------------------------------------

pub enum EbpfCommand {
    Attach {
        interface: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Detach {
        interface: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
}

pub struct EbpfCapture {
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
    command_tx: std::sync::Mutex<Option<mpsc::Sender<EbpfCommand>>>,
}

impl EbpfCapture {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            packet_counter: Arc::new(AtomicU64::new(0)),
            stats: Arc::new(std::sync::Mutex::new(CaptureStats::default())),
            command_tx: std::sync::Mutex::new(None),
        }
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn get_stats(&self) -> CaptureStats {
        self.stats.lock().unwrap().clone()
    }

    pub fn start(&self, event_tx: broadcast::Sender<CapturedPacket>) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return;
        }

        let (cmd_tx, cmd_rx) = mpsc::channel::<EbpfCommand>(32);
        *self.command_tx.lock().unwrap() = Some(cmd_tx);

        let is_running = Arc::clone(&self.is_running);
        let packet_counter = Arc::clone(&self.packet_counter);
        let stats = Arc::clone(&self.stats);

        tokio::spawn(async move {
            if let Err(e) = run_ebpf_capture(event_tx, cmd_rx, is_running.clone(), packet_counter, stats).await {
                eprintln!("Fatal: {}", e);
                is_running.store(false, Ordering::SeqCst);
                std::process::exit(1);
            }
        });
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
        // チャネルを閉じてeBPFタスクに通知
        *self.command_tx.lock().unwrap() = None;
    }

    pub fn reset(&self) {
        self.packet_counter.store(0, Ordering::SeqCst);
        *self.stats.lock().unwrap() = CaptureStats::default();
    }

    pub async fn attach_interface(&self, name: &str) -> Result<(), String> {
        let tx = self.command_tx.lock().unwrap().clone()
            .ok_or_else(|| "Capture is not running".to_string())?;
        let (reply_tx, reply_rx) = oneshot::channel();
        tx.send(EbpfCommand::Attach {
            interface: name.to_string(),
            reply: reply_tx,
        }).await.map_err(|_| "Failed to send attach command".to_string())?;
        reply_rx.await.map_err(|_| "Failed to receive attach reply".to_string())?
    }

    pub async fn detach_interface(&self, name: &str) -> Result<(), String> {
        let tx = self.command_tx.lock().unwrap().clone()
            .ok_or_else(|| "Capture is not running".to_string())?;
        let (reply_tx, reply_rx) = oneshot::channel();
        tx.send(EbpfCommand::Detach {
            interface: name.to_string(),
            reply: reply_tx,
        }).await.map_err(|_| "Failed to send detach command".to_string())?;
        reply_rx.await.map_err(|_| "Failed to receive detach reply".to_string())?
    }
}

/// インターフェース名から ifindex を取得
fn get_ifindex(iface: &str) -> Option<u32> {
    let path = format!("/sys/class/net/{}/ifindex", iface);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
}

// ---------------------------------------------------------------------------
// 相関ロジック用の型定義
// ---------------------------------------------------------------------------

#[derive(Hash, Eq, PartialEq, Clone)]
struct FiveTuple {
    src_addr: u32,
    dst_addr: u32,
    src_port: u16,
    dst_port: u16,
    protocol: u8,
}

impl FiveTuple {
    fn from_event(event: &PacketEvent) -> Self {
        Self {
            src_addr: event.src_addr,
            dst_addr: event.dst_addr,
            src_port: event.src_port,
            dst_port: event.dst_port,
            protocol: event.protocol,
        }
    }
}

struct PendingPacket {
    event: PacketEvent,
    counter: u64,
    received_at: Instant,
}

// ---------------------------------------------------------------------------
// XDP アタッチヘルパー
// ---------------------------------------------------------------------------

fn attach_xdp(
    program: &mut Xdp,
    iface: &str,
) -> Result<XdpLinkId, String> {
    program
        .attach(iface, XdpFlags::DRV_MODE)
        .or_else(|_| {
            eprintln!("{}: DRV_MODE failed, falling back to SKB_MODE", iface);
            program.attach(iface, XdpFlags::SKB_MODE)
        })
        .or_else(|_| {
            eprintln!("{}: SKB_MODE failed, falling back to default", iface);
            program.attach(iface, XdpFlags::default())
        })
        .map_err(|e| format!("Failed to attach XDP to {}: {}", iface, e))
}

// ---------------------------------------------------------------------------
// メインキャプチャループ
// ---------------------------------------------------------------------------

async fn run_ebpf_capture(
    event_tx: broadcast::Sender<CapturedPacket>,
    mut cmd_rx: mpsc::Receiver<EbpfCommand>,
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
) -> Result<(), CaptureError> {
    let resolver = Arc::new(
        DropReasonResolver::new().map_err(|e| CaptureError::Other(e))?,
    );

    let mut ebpf = EbpfLoader::new()
        .btf(Btf::from_sys_fs().ok().as_ref())
        .load(EBPF_ELF)
        .map_err(|e| CaptureError::EbpfLoadFailed(e.to_string()))?;

    // XDP プログラムのロード
    let program: &mut Xdp = ebpf
        .program_mut("scrop_xdp")
        .ok_or_else(|| CaptureError::EbpfLoadFailed("XDP program 'scrop_xdp' not found".into()))?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| CaptureError::EbpfLoadFailed(e.to_string()))?;

    program
        .load()
        .map_err(|e| CaptureError::EbpfLoadFailed(format!("XDP load: {}", e)))?;

    // 動的リンク管理テーブル（コマンドで操作）
    let mut attached: HashMap<String, (XdpLinkId, u32)> = HashMap::new();

    // kfree_skb トレースポイントのロード・アタッチ
    let tp: &mut TracePoint = ebpf
        .program_mut("scrop_kfree_skb")
        .ok_or_else(|| CaptureError::EbpfLoadFailed("tracepoint 'scrop_kfree_skb' not found".into()))?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| CaptureError::EbpfLoadFailed(e.to_string()))?;

    tp.load()
        .map_err(|e| CaptureError::EbpfLoadFailed(format!("tracepoint load: {}", e)))?;

    tp.attach("skb", "kfree_skb")
        .map_err(|e| CaptureError::EbpfLoadFailed(format!("tracepoint attach: {}", e)))?;

    eprintln!("kfree_skb tracepoint attached");

    // Perf イベントのセットアップ
    let mut perf_array: AsyncPerfEventArray<_> = ebpf
        .take_map("EVENTS")
        .ok_or_else(|| CaptureError::EbpfLoadFailed("EVENTS map not found".into()))?
        .try_into()
        .map_err(|e: aya::maps::MapError| CaptureError::EbpfLoadFailed(e.to_string()))?;

    let cpus = online_cpus()
        .map_err(|e| CaptureError::Other(format!("Failed to get online CPUs: {:?}", e)))?;

    // イベント相関用チャネル
    let (tx, mut rx) = mpsc::channel::<(PacketEvent, u64)>(4096);

    // CPUごとにリーダーを起動 → チャネルに送信
    for cpu_id in cpus {
        let mut buf = perf_array
            .open(cpu_id, None)
            .map_err(|e| CaptureError::Other(format!("Failed to open perf buffer for CPU {}: {}", cpu_id, e)))?;

        let is_running = Arc::clone(&is_running);
        let packet_counter = Arc::clone(&packet_counter);
        let tx = tx.clone();

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
                    let _ = tx.send((event, counter)).await;
                }
            }
        });
    }

    // 送信側を閉じる（全CPUリーダーがcloneを保持）
    drop(tx);

    // 相関タスク: XDP と kfree_skb イベントを突き合わせる
    let correlation_event_tx = event_tx.clone();
    let correlation_is_running = Arc::clone(&is_running);
    let correlation_stats = Arc::clone(&stats);
    let correlation_resolver = Arc::clone(&resolver);

    tokio::spawn(async move {
        let mut pending: HashMap<FiveTuple, PendingPacket> = HashMap::new();
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(10));
        const TIMEOUT_MS: u128 = 50;

        loop {
            tokio::select! {
                recv = rx.recv() => {
                    match recv {
                        Some((event, counter)) => {
                            let tuple = FiveTuple::from_event(&event);

                            if event.action == ACTION_XDP_PASS {
                                // XDP PASS → pending に格納
                                pending.insert(tuple, PendingPacket {
                                    event,
                                    counter,
                                    received_at: Instant::now(),
                                });
                            } else if event.action == ACTION_KFREE_SKB {
                                // kfree_skb → pending から 5-tuple でマッチ検索
                                let result = correlation_resolver.classify_drop(event.drop_reason);
                                let reason = correlation_resolver.drop_reason_string(event.drop_reason, &result);

                                if let Some(p) = pending.remove(&tuple) {
                                    // XDP で見たパケットがドロップされた
                                    let captured = convert_event(&p.event, p.counter, result, Some(reason));
                                    update_stats(&correlation_stats, &captured.result);
                                    let _ = correlation_event_tx.send(captured);
                                }
                                // pending にマッチしない kfree_skb イベントは破棄する
                            }
                        }
                        None => break, // チャネル閉鎖
                    }
                }
                _ = interval.tick() => {
                    if !correlation_is_running.load(Ordering::SeqCst) && pending.is_empty() {
                        break;
                    }

                    // タイムアウト: 50ms 超過の pending パケットを Delivered として emit
                    let now = Instant::now();
                    let expired: Vec<FiveTuple> = pending
                        .iter()
                        .filter(|(_, p)| now.duration_since(p.received_at).as_millis() > TIMEOUT_MS)
                        .map(|(k, _)| k.clone())
                        .collect();

                    for key in expired {
                        if let Some(p) = pending.remove(&key) {
                            let captured = convert_event(&p.event, p.counter, PacketResult::Delivered, None);
                            update_stats(&correlation_stats, &captured.result);
                            let _ = correlation_event_tx.send(captured);
                        }
                    }
                }
            }
        }
    });

    // コマンドループ: attach/detach コマンドを受信して処理
    while is_running.load(Ordering::SeqCst) {
        tokio::select! {
            cmd = cmd_rx.recv() => {
                match cmd {
                    Some(EbpfCommand::Attach { interface, reply }) => {
                        let result = handle_attach(&mut ebpf, &interface, &mut attached);
                        let _ = reply.send(result);
                    }
                    Some(EbpfCommand::Detach { interface, reply }) => {
                        let result = handle_detach(&mut ebpf, &interface, &mut attached);
                        let _ = reply.send(result);
                    }
                    None => break, // チャネル閉鎖 = stop
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                // 定期的に is_running をチェック
            }
        }
    }

    // ebpfがdropされるとXDPプログラム・トレースポイントは自動的にデタッチされる
    let iface_names: Vec<&str> = attached.keys().map(|s| s.as_str()).collect();
    eprintln!("XDP program and tracepoint detached from {:?}", iface_names);
    Ok(())
}

fn handle_attach(
    ebpf: &mut aya::Ebpf,
    interface: &str,
    attached: &mut HashMap<String, (XdpLinkId, u32)>,
) -> Result<(), String> {
    if attached.contains_key(interface) {
        return Ok(());
    }

    let ifindex = get_ifindex(interface)
        .ok_or_else(|| format!("Interface {} not found", interface))?;

    let program: &mut Xdp = ebpf
        .program_mut("scrop_xdp")
        .ok_or_else(|| "XDP program not found".to_string())?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| e.to_string())?;

    let link_id = attach_xdp(program, interface)?;
    eprintln!("XDP program attached to {}", interface);

    // MONITORED_IFS に ifindex を登録
    let mut monitored_ifs: AyaHashMap<_, u32, u32> = AyaHashMap::try_from(
        ebpf.map_mut("MONITORED_IFS")
            .ok_or_else(|| "MONITORED_IFS map not found".to_string())?,
    )
    .map_err(|e: aya::maps::MapError| format!("MONITORED_IFS map: {}", e))?;

    monitored_ifs
        .insert(&ifindex, &1, 0)
        .map_err(|e| format!("MONITORED_IFS insert: {}", e))?;
    eprintln!("Registered ifindex {} ({}) in MONITORED_IFS", ifindex, interface);

    attached.insert(interface.to_string(), (link_id, ifindex));
    Ok(())
}

fn handle_detach(
    ebpf: &mut aya::Ebpf,
    interface: &str,
    attached: &mut HashMap<String, (XdpLinkId, u32)>,
) -> Result<(), String> {
    let (link_id, ifindex) = attached.remove(interface)
        .ok_or_else(|| format!("Interface {} is not attached", interface))?;

    let program: &mut Xdp = ebpf
        .program_mut("scrop_xdp")
        .ok_or_else(|| "XDP program not found".to_string())?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| e.to_string())?;

    program.detach(link_id)
        .map_err(|e| format!("Failed to detach XDP from {}: {}", interface, e))?;

    eprintln!("XDP program detached from {}", interface);

    // MONITORED_IFS から ifindex を削除
    let mut monitored_ifs: AyaHashMap<_, u32, u32> = AyaHashMap::try_from(
        ebpf.map_mut("MONITORED_IFS")
            .ok_or_else(|| "MONITORED_IFS map not found".to_string())?,
    )
    .map_err(|e: aya::maps::MapError| format!("MONITORED_IFS map: {}", e))?;

    let _ = monitored_ifs.remove(&ifindex);
    eprintln!("Removed ifindex {} ({}) from MONITORED_IFS", ifindex, interface);

    Ok(())
}

fn update_stats(stats: &std::sync::Mutex<CaptureStats>, result: &PacketResult) {
    let mut s = stats.lock().unwrap();
    s.total_packets += 1;
    match result {
        PacketResult::Delivered => s.delivered += 1,
        PacketResult::NicDrop => s.nic_dropped += 1,
        PacketResult::FwDrop => s.fw_dropped += 1,
    }
}

fn convert_event(event: &PacketEvent, counter: u64, result: PacketResult, reason: Option<String>) -> CapturedPacket {
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
        src_port: event.src_port,
        destination,
        dest_port: event.dst_port,
        target_port: None,
        timestamp: chrono::Utc::now().timestamp_millis(),
        reason,
    };

    CapturedPacket {
        packet,
        result,
    }
}
