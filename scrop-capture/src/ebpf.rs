use std::borrow::Borrow;
use std::collections::{HashMap, VecDeque};
use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::unix::AsyncFd;
use tokio::sync::{broadcast, mpsc, oneshot};

use aya::maps::{HashMap as AyaHashMap, MapData, PerCpuArray, RingBuf};
use aya::programs::xdp::XdpLinkId;
use aya::programs::{TracePoint, Xdp, XdpFlags};
use aya::{Btf, EbpfLoader};
use tracing::{error, info, warn};

use crate::types::{
    build_packet_id, generate_session_id, AnimatingPacket, CaptureStats, CapturedPacket,
    CapturedPacketEnvelope, PacketResult, Protocol,
};
use scrop_common::{PacketEvent, ACTION_KFREE_SKB, ACTION_XDP_PASS};

use crate::drop_reason::DropReasonResolver;
use crate::{CaptureError, BATCH_FLUSH_INTERVAL_MS, BATCH_MAX_SIZE};

// ELF64 ヘッダは 8-byte アラインメントが必要だが、include_bytes! は 1-byte しか保証しない。
// object クレートがアラインメントを検証するため、明示的に 8-byte 境界に配置する。
#[repr(C, align(8))]
struct AlignedBytes<const N: usize>([u8; N]);

static EBPF_ELF_ALIGNED: &AlignedBytes<
    { include_bytes!(concat!(env!("OUT_DIR"), "/scrop-ebpf")).len() },
> = &AlignedBytes(*include_bytes!(concat!(env!("OUT_DIR"), "/scrop-ebpf")));
static EBPF_ELF: &[u8] = &EBPF_ELF_ALIGNED.0;
const OFFSET_REFRESH_INTERVAL: Duration = Duration::from_secs(30);
const RINGBUF_DROPS_MAP_KEY: u32 = 0;
const RINGBUF_DROP_REFRESH_INTERVAL: Duration = Duration::from_secs(1);
const RINGBUF_DRAIN_LIMIT: usize = 1024;
const CORRELATION_BUCKET_MS: u64 = 5;
const CORRELATION_TIMEOUT_MS: u64 = 50;
const SEARCH_BUCKET_RADIUS: u64 = 1;
const WHEEL_SLOTS: usize = 64;

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

    pub fn start(&self, event_tx: broadcast::Sender<CapturedPacketEnvelope>) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return;
        }

        let (cmd_tx, cmd_rx) = mpsc::channel::<EbpfCommand>(32);
        *self.command_tx.lock().unwrap() = Some(cmd_tx);

        let is_running = Arc::clone(&self.is_running);
        let packet_counter = Arc::clone(&self.packet_counter);
        let stats = Arc::clone(&self.stats);
        let session_id = generate_session_id();

        tokio::spawn(async move {
            if let Err(e) = run_ebpf_capture(
                event_tx,
                cmd_rx,
                is_running.clone(),
                packet_counter,
                stats,
                session_id,
            )
            .await
            {
                error!(error = %e, "fatal eBPF capture error");
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

    pub async fn attach_interface(&self, name: &str) -> Result<(), CaptureError> {
        let tx = self
            .command_tx
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| CaptureError::InvalidState("Capture is not running".to_string()))?;
        let (reply_tx, reply_rx) = oneshot::channel();
        tx.send(EbpfCommand::Attach {
            interface: name.to_string(),
            reply: reply_tx,
        })
        .await
        .map_err(|_| CaptureError::Other("Failed to send attach command".to_string()))?;
        reply_rx
            .await
            .map_err(|_| CaptureError::Other("Failed to receive attach reply".to_string()))?
            .map_err(|msg| classify_ebpf_error(&msg))
    }

    pub async fn detach_interface(&self, name: &str) -> Result<(), CaptureError> {
        let tx = self
            .command_tx
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| CaptureError::InvalidState("Capture is not running".to_string()))?;
        let (reply_tx, reply_rx) = oneshot::channel();
        tx.send(EbpfCommand::Detach {
            interface: name.to_string(),
            reply: reply_tx,
        })
        .await
        .map_err(|_| CaptureError::Other("Failed to send detach command".to_string()))?;
        reply_rx
            .await
            .map_err(|_| CaptureError::Other("Failed to receive detach reply".to_string()))?
            .map_err(|msg| classify_ebpf_error(&msg))
    }
}

fn classify_ebpf_error(msg: &str) -> CaptureError {
    if msg.contains("not found") {
        CaptureError::InterfaceNotFound(msg.to_string())
    } else if msg.contains("not attached") {
        CaptureError::InvalidState(msg.to_string())
    } else {
        CaptureError::Other(msg.to_string())
    }
}

/// インターフェース名から ifindex を取得
fn get_ifindex(iface: &str) -> Option<u32> {
    let path = format!("/sys/class/net/{}/ifindex", iface);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
}

fn clock_gettime_ns(clock_id: libc::clockid_t) -> Result<u64, String> {
    let mut ts = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    let rc = unsafe { libc::clock_gettime(clock_id, &mut ts) };
    if rc != 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    if ts.tv_sec < 0 || ts.tv_nsec < 0 {
        return Err("clock_gettime returned negative timespec".to_string());
    }
    Ok((ts.tv_sec as u64)
        .saturating_mul(1_000_000_000)
        .saturating_add(ts.tv_nsec as u64))
}

fn calculate_epoch_offset_ms() -> Result<f64, String> {
    let realtime_ns = clock_gettime_ns(libc::CLOCK_REALTIME)?;
    let monotonic_ns = clock_gettime_ns(libc::CLOCK_MONOTONIC)?;
    Ok((realtime_ns as f64 - monotonic_ns as f64) / 1_000_000.0)
}

struct EpochOffsetCache {
    epoch_offset_ms: f64,
    last_refresh: Instant,
}

impl EpochOffsetCache {
    fn new() -> Result<Self, String> {
        Ok(Self {
            epoch_offset_ms: calculate_epoch_offset_ms()?,
            last_refresh: Instant::now(),
        })
    }

    fn current_offset_ms(&mut self) -> f64 {
        if self.last_refresh.elapsed() >= OFFSET_REFRESH_INTERVAL {
            match calculate_epoch_offset_ms() {
                Ok(offset_ms) => {
                    self.epoch_offset_ms = offset_ms;
                    self.last_refresh = Instant::now();
                }
                Err(e) => {
                    warn!(error = %e, "failed to refresh epoch offset; reusing previous value");
                    self.last_refresh = Instant::now();
                }
            }
        }
        self.epoch_offset_ms
    }
}

// ---------------------------------------------------------------------------
// 相関ロジック用の型定義
// ---------------------------------------------------------------------------

#[derive(Hash, Eq, PartialEq, Clone, Debug)]
struct FlowSizeKey {
    src_addr: u32,
    dst_addr: u32,
    src_port: u16,
    dst_port: u16,
    protocol: u8,
    size: u32,
}

impl FlowSizeKey {
    fn from_event(event: &PacketEvent) -> Self {
        Self {
            src_addr: event.src_addr,
            dst_addr: event.dst_addr,
            src_port: event.src_port,
            dst_port: event.dst_port,
            protocol: event.protocol,
            size: event.pkt_len,
        }
    }
}

struct PendingPacket {
    event: PacketEvent,
    counter: u64,
    received_at: Instant,
}

#[derive(Default)]
struct BucketSlot {
    epoch_bucket: Option<u64>,
    by_key: HashMap<FlowSizeKey, VecDeque<PendingPacket>>,
}

struct Correlator {
    base_instant: Instant,
    wheel: Vec<BucketSlot>,
}

impl Correlator {
    fn new(base_instant: Instant) -> Self {
        Self {
            base_instant,
            wheel: (0..WHEEL_SLOTS).map(|_| BucketSlot::default()).collect(),
        }
    }

    fn bucket_of(&self, now: Instant) -> u64 {
        let elapsed_ms = now.saturating_duration_since(self.base_instant).as_millis();
        (elapsed_ms as u64) / CORRELATION_BUCKET_MS
    }

    fn register_pass(&mut self, event: PacketEvent, counter: u64, now: Instant) {
        let bucket = self.bucket_of(now);
        let key = FlowSizeKey::from_event(&event);
        let slot = self.slot_for_write(bucket);
        slot.by_key.entry(key).or_default().push_back(PendingPacket {
            event,
            counter,
            received_at: now,
        });
    }

    fn match_kfree(&mut self, event: &PacketEvent, now: Instant) -> Option<PendingPacket> {
        let key = FlowSizeKey::from_event(event);
        let now_bucket = self.bucket_of(now);
        let search_buckets = Self::search_buckets(now_bucket);

        let mut best: Option<(u64, usize, Duration)> = None;
        for (bucket_order, bucket) in search_buckets.into_iter().enumerate() {
            let Some(slot) = self.slot_for_epoch(bucket) else {
                continue;
            };
            let Some(queue) = slot.by_key.get(&key) else {
                continue;
            };
            let Some(candidate) = queue.back() else {
                continue;
            };

            // register_pass は push_back なので queue は受信時刻昇順を保つ。
            // 相関時点では now >= received_at を満たすため、最短距離候補は末尾でよい。
            let distance = instant_distance(candidate.received_at, now);
            match &mut best {
                None => best = Some((bucket, bucket_order, distance)),
                Some((best_bucket, best_order, best_dist)) => {
                    if distance < *best_dist || (distance == *best_dist && bucket_order < *best_order)
                    {
                        *best_bucket = bucket;
                        *best_order = bucket_order;
                        *best_dist = distance;
                    }
                }
            }
        }

        let (bucket, _, _) = best?;
        let slot = self.slot_for_epoch_mut(bucket)?;
        let mut remove_key = false;
        let removed = if let Some(queue) = slot.by_key.get_mut(&key) {
            let removed = pop_latest_nearest_with_fifo_tie(queue);
            remove_key = queue.is_empty();
            removed
        } else {
            None
        };

        if remove_key {
            slot.by_key.remove(&key);
        }

        removed
    }

    fn drain_expired(&mut self, now: Instant) -> Vec<PendingPacket> {
        let now_bucket = self.bucket_of(now);
        let timeout_buckets = CORRELATION_TIMEOUT_MS / CORRELATION_BUCKET_MS;
        let expire_bucket = now_bucket.saturating_sub(timeout_buckets);
        let mut drained = Vec::new();

        for slot in &mut self.wheel {
            let Some(epoch_bucket) = slot.epoch_bucket else {
                continue;
            };
            if epoch_bucket > expire_bucket {
                continue;
            }

            for queue in slot.by_key.values_mut() {
                while let Some(pending) = queue.pop_front() {
                    drained.push(pending);
                }
            }
            slot.by_key.clear();
            slot.epoch_bucket = None;
        }

        drained
    }

    fn is_empty(&self) -> bool {
        self.wheel.iter().all(|slot| slot.by_key.is_empty())
    }

    #[cfg(test)]
    fn pending_len(&self) -> usize {
        self.wheel
            .iter()
            .map(|slot| slot.by_key.values().map(VecDeque::len).sum::<usize>())
            .sum()
    }

    fn search_buckets(center: u64) -> Vec<u64> {
        let mut buckets = Vec::with_capacity(1 + (SEARCH_BUCKET_RADIUS as usize) * 2);
        buckets.push(center);
        for offset in 1..=SEARCH_BUCKET_RADIUS {
            let prev = center.saturating_sub(offset);
            if !buckets.contains(&prev) {
                buckets.push(prev);
            }
            let next = center.saturating_add(offset);
            if !buckets.contains(&next) {
                buckets.push(next);
            }
        }
        buckets
    }

    fn slot_for_write(&mut self, bucket: u64) -> &mut BucketSlot {
        let slot = &mut self.wheel[Self::slot_index(bucket)];
        if slot.epoch_bucket != Some(bucket) {
            slot.epoch_bucket = Some(bucket);
            slot.by_key.clear();
        }
        slot
    }

    fn slot_for_epoch(&self, bucket: u64) -> Option<&BucketSlot> {
        let slot = &self.wheel[Self::slot_index(bucket)];
        if slot.epoch_bucket == Some(bucket) {
            Some(slot)
        } else {
            None
        }
    }

    fn slot_for_epoch_mut(&mut self, bucket: u64) -> Option<&mut BucketSlot> {
        let slot = &mut self.wheel[Self::slot_index(bucket)];
        if slot.epoch_bucket == Some(bucket) {
            Some(slot)
        } else {
            None
        }
    }

    fn slot_index(bucket: u64) -> usize {
        (bucket % WHEEL_SLOTS as u64) as usize
    }
}

fn pop_latest_nearest_with_fifo_tie(queue: &mut VecDeque<PendingPacket>) -> Option<PendingPacket> {
    let latest_ts = queue.back()?.received_at;
    if queue.len() == 1 {
        return queue.pop_back();
    }

    // 末尾が単独時刻なら O(1) で取り出す。
    if queue
        .get(queue.len().saturating_sub(2))
        .is_some_and(|prev| prev.received_at != latest_ts)
    {
        return queue.pop_back();
    }

    // 同時刻 group は FIFO（先頭優先）で取り出す。
    let mut idx = queue.len() - 1;
    while idx > 0
        && queue
            .get(idx - 1)
            .is_some_and(|prev| prev.received_at == latest_ts)
    {
        idx -= 1;
    }
    queue.remove(idx)
}

fn instant_distance(a: Instant, b: Instant) -> Duration {
    if a >= b {
        a.duration_since(b)
    } else {
        b.duration_since(a)
    }
}

// ---------------------------------------------------------------------------
// XDP アタッチヘルパー
// ---------------------------------------------------------------------------

fn attach_xdp(program: &mut Xdp, iface: &str) -> Result<XdpLinkId, String> {
    program
        .attach(iface, XdpFlags::DRV_MODE)
        .or_else(|_| {
            warn!(
                interface = iface,
                "DRV_MODE failed, falling back to SKB_MODE"
            );
            program.attach(iface, XdpFlags::SKB_MODE)
        })
        .or_else(|_| {
            warn!(
                interface = iface,
                "SKB_MODE failed, falling back to default mode"
            );
            program.attach(iface, XdpFlags::default())
        })
        .map_err(|e| format!("Failed to attach XDP to {}: {}", iface, e))
}

// ---------------------------------------------------------------------------
// メインキャプチャループ
// ---------------------------------------------------------------------------

async fn run_ebpf_capture(
    event_tx: broadcast::Sender<CapturedPacketEnvelope>,
    mut cmd_rx: mpsc::Receiver<EbpfCommand>,
    is_running: Arc<AtomicBool>,
    packet_counter: Arc<AtomicU64>,
    stats: Arc<std::sync::Mutex<CaptureStats>>,
    session_id: String,
) -> Result<(), CaptureError> {
    let resolver = Arc::new(DropReasonResolver::new().map_err(|e| CaptureError::Other(e))?);

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
        .ok_or_else(|| {
            CaptureError::EbpfLoadFailed("tracepoint 'scrop_kfree_skb' not found".into())
        })?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| CaptureError::EbpfLoadFailed(e.to_string()))?;

    tp.load()
        .map_err(|e| CaptureError::EbpfLoadFailed(format!("tracepoint load: {}", e)))?;

    tp.attach("skb", "kfree_skb")
        .map_err(|e| CaptureError::EbpfLoadFailed(format!("tracepoint attach: {}", e)))?;

    info!("kfree_skb tracepoint attached");

    // ring buffer のセットアップ
    let ring_buf: RingBuf<_> = ebpf
        .take_map("EVENTS")
        .ok_or_else(|| CaptureError::EbpfLoadFailed("EVENTS map not found".into()))?
        .try_into()
        .map_err(|e: aya::maps::MapError| CaptureError::EbpfLoadFailed(e.to_string()))?;
    let mut ring_buf_fd = AsyncFd::new(ring_buf).map_err(|e| {
        CaptureError::Other(format!("Failed to create ring buffer async fd: {}", e))
    })?;

    let ringbuf_drops: PerCpuArray<_, u64> = ebpf
        .take_map("RINGBUF_DROPS")
        .ok_or_else(|| CaptureError::EbpfLoadFailed("RINGBUF_DROPS map not found".into()))?
        .try_into()
        .map_err(|e: aya::maps::MapError| CaptureError::EbpfLoadFailed(e.to_string()))?;

    // イベント相関用チャネル
    let (tx, mut rx) = mpsc::channel::<(PacketEvent, u64)>(4096);

    // ring buffer リーダーを起動 → チャネルに送信
    let is_running_reader = Arc::clone(&is_running);
    let packet_counter_reader = Arc::clone(&packet_counter);
    let tx_reader = tx.clone();
    tokio::spawn(async move {
        while is_running_reader.load(Ordering::SeqCst) {
            let mut drained: Vec<(PacketEvent, u64)> = Vec::with_capacity(256);
            let mut should_clear_ready = true;

            let mut guard =
                match tokio::time::timeout(Duration::from_millis(100), ring_buf_fd.readable_mut())
                    .await
                {
                    Ok(Ok(g)) => g,
                    Ok(Err(e)) => {
                        warn!(error = %e, "ring buffer became unreadable");
                        tokio::time::sleep(Duration::from_millis(10)).await;
                        continue;
                    }
                    Err(_) => {
                        continue;
                    }
                };

            loop {
                let Some(item) = guard.get_inner_mut().next() else {
                    break;
                };
                if item.len() < std::mem::size_of::<PacketEvent>() {
                    continue;
                }

                let event: PacketEvent =
                    unsafe { std::ptr::read_unaligned(item.as_ptr() as *const PacketEvent) };
                let counter = packet_counter_reader.fetch_add(1, Ordering::SeqCst);
                drained.push((event, counter));
                if drained.len() >= RINGBUF_DRAIN_LIMIT {
                    should_clear_ready = false;
                    break;
                }
            }

            if should_clear_ready {
                guard.clear_ready();
            }
            drop(guard);

            for payload in drained {
                if tx_reader.send(payload).await.is_err() {
                    return;
                }
            }
        }
    });

    // 送信側を閉じる（リーダーがcloneを保持）
    drop(tx);

    let initial_offset_cache = EpochOffsetCache::new()
        .map_err(|e| CaptureError::Other(format!("Failed to initialize epoch offset: {}", e)))?;

    // 相関タスク: XDP と kfree_skb イベントを突き合わせる
    let correlation_event_tx = event_tx.clone();
    let correlation_is_running = Arc::clone(&is_running);
    let correlation_stats = Arc::clone(&stats);
    let correlation_resolver = Arc::clone(&resolver);
    let correlation_session_id = session_id;

    tokio::spawn(async move {
        let mut offset_cache = initial_offset_cache;
        let mut correlator = Correlator::new(Instant::now());
        let mut events_closed = false;
        let mut timeout_interval = tokio::time::interval(tokio::time::Duration::from_millis(10));
        let mut batch_flush_interval =
            tokio::time::interval(tokio::time::Duration::from_millis(BATCH_FLUSH_INTERVAL_MS));
        let mut out_batch: Vec<CapturedPacket> = Vec::with_capacity(BATCH_MAX_SIZE);

        loop {
            tokio::select! {
                recv = rx.recv(), if !events_closed => {
                    match recv {
                        Some((event, counter)) => {
                            let now = Instant::now();

                            if event.action == ACTION_XDP_PASS {
                                // XDP PASS → pending に格納
                                correlator.register_pass(event, counter, now);
                            } else if event.action == ACTION_KFREE_SKB {
                                // kfree_skb → pending から flow+size+time-bucket で相関
                                let result = correlation_resolver.classify_drop(event.drop_reason);
                                let reason = correlation_resolver.drop_reason_string(event.drop_reason, &result);

                                if let Some(p) = correlator.match_kfree(&event, now) {
                                    // XDP で見たパケットがドロップされた
                                    let captured = convert_event(
                                        &p.event,
                                        &correlation_session_id,
                                        p.counter,
                                        result,
                                        Some(reason),
                                    );
                                    update_stats(&correlation_stats, &captured.result);
                                    out_batch.push(captured);
                                    if out_batch.len() >= BATCH_MAX_SIZE {
                                        flush_captured_batch(
                                            &correlation_event_tx,
                                            &mut out_batch,
                                            offset_cache.current_offset_ms(),
                                        );
                                    }
                                }
                                // pending にマッチしない kfree_skb イベントは破棄する
                            }
                        }
                        None => {
                            // 受信クローズ後も pending を timeout 処理で flush する
                            events_closed = true;
                        }
                    }
                }
                _ = timeout_interval.tick() => {
                    if (!correlation_is_running.load(Ordering::SeqCst) || events_closed)
                        && correlator.is_empty()
                    {
                        break;
                    }

                    // タイムアウト: 50ms 超過の pending パケットを Delivered として emit
                    for p in correlator.drain_expired(Instant::now()) {
                        let captured = convert_event(
                            &p.event,
                            &correlation_session_id,
                            p.counter,
                            PacketResult::Delivered,
                            None,
                        );
                        update_stats(&correlation_stats, &captured.result);
                        out_batch.push(captured);
                        if out_batch.len() >= BATCH_MAX_SIZE {
                            flush_captured_batch(
                                &correlation_event_tx,
                                &mut out_batch,
                                offset_cache.current_offset_ms(),
                            );
                        }
                    }
                }
                _ = batch_flush_interval.tick() => {
                    flush_captured_batch(
                        &correlation_event_tx,
                        &mut out_batch,
                        offset_cache.current_offset_ms(),
                    );
                }
            }
        }

        flush_captured_batch(
            &correlation_event_tx,
            &mut out_batch,
            offset_cache.current_offset_ms(),
        );
    });

    let mut ringbuf_drop_refresh = tokio::time::interval(RINGBUF_DROP_REFRESH_INTERVAL);
    ringbuf_drop_refresh.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

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
            _ = ringbuf_drop_refresh.tick() => {
                refresh_transport_dropped_stats(&stats, &ringbuf_drops);
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                // 定期的に is_running をチェック
            }
        }
    }

    refresh_transport_dropped_stats(&stats, &ringbuf_drops);

    // ebpfがdropされるとXDPプログラム・トレースポイントは自動的にデタッチされる
    let iface_names: Vec<&str> = attached.keys().map(|s| s.as_str()).collect();
    info!(interfaces = ?iface_names, "XDP program and tracepoint detached");
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

    let ifindex =
        get_ifindex(interface).ok_or_else(|| format!("Interface {} not found", interface))?;

    let program: &mut Xdp = ebpf
        .program_mut("scrop_xdp")
        .ok_or_else(|| "XDP program not found".to_string())?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| e.to_string())?;

    let link_id = attach_xdp(program, interface)?;
    info!(interface, "XDP program attached");

    // MONITORED_IFS に ifindex を登録
    let mut monitored_ifs: AyaHashMap<_, u32, u32> = AyaHashMap::try_from(
        ebpf.map_mut("MONITORED_IFS")
            .ok_or_else(|| "MONITORED_IFS map not found".to_string())?,
    )
    .map_err(|e: aya::maps::MapError| format!("MONITORED_IFS map: {}", e))?;

    monitored_ifs
        .insert(&ifindex, &1, 0)
        .map_err(|e| format!("MONITORED_IFS insert: {}", e))?;
    info!(ifindex, interface, "registered ifindex in MONITORED_IFS");

    attached.insert(interface.to_string(), (link_id, ifindex));
    Ok(())
}

fn handle_detach(
    ebpf: &mut aya::Ebpf,
    interface: &str,
    attached: &mut HashMap<String, (XdpLinkId, u32)>,
) -> Result<(), String> {
    let (link_id, ifindex) = attached
        .remove(interface)
        .ok_or_else(|| format!("Interface {} is not attached", interface))?;

    let program: &mut Xdp = ebpf
        .program_mut("scrop_xdp")
        .ok_or_else(|| "XDP program not found".to_string())?
        .try_into()
        .map_err(|e: aya::programs::ProgramError| e.to_string())?;

    program
        .detach(link_id)
        .map_err(|e| format!("Failed to detach XDP from {}: {}", interface, e))?;

    info!(interface, "XDP program detached");

    // MONITORED_IFS から ifindex を削除
    let mut monitored_ifs: AyaHashMap<_, u32, u32> = AyaHashMap::try_from(
        ebpf.map_mut("MONITORED_IFS")
            .ok_or_else(|| "MONITORED_IFS map not found".to_string())?,
    )
    .map_err(|e: aya::maps::MapError| format!("MONITORED_IFS map: {}", e))?;

    let _ = monitored_ifs.remove(&ifindex);
    info!(ifindex, interface, "removed ifindex from MONITORED_IFS");

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

fn refresh_transport_dropped_stats<T: Borrow<MapData>>(
    stats: &std::sync::Mutex<CaptureStats>,
    ringbuf_drops: &PerCpuArray<T, u64>,
) {
    match ringbuf_drops.get(&RINGBUF_DROPS_MAP_KEY, 0) {
        Ok(per_cpu_values) => {
            let total = per_cpu_values.iter().copied().sum::<u64>();
            stats.lock().unwrap().transport_dropped = total;
        }
        Err(e) => {
            warn!(error = %e, "failed to read RINGBUF_DROPS");
        }
    }
}

fn flush_captured_batch(
    tx: &broadcast::Sender<CapturedPacketEnvelope>,
    out_batch: &mut Vec<CapturedPacket>,
    epoch_offset_ms: f64,
) {
    if out_batch.is_empty() {
        return;
    }
    let packets = std::mem::take(out_batch);
    let _ = tx.send(CapturedPacketEnvelope {
        packets,
        epoch_offset_ms,
    });
}

fn convert_event(
    event: &PacketEvent,
    session_id: &str,
    counter: u64,
    result: PacketResult,
    reason: Option<String>,
) -> CapturedPacket {
    let id = build_packet_id(session_id, counter);

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
        capture_mono_ns: event.ktime_ns,
        reason,
    };

    CapturedPacket { packet, result }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_event(pkt_len: u32, action: u32) -> PacketEvent {
        PacketEvent {
            src_addr: u32::from_be_bytes([192, 168, 0, 1]),
            dst_addr: u32::from_be_bytes([10, 0, 0, 1]),
            src_port: 12345,
            dst_port: 443,
            protocol: 6,
            _padding: [0; 3],
            pkt_len,
            action,
            drop_reason: 0,
            ktime_ns: 42,
        }
    }

    fn at_ms(base: Instant, ms: u64) -> Instant {
        base + Duration::from_millis(ms)
    }

    #[test]
    fn calculate_epoch_offset_ms_returns_finite_value() {
        let offset = calculate_epoch_offset_ms().expect("offset should be available");
        assert!(offset.is_finite());
    }

    #[test]
    fn epoch_offset_cache_refreshes_after_interval() {
        let mut cache = EpochOffsetCache::new().expect("cache should initialize");
        let initial_refresh = cache.last_refresh;
        cache.last_refresh = Instant::now() - OFFSET_REFRESH_INTERVAL - Duration::from_secs(1);
        let _ = cache.current_offset_ms();
        assert!(cache.last_refresh > initial_refresh);
    }

    #[test]
    fn convert_event_sets_capture_mono_ns() {
        let event = PacketEvent {
            src_addr: u32::from_be_bytes([192, 168, 0, 1]),
            dst_addr: u32::from_be_bytes([10, 0, 0, 1]),
            src_port: 12345,
            dst_port: 443,
            protocol: 6,
            _padding: [0; 3],
            pkt_len: 128,
            action: ACTION_XDP_PASS,
            drop_reason: 0,
            ktime_ns: 42,
        };
        let captured = convert_event(&event, "sess01", 7, PacketResult::Delivered, None);
        assert_eq!(captured.packet.capture_mono_ns, 42);
    }

    #[test]
    fn correlator_preserves_multiple_pending_for_same_flow_and_size() {
        let base = Instant::now();
        let mut correlator = Correlator::new(base);
        let pass_event = sample_event(128, ACTION_XDP_PASS);
        let kfree_event = sample_event(128, ACTION_KFREE_SKB);

        correlator.register_pass(pass_event, 1, at_ms(base, 1));
        correlator.register_pass(pass_event, 2, at_ms(base, 2));
        correlator.register_pass(pass_event, 3, at_ms(base, 3));

        assert_eq!(correlator.pending_len(), 3);
        let matched = correlator
            .match_kfree(&kfree_event, at_ms(base, 4))
            .expect("expected a correlated packet");
        assert_eq!(matched.counter, 3);
        assert_eq!(correlator.pending_len(), 2);
    }

    #[test]
    fn correlator_prevents_mismatch_when_size_differs() {
        let base = Instant::now();
        let mut correlator = Correlator::new(base);
        let pass_event = sample_event(128, ACTION_XDP_PASS);
        let kfree_event = sample_event(256, ACTION_KFREE_SKB);

        correlator.register_pass(pass_event, 1, at_ms(base, 1));

        assert!(correlator.match_kfree(&kfree_event, at_ms(base, 2)).is_none());
        assert_eq!(correlator.pending_len(), 1);
    }

    #[test]
    fn correlator_matches_across_bucket_boundary() {
        let base = Instant::now();
        let mut correlator = Correlator::new(base);
        let pass_event = sample_event(128, ACTION_XDP_PASS);
        let kfree_event = sample_event(128, ACTION_KFREE_SKB);

        correlator.register_pass(pass_event, 1, at_ms(base, 4));
        let matched = correlator.match_kfree(&kfree_event, at_ms(base, 6));

        assert!(matched.is_some());
        assert!(correlator.is_empty());
    }

    #[test]
    fn correlator_expires_pending_and_ignores_stale_kfree() {
        let base = Instant::now();
        let mut correlator = Correlator::new(base);
        let pass_event = sample_event(128, ACTION_XDP_PASS);
        let kfree_event = sample_event(128, ACTION_KFREE_SKB);

        correlator.register_pass(pass_event, 1, at_ms(base, 1));

        let expired = correlator.drain_expired(at_ms(base, 60));
        assert_eq!(expired.len(), 1);
        assert_eq!(expired[0].counter, 1);
        assert!(correlator.is_empty());

        assert!(correlator.match_kfree(&kfree_event, at_ms(base, 61)).is_none());
    }

    #[test]
    fn correlator_prefers_shortest_time_distance_then_fifo() {
        let base = Instant::now();
        let mut correlator = Correlator::new(base);
        let pass_event = sample_event(128, ACTION_XDP_PASS);
        let kfree_event = sample_event(128, ACTION_KFREE_SKB);

        correlator.register_pass(pass_event, 1, at_ms(base, 10));
        correlator.register_pass(pass_event, 2, at_ms(base, 10));
        correlator.register_pass(pass_event, 3, at_ms(base, 14));

        let first = correlator
            .match_kfree(&kfree_event, at_ms(base, 13))
            .expect("nearest event should match first");
        assert_eq!(first.counter, 3);

        let tie_now = at_ms(base, 15);
        let second = correlator
            .match_kfree(&kfree_event, tie_now)
            .expect("tie should still produce a match");
        assert_eq!(second.counter, 1);

        let third = correlator
            .match_kfree(&kfree_event, at_ms(base, 12))
            .expect("remaining packet should match");
        assert_eq!(third.counter, 2);
        assert!(correlator.is_empty());
    }
}
