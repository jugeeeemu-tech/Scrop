import type { CapturedPacket, CapturedPacketBatch } from '../types';

type ClockSource = 'mono' | 'timestamp';

interface ClockPoint {
  source: ClockSource;
  ms: number;
}

function resolveClockPoint(packet: CapturedPacket): ClockPoint {
  const captureMonoNs = packet.packet.captureMonoNs;
  if (typeof captureMonoNs === 'number' && Number.isFinite(captureMonoNs)) {
    return { source: 'mono', ms: captureMonoNs / 1_000_000 };
  }
  return { source: 'timestamp', ms: packet.packet.timestamp };
}

export interface PacketReplayer {
  enqueue(batch: CapturedPacketBatch): void;
  dispose(): void;
}

export function createPacketReplayer(onPacket: (packet: CapturedPacket) => void): PacketReplayer {
  const queue: CapturedPacket[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let lastClockPoint: ClockPoint | null = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function drain() {
    if (disposed || timer) {
      return;
    }

    while (queue.length > 0) {
      const packet = queue[0];
      const clockPoint = resolveClockPoint(packet);

      let delayMs = 0;
      if (lastClockPoint && lastClockPoint.source === clockPoint.source) {
        const deltaMs = clockPoint.ms - lastClockPoint.ms;
        if (deltaMs > 0) {
          delayMs = Math.floor(deltaMs);
        }
      }

      if (delayMs > 0) {
        timer = setTimeout(() => {
          timer = null;
          if (disposed || queue.length === 0) {
            return;
          }

          const nextPacket = queue.shift()!;
          const nextClockPoint = resolveClockPoint(nextPacket);
          onPacket(nextPacket);
          lastClockPoint = nextClockPoint;
          drain();
        }, delayMs);
        return;
      }

      queue.shift();
      onPacket(packet);
      lastClockPoint = clockPoint;
    }
  }

  return {
    enqueue(batch: CapturedPacketBatch) {
      if (disposed || batch.length === 0) {
        return;
      }
      queue.push(...batch);
      drain();
    },
    dispose() {
      disposed = true;
      queue.length = 0;
      clearTimer();
    },
  };
}
