import type { Transport } from './index';
import type { CapturedPacket, CapturedPacketBatch } from '../types';
import { createPacketReplayer } from './replay';

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
        listen<CapturedPacketBatch>('packet:captured-batch', (event) => {
          if (!Array.isArray(event.payload)) {
            console.error('Unexpected Tauri event payload shape:', event.payload);
            return;
          }
          replayer.enqueue(event.payload);
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
