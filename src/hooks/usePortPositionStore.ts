import { useRef, useSyncExternalStore } from 'react';

interface PositionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number[];
  recalculate: () => void;
}

// Module-level constant to avoid creating new empty array on each getSnapshot call
const EMPTY_POSITIONS: number[] = [];

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function createPositionStore(
  getAnimationZone: () => HTMLDivElement | null,
  getMailboxRefs: () => (HTMLDivElement | null)[]
): PositionStore {
  let positions: number[] = EMPTY_POSITIONS;
  const listeners = new Set<() => void>();

  const calculatePositions = () => {
    const zone = getAnimationZone();
    const refs = getMailboxRefs();
    if (!zone) return EMPTY_POSITIONS;

    const zoneRect = zone.getBoundingClientRect();
    return refs.map((ref) => {
      if (!ref) return 0;
      const rect = ref.getBoundingClientRect();
      return rect.left + rect.width / 2 - zoneRect.left;
    });
  };

  const updatePositions = () => {
    const newPositions = calculatePositions();
    if (!arraysEqual(newPositions, positions)) {
      positions = newPositions;
      listeners.forEach((l) => l());
    }
  };

  const observer = new ResizeObserver(updatePositions);

  let observing = false;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (!observing) {
        const zone = getAnimationZone();
        if (zone) {
          positions = calculatePositions();
          observer.observe(zone);
          window.addEventListener('resize', updatePositions);
          observing = true;
        }
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && observing) {
          observer.disconnect();
          window.removeEventListener('resize', updatePositions);
          observing = false;
        }
      };
    },
    getSnapshot() {
      if (positions.length === 0) {
        positions = calculatePositions();
      }
      return positions;
    },
    recalculate: updatePositions,
  };
}

export function usePortPositionStore(
  animationZoneRef: React.RefObject<HTMLDivElement | null>,
  portCount: number
): {
  mailboxPositions: number[];
  setMailboxRef: (index: number, el: HTMLDivElement | null) => void;
  startPolling: () => void;
  stopPolling: () => void;
} {
  const mailboxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const storeRef = useRef<PositionStore | null>(null);
  const rafRef = useRef<number>(0);
  const pollingRef = useRef(false);

  // Keep ref array length in sync with ports
  mailboxRefs.current.length = portCount;

  if (!storeRef.current) {
    storeRef.current = createPositionStore(
      () => animationZoneRef.current,
      () => mailboxRefs.current
    );
  }

  const runPollingLoop = (maxFrames: number) => {
    cancelAnimationFrame(rafRef.current);
    let frame = 0;
    const poll = () => {
      storeRef.current?.recalculate();
      if (++frame < maxFrames) {
        rafRef.current = requestAnimationFrame(poll);
      }
    };
    rafRef.current = requestAnimationFrame(poll);
  };

  const setMailboxRef = (index: number, el: HTMLDivElement | null) => {
    mailboxRefs.current[index] = el;
    // Schedule recalculation after DOM layout settles
    if (!pollingRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        storeRef.current?.recalculate();
      });
    }
  };

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const poll = () => {
      storeRef.current?.recalculate();
      if (pollingRef.current) {
        rafRef.current = requestAnimationFrame(poll);
      }
    };
    rafRef.current = requestAnimationFrame(poll);
  };

  const stopPolling = () => {
    pollingRef.current = false;
    // Continue polling briefly to track the settle animation
    runPollingLoop(30);
  };

  const mailboxPositions = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    () => EMPTY_POSITIONS // Server snapshot - must return same reference
  );

  return { mailboxPositions, setMailboxRef, startPolling, stopPolling };
}
