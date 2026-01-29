import type { Transport } from './index';
import type { CapturedPacket } from '../types';

function getBaseUrl(): string {
  return window.location.origin;
}

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

async function apiCall(path: string, method: string = 'GET'): Promise<Response> {
  const res = await fetch(`${getBaseUrl()}${path}`, { method });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res;
}

export function createWebTransport(): Transport {
  return {
    async startCapture() {
      await apiCall('/api/capture/start', 'POST');
    },

    async stopCapture() {
      await apiCall('/api/capture/stop', 'POST');
    },

    async resetCapture() {
      await apiCall('/api/capture/reset', 'POST');
    },

    async listInterfaces() {
      const res = await apiCall('/api/interfaces');
      return await res.json();
    },

    async attachInterface(name: string) {
      await apiCall(`/api/interfaces/${encodeURIComponent(name)}/attach`, 'POST');
    },

    async detachInterface(name: string) {
      await apiCall(`/api/interfaces/${encodeURIComponent(name)}/detach`, 'POST');
    },

    subscribePackets(onPacket: (data: CapturedPacket) => void): () => void {
      let ws: WebSocket | null = null;
      let shouldReconnect = true;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

      function connect() {
        ws = new WebSocket(getWsUrl());

        ws.onmessage = (event) => {
          try {
            const packet: CapturedPacket = JSON.parse(event.data);
            onPacket(packet);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          if (shouldReconnect) {
            reconnectTimer = setTimeout(connect, 1000);
          }
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          ws?.close();
        };
      }

      connect();

      return () => {
        shouldReconnect = false;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        ws?.close();
      };
    },
  };
}
