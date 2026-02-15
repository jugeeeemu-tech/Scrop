import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayFrameBatch } from '../types';
import { createWebTransport } from './web';
import { decodePacketBatch } from './proto/decodePacketBatch';
import { createPacketReplayer } from './replay';

vi.mock('./proto/decodePacketBatch', () => ({
  decodePacketBatch: vi.fn(),
}));

const enqueueMock = vi.fn();
const disposeMock = vi.fn();

vi.mock('./replay', () => ({
  createPacketReplayer: vi.fn(() => ({
    enqueue: enqueueMock,
    dispose: disposeMock,
  })),
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  binaryType: BinaryType = 'blob';
  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent<unknown>) => unknown) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  close(): void {
    this.onclose?.call(this as unknown as WebSocket, {} as CloseEvent);
  }
}

describe('createWebTransport subscribePackets', () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    enqueueMock.mockReset();
    disposeMock.mockReset();
    vi.mocked(decodePacketBatch).mockReset();
    vi.mocked(createPacketReplayer).mockClear();
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('sets binaryType to arraybuffer and decodes binary payload', () => {
    const batch: ReplayFrameBatch = [
      {
        packet: {
          id: 'pkt-1',
          protocol: 'TCP',
          size: 120,
          source: '192.168.0.1',
          srcPort: 12345,
          destination: '10.0.0.1',
          destPort: 80,
          timestamp: 1_700_000_000_000,
        },
        result: 'delivered',
        monoMs: 10_000,
      },
    ];
    vi.mocked(decodePacketBatch).mockReturnValue(batch);

    const transport = createWebTransport();
    const unsubscribe = transport.subscribePackets(() => {});

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();
    expect(socket.binaryType).toBe('arraybuffer');

    const payload = new Uint8Array([1, 2, 3]).buffer;
    socket.onmessage?.call(socket as unknown as WebSocket, { data: payload } as MessageEvent);

    expect(decodePacketBatch).toHaveBeenCalledWith(payload);
    expect(enqueueMock).toHaveBeenCalledWith(batch);

    unsubscribe();
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it('ignores non-binary websocket payload', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const transport = createWebTransport();

    transport.subscribePackets(() => {});
    const socket = MockWebSocket.instances[0];
    socket.onmessage?.call(socket as unknown as WebSocket, { data: 'text' } as MessageEvent);

    expect(decodePacketBatch).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Unexpected WebSocket payload type:', 'text');
  });
});
