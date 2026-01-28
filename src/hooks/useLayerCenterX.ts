import { useRef, useSyncExternalStore, type RefObject } from 'react';

interface UseLayerCenterXResult {
  ref: RefObject<HTMLDivElement | null>;
  centerX: number;
}

interface ResizeStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
}

function createResizeStore(getElement: () => HTMLElement | null): ResizeStore {
  let width = 0;
  const listeners = new Set<() => void>();

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) {
      const newWidth = entry.contentRect.width;
      if (newWidth !== width) {
        width = newWidth;
        listeners.forEach((l) => l());
      }
    }
  });

  let observing = false;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (!observing) {
        const el = getElement();
        if (el) {
          // Initialize width immediately
          width = el.getBoundingClientRect().width;
          observer.observe(el);
          observing = true;
        }
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && observing) {
          observer.disconnect();
          observing = false;
        }
      };
    },
    getSnapshot() {
      // On first call, try to get initial value
      if (width === 0) {
        const el = getElement();
        if (el) {
          width = el.getBoundingClientRect().width;
        }
      }
      return width;
    },
  };
}

export function useLayerCenterX(): UseLayerCenterXResult {
  const ref = useRef<HTMLDivElement>(null);
  const storeRef = useRef<ResizeStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createResizeStore(() => ref.current);
  }

  const width = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    () => 0 // Server snapshot
  );

  return { ref, centerX: width / 2 };
}
