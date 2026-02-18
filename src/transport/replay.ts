import type {
  CapturedPacket,
  ReplayFrame,
  ReplayFrameBatch,
} from '../types';

const SAME_MOMENT_EPSILON_MS = 1e-6;
const COMPACT_HEAD_THRESHOLD = 1024;
const REPLAY_CATCHUP_ENTER_MS = 1_000;
const REPLAY_CATCHUP_EXIT_MS = 200;
const CATCHUP_CHUNK_SIZE = 256;

export interface PacketReplayer {
  enqueue(batch: ReplayFrameBatch): void;
  dispose(): void;
}

export function createPacketReplayer(onPacket: (packet: CapturedPacket) => void): PacketReplayer {
  const queue: ReplayFrame[] = [];
  let head = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let catchUpCancel: (() => void) | null = null;
  let disposed = false;
  let catchUpMode = false;
  let baseMonoMs: number | null = null;
  let baseWallMs: number | null = null;

  function nowMs(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      const now = performance.now();
      if (Number.isFinite(now)) {
        return now;
      }
    }
    return Date.now();
  }

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

  function clearCatchUpSchedule() {
    if (catchUpCancel) {
      catchUpCancel();
      catchUpCancel = null;
    }
  }

  function scheduleOnNextFrame(run: () => void): () => void {
    if (
      typeof requestAnimationFrame === 'function' &&
      typeof cancelAnimationFrame === 'function'
    ) {
      const id = requestAnimationFrame(() => run());
      return () => cancelAnimationFrame(id);
    }
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
  }

  function flushDue(targetMonoMs: number) {
    while (!isQueueEmpty()) {
      const frame = queue[head];
      if (frame.monoMs > targetMonoMs + SAME_MOMENT_EPSILON_MS) {
        break;
      }
      emitCurrentFrame();
    }
    compactQueueIfNeeded();
  }

  function emitCurrentFrame() {
    const frame = queue[head];
    head += 1;
    onPacket(frame);
  }

  function ensureBaseClock(nextMonoMs: number) {
    if (baseMonoMs === null || baseWallMs === null) {
      baseMonoMs = nextMonoMs;
      baseWallMs = nowMs();
      return;
    }

    // Defensive: if monotonic source restarts and jumps backwards, re-anchor.
    if (nextMonoMs + SAME_MOMENT_EPSILON_MS < baseMonoMs) {
      baseMonoMs = nextMonoMs;
      baseWallMs = nowMs();
    }
  }

  function calculateTiming(nextMonoMs: number): {
    expectedWallMs: number;
    delayMsRaw: number;
    lagMs: number;
  } {
    ensureBaseClock(nextMonoMs);
    const expectedWallMs = baseWallMs! + (nextMonoMs - baseMonoMs!);
    const delayMsRaw = expectedWallMs - nowMs();
    const lagMs = -delayMsRaw;
    return { expectedWallMs, delayMsRaw, lagMs };
  }

  function scheduleCatchUp() {
    if (disposed || catchUpCancel) {
      return;
    }

    catchUpCancel = scheduleOnNextFrame(() => {
      catchUpCancel = null;
      if (disposed) {
        return;
      }
      flushCatchUpChunk();
    });
  }

  function flushCatchUpChunk() {
    let processed = 0;

    while (!isQueueEmpty() && processed < CATCHUP_CHUNK_SIZE) {
      const nextMonoMs = queue[head].monoMs;
      const { lagMs } = calculateTiming(nextMonoMs);
      if (lagMs <= REPLAY_CATCHUP_EXIT_MS) {
        catchUpMode = false;
        break;
      }
      emitCurrentFrame();
      processed += 1;
    }

    compactQueueIfNeeded();

    if (isQueueEmpty()) {
      catchUpMode = false;
      return;
    }

    if (catchUpMode) {
      scheduleCatchUp();
      return;
    }

    scheduleNext();
  }

  function scheduleNext() {
    if (disposed || timer || catchUpCancel) {
      return;
    }

    if (catchUpMode) {
      scheduleCatchUp();
      return;
    }

    while (!isQueueEmpty()) {
      const nextMonoMs = queue[head].monoMs;
      const { delayMsRaw, lagMs } = calculateTiming(nextMonoMs);

      if (lagMs >= REPLAY_CATCHUP_ENTER_MS) {
        catchUpMode = true;
        scheduleCatchUp();
        return;
      }

      const delayMs = delayMsRaw > 0 ? Math.floor(delayMsRaw) : 0;
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
      catchUpMode = false;
      baseMonoMs = null;
      baseWallMs = null;
      clearTimer();
      clearCatchUpSchedule();
    },
  };
}
