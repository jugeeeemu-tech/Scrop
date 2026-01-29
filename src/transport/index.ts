import type { CapturedPacket } from '../types';

export interface Transport {
  startCapture(): Promise<void>;
  stopCapture(): Promise<void>;
  resetCapture(): Promise<void>;
  listInterfaces(): Promise<string[]>;
  attachInterface(name: string): Promise<void>;
  detachInterface(name: string): Promise<void>;
  subscribePackets(onPacket: (data: CapturedPacket) => void): () => void;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let _transport: Transport | null = null;

export async function getTransport(): Promise<Transport> {
  if (_transport) return _transport;

  if (isTauri) {
    const { createTauriTransport } = await import('./tauri');
    _transport = createTauriTransport();
  } else {
    const { createWebTransport } = await import('./web');
    _transport = createWebTransport();
  }

  return _transport;
}

// Synchronous access after initialization
export function getTransportSync(): Transport {
  if (!_transport) {
    throw new Error('Transport not initialized. Call getTransport() first.');
  }
  return _transport;
}

// Initialize eagerly
export const transportReady: Promise<Transport> = getTransport();
