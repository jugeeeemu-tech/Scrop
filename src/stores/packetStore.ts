import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { AnimatingPacket, CapturedPacket, PortInfo } from '../types';
import {
  LAYER_ACTIVE_FLASH_DURATION,
  LAYER_TRANSITION_DURATION,
  STREAM_MODE_RATE_WINDOW,
  STREAM_MODE_RATE_THRESHOLD,
  STREAM_MODE_RATE_EXIT_THRESHOLD,
  MAX_STORED_DROPPED_PACKETS,
  MAX_STORED_DELIVERED_PACKETS,
  ETC_PORT_KEY,
  getPortKey,
} from '../constants';
import { getPorts, subscribePorts } from './portStore';
import {
  startMockCapture,
  stopMockCapture,
  resetMockCapture,
  addPacketListener,
} from '../mocks/packetGenerator';

// Detect if running in Tauri environment
const isTauri = '__TAURI_INTERNALS__' in window;

/**
 * 宛先ポート番号からポートキーを計算
 * 設定済みポートに該当すればそのポート番号、なければ ETC_PORT_KEY
 */
function resolveTargetPort(destPort: number): number {
  const ports = getPorts();

  for (const portInfo of ports) {
    if (portInfo.type === 'port' && portInfo.port === destPort) {
      return portInfo.port;
    }
  }

  return ETC_PORT_KEY;
}

// Store state type
export interface PacketStoreState {
  // Packet counters
  deliveredCounter: number;
  droppedCounter: number;

  // Per-component cumulative counters
  nicDroppedCounter: number;
  fwDroppedCounter: number;
  deliveredCounterPerPort: Record<number, number>;

  // Stored packets
  deliveredPackets: Record<number, AnimatingPacket[]>;
  firewallDropped: AnimatingPacket[];
  nicDropped: AnimatingPacket[];

  // Animation states
  incomingPackets: AnimatingPacket[];
  nicToFwPackets: AnimatingPacket[];
  fwToPortPackets: AnimatingPacket[];
  nicDropAnimations: AnimatingPacket[];
  fwDropAnimations: AnimatingPacket[];

  // Layer active states
  nicActive: boolean;
  fwActive: boolean;

  // Capture state
  isCapturing: boolean;

  // Error state
  error: string | null;

  // Stream mode states (calculated internally, consumed by UI)
  isIncomingStreamMode: boolean;
  isNicToFwStreamMode: boolean;
  streamingPorts: number[];
  isNicDropStreamMode: boolean;
  isFwDropStreamMode: boolean;
}

type Listener = () => void;

// Module-level state
let store: PacketStoreState = createInitialStore(getPorts());
const listeners = new Set<Listener>();
let unlistenPromise: Promise<UnlistenFn> | null = null;
let mockUnsubscribe: (() => void) | null = null;
let initialized = false;
let storeGeneration = 0;

// Rate tracking for stream mode
const recentDeliveredTimesPerPort: Record<number, number[]> = {};
const recentNicDropTimes: number[] = [];
const recentFwDropTimes: number[] = [];
const recentNicToFwTimes: number[] = [];
const recentIncomingTimes: number[] = [];
let rateWindowTimer: ReturnType<typeof setTimeout> | null = null;

// Timers for layer flash
const activeTimers = {
  nic: null as ReturnType<typeof setTimeout> | null,
  fw: null as ReturnType<typeof setTimeout> | null,
};

function createInitialDeliveredPackets(ports: PortInfo[]): Record<number, AnimatingPacket[]> {
  const result: Record<number, AnimatingPacket[]> = {};
  for (const portInfo of ports) {
    result[getPortKey(portInfo)] = [];
  }
  return result;
}

function createInitialDeliveredCounterPerPort(ports: PortInfo[]): Record<number, number> {
  const result: Record<number, number> = {};
  for (const portInfo of ports) {
    result[getPortKey(portInfo)] = 0;
  }
  return result;
}

function createInitialStore(ports: PortInfo[]): PacketStoreState {
  return {
    deliveredCounter: 0,
    droppedCounter: 0,
    nicDroppedCounter: 0,
    fwDroppedCounter: 0,
    deliveredCounterPerPort: createInitialDeliveredCounterPerPort(ports),
    deliveredPackets: createInitialDeliveredPackets(ports),
    firewallDropped: [],
    nicDropped: [],
    incomingPackets: [],
    nicToFwPackets: [],
    fwToPortPackets: [],
    nicDropAnimations: [],
    fwDropAnimations: [],
    nicActive: false,
    fwActive: false,
    isCapturing: false,
    error: null,
    isIncomingStreamMode: false,
    isNicToFwStreamMode: false,
    streamingPorts: [],
    isNicDropStreamMode: false,
    isFwDropStreamMode: false,
  };
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function formatError(err: unknown, userMessage: string): string {
  if (import.meta.env.DEV) {
    return err instanceof Error ? err.message : String(err);
  }
  return userMessage;
}

function getRate(times: number[]): number {
  const now = Date.now();
  while (times.length > 0 && now - times[0] >= STREAM_MODE_RATE_WINDOW) {
    times.shift();
  }
  return times.length;
}

function getActiveStreamPorts(): number[] {
  const ports: number[] = [];
  for (const portStr of Object.keys(recentDeliveredTimesPerPort)) {
    const port = Number(portStr);
    if (getRate(recentDeliveredTimesPerPort[port]) >= STREAM_MODE_RATE_THRESHOLD) {
      ports.push(port);
    }
  }
  return ports;
}

function pushDeliveredTime(port: number, now: number) {
  if (!recentDeliveredTimesPerPort[port]) recentDeliveredTimesPerPort[port] = [];
  recentDeliveredTimesPerPort[port].push(now);
}

function clearRateTimes() {
  for (const key of Object.keys(recentDeliveredTimesPerPort)) {
    delete recentDeliveredTimesPerPort[Number(key)];
  }
  recentNicDropTimes.length = 0;
  recentFwDropTimes.length = 0;
  recentNicToFwTimes.length = 0;
  recentIncomingTimes.length = 0;
  if (rateWindowTimer) {
    clearTimeout(rateWindowTimer);
    rateWindowTimer = null;
  }
}

type PacketResult = 'delivered' | 'nic-drop' | 'fw-drop';

/**
 * 定期的にレートをチェックし、exit閾値を下回ったらストリームモードを即座にOFFにする
 * デバウンスではなく定期実行（タイマーが既にあればスキップ）
 */
function scheduleRateWindowUpdate() {
  if (rateWindowTimer) return;
  rateWindowTimer = setTimeout(() => {
    rateWindowTimer = null;

    const nextIncoming = store.isIncomingStreamMode && getRate(recentIncomingTimes) >= STREAM_MODE_RATE_EXIT_THRESHOLD;
    const nextNicToFw = store.isNicToFwStreamMode && getRate(recentNicToFwTimes) >= STREAM_MODE_RATE_EXIT_THRESHOLD;
    const nextNicDrop = store.isNicDropStreamMode && getRate(recentNicDropTimes) >= STREAM_MODE_RATE_EXIT_THRESHOLD;
    const nextFwDrop = store.isFwDropStreamMode && getRate(recentFwDropTimes) >= STREAM_MODE_RATE_EXIT_THRESHOLD;

    // Per-port exit check
    const nextStreamingPorts = store.streamingPorts.filter((port) => {
      const portRate = recentDeliveredTimesPerPort[port] ? getRate(recentDeliveredTimesPerPort[port]) : 0;
      return portRate >= STREAM_MODE_RATE_EXIT_THRESHOLD;
    });

    store = {
      ...store,
      isIncomingStreamMode: nextIncoming,
      isNicToFwStreamMode: nextNicToFw,
      isNicDropStreamMode: nextNicDrop,
      isFwDropStreamMode: nextFwDrop,
      streamingPorts: nextStreamingPorts,
    };
    emitChange();

    // まだストリームモードのphaseがあれば再スケジュール
    const hasActive = nextIncoming || nextNicToFw || nextNicDrop || nextFwDrop || nextStreamingPorts.length > 0;
    if (hasActive) {
      scheduleRateWindowUpdate();
    }
  }, STREAM_MODE_RATE_WINDOW);
}

/**
 * NIC層の処理
 * nic-drop: ドロップ履歴に追加（ストリーム時はドロップアニメーションスキップ）
 * pass: ストリームならFW処理へ即座に進む、通常ならnicToFwアニメーション後にFW処理
 */
function processNIC(packet: AnimatingPacket, result: PacketResult, generation: number) {
  if (generation !== storeGeneration) return;

  const now = Date.now();

  // NICアクティブフラッシュタイマー
  if (activeTimers.nic) clearTimeout(activeTimers.nic);
  activeTimers.nic = setTimeout(() => {
    store = { ...store, nicActive: false };
    emitChange();
  }, LAYER_ACTIVE_FLASH_DURATION);

  if (result === 'nic-drop') {
    recentNicDropTimes.push(now);
    const isAboveThreshold = getRate(recentNicDropTimes) >= STREAM_MODE_RATE_THRESHOLD;
    const isStreamMode = isAboveThreshold || store.isNicDropStreamMode;

    store = {
      ...store,
      nicActive: true,
      isNicDropStreamMode: isStreamMode,
      droppedCounter: store.droppedCounter + 1,
      nicDroppedCounter: store.nicDroppedCounter + 1,
      nicDropped: [...store.nicDropped.slice(-(MAX_STORED_DROPPED_PACKETS - 1)), packet],
      ...(isStreamMode ? {} : {
        nicDropAnimations: [...store.nicDropAnimations, packet],
      }),
    };
    emitChange();
    return;
  }

  // NIC通過
  recentNicToFwTimes.push(now);
  const isNicToFwAbove = getRate(recentNicToFwTimes) >= STREAM_MODE_RATE_THRESHOLD;
  const isNicToFwStream = isNicToFwAbove || store.isNicToFwStreamMode;

  if (isNicToFwStream) {
    // ストリーム中: NIC→FWアニメーションをスキップ、直接FW処理へ
    store = { ...store, nicActive: true, isNicToFwStreamMode: true };
    emitChange();
    processFW(packet, result, generation);
  } else {
    // 通常: nicToFwPacketsに追加、遅延後にFW処理
    store = {
      ...store,
      nicActive: true,
      nicToFwPackets: [...store.nicToFwPackets, packet],
    };
    emitChange();
    setTimeout(() => processFW(packet, result, generation), LAYER_TRANSITION_DURATION);
  }
}

/**
 * FW層の処理
 * fw-drop: ドロップ履歴に追加（ストリーム時はドロップアニメーションスキップ）
 * delivered: ポートがストリームならdeliveredPacketsへ直接、通常ならfwToPortアニメーション
 */
function processFW(packet: AnimatingPacket, result: PacketResult, generation: number) {
  if (generation !== storeGeneration) return;

  const now = Date.now();

  // FWアクティブフラッシュタイマー
  if (activeTimers.fw) clearTimeout(activeTimers.fw);
  activeTimers.fw = setTimeout(() => {
    store = { ...store, fwActive: false };
    emitChange();
  }, LAYER_ACTIVE_FLASH_DURATION);

  if (result === 'fw-drop') {
    recentFwDropTimes.push(now);
    const isAboveThreshold = getRate(recentFwDropTimes) >= STREAM_MODE_RATE_THRESHOLD;
    const isStreamMode = isAboveThreshold || store.isFwDropStreamMode;

    store = {
      ...store,
      fwActive: true,
      isFwDropStreamMode: isStreamMode,
      droppedCounter: store.droppedCounter + 1,
      fwDroppedCounter: store.fwDroppedCounter + 1,
      firewallDropped: [...store.firewallDropped.slice(-(MAX_STORED_DROPPED_PACKETS - 1)), packet],
      ...(isStreamMode ? {} : {
        fwDropAnimations: [...store.fwDropAnimations, packet],
      }),
    };
    emitChange();
    return;
  }

  // Delivered
  const port = packet.targetPort ?? 0;
  pushDeliveredTime(port, now);
  const activePorts = getActiveStreamPorts();
  const updatedStreamingPorts = [...new Set([...store.streamingPorts, ...activePorts])];
  const isPortStreaming = updatedStreamingPorts.includes(port);

  if (isPortStreaming) {
    // ポートがストリーム中: アニメーションスキップ、直接deliveredPacketsへ
    store = {
      ...store,
      fwActive: true,
      deliveredCounter: store.deliveredCounter + 1,
      deliveredCounterPerPort: {
        ...store.deliveredCounterPerPort,
        [port]: (store.deliveredCounterPerPort[port] || 0) + 1,
      },
      streamingPorts: updatedStreamingPorts,
      deliveredPackets: {
        ...store.deliveredPackets,
        [port]: [...(store.deliveredPackets[port] || []).slice(-(MAX_STORED_DELIVERED_PACKETS - 1)), packet],
      },
    };
  } else {
    // 通常: fwToPortPacketsに追加してアニメーション
    store = {
      ...store,
      fwActive: true,
      deliveredCounter: store.deliveredCounter + 1,
      deliveredCounterPerPort: {
        ...store.deliveredCounterPerPort,
        [port]: (store.deliveredCounterPerPort[port] || 0) + 1,
      },
      streamingPorts: updatedStreamingPorts,
      fwToPortPackets: [...store.fwToPortPackets, packet],
    };
  }
  emitChange();
}

/**
 * パケット処理のエントリポイント
 * 各レイヤーが独立してストリーム判定を行い、ストリームなら即座に次の処理へ進む
 */
function processPacket(rawPacket: AnimatingPacket, result: PacketResult) {
  const packet = { ...rawPacket, targetPort: resolveTargetPort(rawPacket.destPort) };
  const generation = storeGeneration;

  // Incomingレート追跡
  recentIncomingTimes.push(Date.now());
  const isAboveThreshold = getRate(recentIncomingTimes) >= STREAM_MODE_RATE_THRESHOLD;
  // Enter閾値以上 or 既にストリームモード → ストリーム維持（exitはscheduleRateWindowUpdateが担当）
  const isStreamMode = isAboveThreshold || store.isIncomingStreamMode;

  scheduleRateWindowUpdate();

  if (isStreamMode) {
    // ストリーム中: incomingアニメーションをスキップ、直接NIC処理へ
    store = {
      ...store,
      isIncomingStreamMode: true,
    };
    emitChange();
    processNIC(packet, result, generation);
  } else {
    // 通常: incomingPacketsに追加、遅延後にNIC処理
    store = {
      ...store,
      incomingPackets: [...store.incomingPackets, packet],
    };
    emitChange();
    setTimeout(() => processNIC(packet, result, generation), LAYER_TRANSITION_DURATION);
  }
}

// Public API

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  // Auto-start capture on first subscriber
  if (!initialized) {
    initialized = true;
    startCapture();
  }

  return () => listeners.delete(listener);
}

async function startCapture(): Promise<void> {
  try {
    if (isTauri) {
      await invoke('start_capture');
    } else {
      startMockCapture();
    }
    subscribeToPackets(true);
    store = { ...store, isCapturing: true, error: null };
    emitChange();
  } catch (err) {
    console.error('Failed to start capture:', err);
    store = { ...store, error: formatError(err, 'キャプチャの開始に失敗しました') };
    emitChange();
  }
}

async function stopCapture(): Promise<void> {
  try {
    if (isTauri) {
      await invoke('stop_capture');
    } else {
      stopMockCapture();
    }
    subscribeToPackets(false);
    store = { ...store, isCapturing: false, error: null };
    emitChange();
  } catch (err) {
    console.error('Failed to stop capture:', err);
    store = { ...store, error: formatError(err, 'キャプチャの停止に失敗しました') };
    emitChange();
  }
}

export async function toggleCapture(): Promise<void> {
  if (store.isCapturing) {
    await stopCapture();
  } else {
    await startCapture();
  }
}

export async function resetCapture(): Promise<void> {
  try {
    // Stop capture first if running
    if (store.isCapturing) {
      await stopCapture();
    }
    if (isTauri) {
      await invoke('reset_capture');
    } else {
      resetMockCapture();
    }
    // Increment generation to invalidate pending callbacks
    storeGeneration++;
    clearRateTimes();
    store = createInitialStore(getPorts());
    emitChange();
    // Restart capture after reset
    await startCapture();
  } catch (err) {
    console.error('Failed to reset capture:', err);
    store = { ...store, error: formatError(err, 'リセットに失敗しました') };
    emitChange();
  }
}

export function getSnapshot(): PacketStoreState {
  return store;
}

export function getServerSnapshot(): PacketStoreState {
  return createInitialStore(getPorts());
}

export function subscribeToPackets(isCapturing: boolean): void {
  if (isTauri) {
    if (isCapturing && !unlistenPromise) {
      unlistenPromise = listen<CapturedPacket>('packet:captured', (event) => {
        const { packet, result } = event.payload;
        processPacket(packet, result);
      });
    } else if (!isCapturing && unlistenPromise) {
      unlistenPromise.then((unlisten) => unlisten());
      unlistenPromise = null;
    }
  } else {
    if (isCapturing && !mockUnsubscribe) {
      mockUnsubscribe = addPacketListener((captured) => {
        processPacket(captured.packet, captured.result);
      });
    } else if (!isCapturing && mockUnsubscribe) {
      mockUnsubscribe();
      mockUnsubscribe = null;
    }
  }
}

export function syncPortConfig(ports: PortInfo[]): void {
  const newDeliveredPackets = { ...store.deliveredPackets };
  const newCounterPerPort = { ...store.deliveredCounterPerPort };
  // 現在のポート群のキーセットを作成
  const currentKeys = new Set(ports.map(getPortKey));
  // 新しいポートのエントリを確保
  for (const key of currentKeys) {
    if (!(key in newDeliveredPackets)) newDeliveredPackets[key] = [];
    if (!(key in newCounterPerPort)) newCounterPerPort[key] = 0;
  }
  // 削除されたポートのデータを削除
  for (const key of Object.keys(newDeliveredPackets)) {
    const numKey = Number(key);
    if (!currentKeys.has(numKey)) {
      delete newDeliveredPackets[numKey];
      delete newCounterPerPort[numKey];
    }
  }
  store = { ...store, deliveredPackets: newDeliveredPackets, deliveredCounterPerPort: newCounterPerPort };
  emitChange();
}

export function handleIncomingComplete(packetId: string): void {
  store = {
    ...store,
    incomingPackets: store.incomingPackets.filter((p) => p.id !== packetId),
  };
  emitChange();
}

export function handleNicToFwComplete(packetId: string): void {
  store = {
    ...store,
    nicToFwPackets: store.nicToFwPackets.filter((p) => p.id !== packetId),
  };
  emitChange();
}

export function handleFwToPortComplete(packetId: string, targetPort: number): void {
  const packet = store.fwToPortPackets.find((p) => p.id === packetId);
  if (packet) {
    store = {
      ...store,
      fwToPortPackets: store.fwToPortPackets.filter((p) => p.id !== packetId),
      deliveredPackets: {
        ...store.deliveredPackets,
        [targetPort]: [
          ...(store.deliveredPackets[targetPort] || []).slice(-(MAX_STORED_DELIVERED_PACKETS - 1)),
          packet,
        ],
      },
    };
  } else {
    store = {
      ...store,
      fwToPortPackets: store.fwToPortPackets.filter((p) => p.id !== packetId),
    };
  }
  emitChange();
}

export function handleDropAnimationComplete(packetId: string, layer: 'nic' | 'fw'): void {
  if (layer === 'nic') {
    store = {
      ...store,
      nicDropAnimations: store.nicDropAnimations.filter((p) => p.id !== packetId),
    };
  } else {
    store = {
      ...store,
      fwDropAnimations: store.fwDropAnimations.filter((p) => p.id !== packetId),
    };
  }
  emitChange();
}

export function clearAll(): void {
  // Increment generation to invalidate pending callbacks
  storeGeneration++;
  clearRateTimes();
  store = createInitialStore(getPorts());
  emitChange();
}

// Module-level subscription: sync packetStore when portStore changes
let _prevPortsRef: PortInfo[] | null = null;
subscribePorts(() => {
  const currentPorts = getPorts();
  if (currentPorts !== _prevPortsRef) {
    _prevPortsRef = currentPorts;
    syncPortConfig(currentPorts);
  }
});
