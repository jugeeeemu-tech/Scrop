import type {
  CapturedPacket,
  ReplayFrame,
  ReplayFrameBatch,
} from '../types';

const SAME_MOMENT_EPSILON_MS = 1e-6;
const COMPACT_HEAD_THRESHOLD = 1024;

export interface PacketReplayer {
  enqueue(batch: ReplayFrameBatch): void;
  dispose(): void;
}

export function createPacketReplayer(onPacket: (packet: CapturedPacket) => void): PacketReplayer {
  const queue: ReplayFrame[] = [];
  let head = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let lastMonoMs: number | null = null;

  function isQueueEmpty(): boolean {
    return head >= queue.length;
  }

  function compactQueueIfNeeded() {
    if (head === 0) {
      return;
    }
    if (head < COMPACT_HEAD_THRESHOLD && head * 2 < queue.length) {
      return;
    }
    queue.splice(0, head);
    head = 0;
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function flushDue(targetMonoMs: number) {
    while (!isQueueEmpty()) {
      const frame = queue[head];
      if (frame.monoMs > targetMonoMs + SAME_MOMENT_EPSILON_MS) {
        break;
      }
      head += 1;
      onPacket(frame);
      lastMonoMs = frame.monoMs;
    }
    compactQueueIfNeeded();
  }

  function scheduleNext() {
    if (disposed || timer) {
      return;
    }

    while (!isQueueEmpty()) {
      const nextMonoMs = queue[head].monoMs;
      if (lastMonoMs === null) {
        flushDue(nextMonoMs);
        continue;
      }

      const deltaMs = nextMonoMs - lastMonoMs;
      const delayMs = deltaMs > 0 ? Math.floor(deltaMs) : 0;
      if (delayMs <= 0) {
        flushDue(nextMonoMs);
        continue;
      }

      timer = setTimeout(() => {
        timer = null;
        if (disposed) {
          return;
        }
        flushDue(nextMonoMs);
        scheduleNext();
      }, delayMs);
      return;
    }
  }

  return {
    enqueue(batch: ReplayFrameBatch) {
      if (disposed || batch.length === 0) {
        return;
      }
      for (const frame of batch) {
        if (Number.isFinite(frame.monoMs)) {
          queue.push(frame);
        }
      }
      scheduleNext();
    },
    dispose() {
      disposed = true;
      queue.length = 0;
      head = 0;
      clearTimer();
    },
  };
}
