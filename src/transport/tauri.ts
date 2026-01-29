import type { Transport } from './index';
import type { CapturedPacket } from '../types';

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

      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<CapturedPacket>('packet:captured', (event) => {
          onPacket(event.payload);
        }).then((fn) => {
          unlisten = fn;
        });
      });

      return () => {
        if (unlisten) unlisten();
      };
    },
  };
}
