import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { AnimatingPacket, CapturedPacket, PortInfo } from '../types';
import {
  LAYER_ACTIVE_FLASH_DURATION,
  LAYER_TRANSITION_DURATION,
  MAX_ANIMATING_PACKETS,
  MAX_STORED_DROPPED_PACKETS,
  MAX_STORED_DELIVERED_PACKETS,
} from '../constants';

// Store state type
export interface PacketStoreState {
  // Packet counter
  packetCounter: number;

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
}

type Listener = () => void;

// Module-level state
let store: PacketStoreState = createInitialStore(4);
const listeners = new Set<Listener>();
let unlistenPromise: Promise<UnlistenFn> | null = null;
let portCount = 4;
let initialized = false;
let storeGeneration = 0;

// Timers for layer flash
const activeTimers = {
  nic: null as ReturnType<typeof setTimeout> | null,
  fw: null as ReturnType<typeof setTimeout> | null,
};

function createInitialDeliveredPackets(count: number): Record<number, AnimatingPacket[]> {
  const result: Record<number, AnimatingPacket[]> = {};
  for (let i = 0; i < count; i++) {
    result[i] = [];
  }
  return result;
}

function createInitialStore(portCount: number): PacketStoreState {
  return {
    packetCounter: 0,
    deliveredPackets: createInitialDeliveredPackets(portCount),
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
  };
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setNicActive(active: boolean) {
  store = { ...store, nicActive: active };
  emitChange();
}

function setFwActive(active: boolean) {
  store = { ...store, fwActive: active };
  emitChange();
}

function processPacket(packet: AnimatingPacket, result: 'delivered' | 'nic-drop' | 'fw-drop') {
  // Capture current generation to detect stale callbacks
  const generation = storeGeneration;

  // 1. Start incoming animation immediately
  store = {
    ...store,
    incomingPackets: [...store.incomingPackets, packet],
    packetCounter: store.packetCounter + 1,
  };
  emitChange();

  // 2. After LAYER_TRANSITION_DURATION, process at NIC
  setTimeout(() => {
    // Skip if store was reset
    if (generation !== storeGeneration) return;

    // Flash NIC active
    setNicActive(true);
    if (activeTimers.nic) clearTimeout(activeTimers.nic);
    activeTimers.nic = setTimeout(() => setNicActive(false), LAYER_ACTIVE_FLASH_DURATION);

    if (result === 'nic-drop') {
      // NIC drop animation
      store = {
        ...store,
        nicDropAnimations: [...store.nicDropAnimations, packet],
        nicDropped: [...store.nicDropped.slice(-(MAX_STORED_DROPPED_PACKETS - 1)), packet],
      };
      emitChange();
    } else {
      // Move to FW
      store = {
        ...store,
        nicToFwPackets: [...store.nicToFwPackets, packet],
      };
      emitChange();

      // 3. After another delay, process at FW
      setTimeout(() => {
        // Skip if store was reset
        if (generation !== storeGeneration) return;

        // Flash FW active
        setFwActive(true);
        if (activeTimers.fw) clearTimeout(activeTimers.fw);
        activeTimers.fw = setTimeout(() => setFwActive(false), LAYER_ACTIVE_FLASH_DURATION);

        if (result === 'fw-drop') {
          // FW drop animation
          store = {
            ...store,
            fwDropAnimations: [...store.fwDropAnimations, packet],
            firewallDropped: [...store.firewallDropped.slice(-(MAX_STORED_DROPPED_PACKETS - 1)), packet],
          };
          emitChange();
        } else {
          // Delivered - check stream mode
          const isStreamMode = store.fwToPortPackets.length >= MAX_ANIMATING_PACKETS;
          if (isStreamMode) {
            // Skip animation, directly add to delivered
            const targetPort = packet.targetPort ?? 0;
            store = {
              ...store,
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
              fwToPortPackets: [...store.fwToPortPackets, packet],
            };
          }
          emitChange();
        }
      }, LAYER_TRANSITION_DURATION);
    }
  }, LAYER_TRANSITION_DURATION);
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
    await invoke('start_capture');
    subscribeToPackets(true);
    store = { ...store, isCapturing: true };
    emitChange();
  } catch (err) {
    console.error('Failed to start capture:', err);
  }
}

async function stopCapture(): Promise<void> {
  try {
    await invoke('stop_capture');
    subscribeToPackets(false);
    store = { ...store, isCapturing: false };
    emitChange();
  } catch (err) {
    console.error('Failed to stop capture:', err);
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
    await invoke('reset_capture');
    // Increment generation to invalidate pending callbacks
    storeGeneration++;
    store = createInitialStore(portCount);
    emitChange();
    // Restart capture after reset
    await startCapture();
  } catch (err) {
    console.error('Failed to reset capture:', err);
  }
}

export function getSnapshot(): PacketStoreState {
  return store;
}

export function getServerSnapshot(): PacketStoreState {
  return createInitialStore(portCount);
}

export function subscribeToPackets(isCapturing: boolean): void {
  if (isCapturing && !unlistenPromise) {
    unlistenPromise = listen<CapturedPacket>('packet:captured', (event) => {
      const { packet, result } = event.payload;
      processPacket(packet, result);
    });
  } else if (!isCapturing && unlistenPromise) {
    unlistenPromise.then((unlisten) => unlisten());
    unlistenPromise = null;
  }
}

export function initializeStore(ports: readonly PortInfo[]): void {
  portCount = ports.length;
  store = createInitialStore(portCount);
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
  store = createInitialStore(portCount);
  emitChange();
}

// Derived state getters
export function getStreamingPorts(fwToPortPackets: AnimatingPacket[]): number[] {
  if (fwToPortPackets.length < MAX_ANIMATING_PACKETS) {
    return [];
  }
  // Count packets per port
  const portCounts: Record<number, number> = {};
  fwToPortPackets.forEach((p) => {
    const port = p.targetPort ?? 0;
    portCounts[port] = (portCounts[port] || 0) + 1;
  });
  // Return ports with 2+ packets (they're getting busy)
  return Object.entries(portCounts)
    .filter(([, count]) => count >= 2)
    .map(([port]) => Number(port));
}

export function getNicDropStreamMode(nicDropAnimations: AnimatingPacket[]): boolean {
  return nicDropAnimations.length >= MAX_ANIMATING_PACKETS;
}

export function getFwDropStreamMode(fwDropAnimations: AnimatingPacket[]): boolean {
  return fwDropAnimations.length >= MAX_ANIMATING_PACKETS;
}
