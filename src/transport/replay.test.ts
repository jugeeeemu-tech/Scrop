import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayFrame } from '../types';
import { createPacketReplayer } from './replay';

let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame | undefined;

function makeReplayFrame(
  id: string,
  timestamp: number,
  monoMs: number,
): ReplayFrame {
  return {
    packet: {
      id,
      protocol: 'TCP',
      size: 128,
      source: '192.168.0.1',
      srcPort: 12345,
      destination: '10.0.0.1',
      destPort: 80,
      timestamp,
    },
    result: 'delivered',
    monoMs,
  };
}

describe('createPacketReplayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      const handle = setTimeout(() => cb(Date.now()), 16);
      return handle as unknown as number;
    };
    globalThis.cancelAnimationFrame = (id: number): void => {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as { requestAnimationFrame?: typeof globalThis.requestAnimationFrame })
        .requestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete (globalThis as { cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame })
        .cancelAnimationFrame;
    }
  });

  it('replays using monoMs and emits packets', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([
      makeReplayFrame('p1', 1_000, 1_000),
      makeReplayFrame('p2', 2_000, 1_005),
    ]);

    expect(onPacket).toHaveBeenCalledTimes(1);
    expect(onPacket).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ packet: expect.objectContaining({ id: 'p1', timestamp: 1_000 }) }),
    );

    vi.advanceTimersByTime(4);
    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(onPacket).toHaveBeenCalledTimes(2);
    expect(onPacket).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ packet: expect.objectContaining({ id: 'p2', timestamp: 2_000 }) }),
    );

    replayer.dispose();
  });

  it('drops frames with invalid monoMs', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    const invalid = makeReplayFrame('invalid', 10_000, Number.NaN) as unknown as ReplayFrame;
    const valid = makeReplayFrame('valid', 10_005, 50);

    replayer.enqueue([invalid, valid]);

    expect(onPacket).toHaveBeenCalledTimes(1);
    expect(onPacket).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ packet: expect.objectContaining({ id: 'valid' }) }),
    );

    replayer.dispose();
  });

  it('stops queued replay after dispose', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([
      makeReplayFrame('p1', 1_000, 1),
      makeReplayFrame('p2', 1_100, 1_101),
    ]);

    expect(onPacket).toHaveBeenCalledTimes(1);
    replayer.dispose();

    vi.advanceTimersByTime(200);
    expect(onPacket).toHaveBeenCalledTimes(1);
  });

  it('flushes frames that share the same monoMs in one tick', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([
      makeReplayFrame('p1', 1_000, 100),
      makeReplayFrame('p2', 1_001, 105),
      makeReplayFrame('p3', 1_002, 105),
      makeReplayFrame('p4', 1_003, 106),
    ]);

    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5);
    expect(onPacket).toHaveBeenCalledTimes(3);
    expect(onPacket.mock.calls[1][0].packet.id).toBe('p2');
    expect(onPacket.mock.calls[2][0].packet.id).toBe('p3');

    vi.advanceTimersByTime(1);
    expect(onPacket).toHaveBeenCalledTimes(4);
    expect(onPacket.mock.calls[3][0].packet.id).toBe('p4');

    replayer.dispose();
  });

  it('does not wait for already-elapsed idle gaps across enqueue calls', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([makeReplayFrame('p1', 1_000, 10_000)]);
    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);

    replayer.enqueue([makeReplayFrame('p2', 2_000, 15_000)]);
    expect(onPacket).toHaveBeenCalledTimes(2);
    expect(onPacket.mock.calls[1][0].packet.id).toBe('p2');

    replayer.dispose();
  });

  it('enters catch-up mode and flushes backlog in chunks', async () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([makeReplayFrame('anchor', 1_000, 10_000)]);
    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(7_000);

    const backlog = Array.from({ length: 600 }, (_, i) =>
      makeReplayFrame(`b${i}`, 2_000 + i, 15_000 + i)
    );
    replayer.enqueue(backlog);

    expect(onPacket).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20);
    expect(onPacket).toHaveBeenCalledTimes(257);

    await vi.advanceTimersByTimeAsync(20);
    expect(onPacket).toHaveBeenCalledTimes(513);

    await vi.advanceTimersByTimeAsync(20);
    expect(onPacket).toHaveBeenCalledTimes(601);
    expect(onPacket.mock.calls[1][0].packet.id).toBe('b0');
    expect(onPacket.mock.calls[600][0].packet.id).toBe('b599');

    replayer.dispose();
  });

  it('returns to delayed scheduling after catch-up lag is resolved', async () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([makeReplayFrame('p1', 1_000, 10_000)]);
    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(7_000);
    replayer.enqueue([
      makeReplayFrame('p2', 2_000, 15_000),
      makeReplayFrame('p3', 3_000, 18_000),
    ]);

    await vi.advanceTimersByTimeAsync(20);
    expect(onPacket).toHaveBeenCalledTimes(2);
    expect(onPacket.mock.calls[1][0].packet.id).toBe('p2');

    vi.advanceTimersByTime(900);
    expect(onPacket).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(200);
    expect(onPacket).toHaveBeenCalledTimes(3);
    expect(onPacket.mock.calls[2][0].packet.id).toBe('p3');

    replayer.dispose();
  });
});
