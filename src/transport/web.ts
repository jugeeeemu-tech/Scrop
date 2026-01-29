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
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json();
      throw new Error(body.error || `HTTP ${res.status}`);
    }
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
      let reconnectDelay = 1000;

      function connect() {
        ws = new WebSocket(getWsUrl());

        ws.onopen = () => {
          reconnectDelay = 1000;
        };

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
            reconnectTimer = setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 10000);
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
