import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedPacket } from '../types';
import { createPacketReplayer } from './replay';

function makeCapturedPacket(
  id: string,
  timestamp: number,
  captureMonoNs?: number,
): CapturedPacket {
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
      captureMonoNs,
    },
    result: 'delivered',
  };
}

describe('createPacketReplayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('replays using captureMonoNs when available', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([
      makeCapturedPacket('p1', 1_000, 1_000_000_000),
      makeCapturedPacket('p2', 2_000, 1_005_000_000),
    ]);

    expect(onPacket).toHaveBeenCalledTimes(1);
    expect(onPacket).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ packet: expect.objectContaining({ id: 'p1' }) }),
    );

    vi.advanceTimersByTime(4);
    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(onPacket).toHaveBeenCalledTimes(2);
    expect(onPacket).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ packet: expect.objectContaining({ id: 'p2' }) }),
    );

    replayer.dispose();
  });

  it('falls back to timestamp when captureMonoNs is missing', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([
      makeCapturedPacket('p1', 10_000),
      makeCapturedPacket('p2', 10_008),
    ]);

    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(7);
    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(onPacket).toHaveBeenCalledTimes(2);

    replayer.dispose();
  });

  it('resets delay when clock source changes', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([
      makeCapturedPacket('p1', 1_000),
      makeCapturedPacket('p2', 1_010),
      makeCapturedPacket('p3', 5_000, 50_000),
    ]);

    expect(onPacket).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10);
    expect(onPacket).toHaveBeenCalledTimes(3);
    expect(onPacket).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ packet: expect.objectContaining({ id: 'p3' }) }),
    );

    replayer.dispose();
  });

  it('stops queued replay after dispose', () => {
    const onPacket = vi.fn();
    const replayer = createPacketReplayer(onPacket);

    replayer.enqueue([
      makeCapturedPacket('p1', 1_000),
      makeCapturedPacket('p2', 1_100),
    ]);

    expect(onPacket).toHaveBeenCalledTimes(1);
    replayer.dispose();

    vi.advanceTimersByTime(200);
    expect(onPacket).toHaveBeenCalledTimes(1);
  });
});
