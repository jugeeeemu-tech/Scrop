import type { Transport } from './index';
import type {
  AnimatingPacket,
  CapturedPacket,
  CapturedPacketEnvelope,
  ReplayFrameBatch,
} from '../types';
import { createPacketReplayer } from './replay';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeEnvelope(envelope: CapturedPacketEnvelope): ReplayFrameBatch {
  if (!isFiniteNumber(envelope.epochOffsetMs) || !Array.isArray(envelope.packets)) {
    return [];
  }

  const batch: ReplayFrameBatch = [];
  for (const captured of envelope.packets) {
    const packet = captured?.packet;
    if (!packet || !isFiniteNumber(packet.captureMonoNs)) {
      continue;
    }
    const { captureMonoNs, ...wirePacket } = packet;
    const monoMs = captureMonoNs / 1_000_000;
    const packetForUi: AnimatingPacket = {
      ...wirePacket,
      timestamp: monoMs + envelope.epochOffsetMs,
    };
    batch.push({
      packet: packetForUi,
      result: captured.result,
      monoMs,
    });
  }
  return batch;
}

export function createTauriTransport(): Transport {
  return {
    async startCapture() {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('start_capture');
    },

    async stopCapture() {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_capture');
    },

    async resetCapture() {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reset_capture');
    },

    async listInterfaces() {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string[]>('list_interfaces');
    },

    async attachInterface(name: string) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('attach_interface', { interface: name });
    },

    async detachInterface(name: string) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('detach_interface', { interface: name });
    },

    subscribePackets(onPacket: (data: CapturedPacket) => void): () => void {
      let unlisten: (() => void) | null = null;
      let disposed = false;
      const replayer = createPacketReplayer(onPacket);

      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<CapturedPacketEnvelope>('packet:captured-batch', (event) => {
          const batch = normalizeEnvelope(event.payload);
          replayer.enqueue(batch);
        }).then((fn) => {
          if (disposed) {
            fn();
          } else {
            unlisten = fn;
          }
        });
      });

      return () => {
        disposed = true;
        if (unlisten) unlisten();
        replayer.dispose();
      };
    },
  };
}
