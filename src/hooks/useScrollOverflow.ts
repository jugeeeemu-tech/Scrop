import { useRef, useSyncExternalStore, type RefObject } from 'react';

interface ScrollOverflow {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

interface ScrollOverflowStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ScrollOverflow;
}

const INITIAL: ScrollOverflow = { canScrollLeft: false, canScrollRight: false };

function createScrollOverflowStore(
  getElement: () => HTMLElement | null,
): ScrollOverflowStore {
  let snapshot = INITIAL;
  const listeners = new Set<() => void>();

  function update() {
    const el = getElement();
    if (!el) return;
    const canScrollLeft = el.scrollLeft > 0;
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    if (
      canScrollLeft !== snapshot.canScrollLeft ||
      canScrollRight !== snapshot.canScrollRight
    ) {
      snapshot = { canScrollLeft, canScrollRight };
      listeners.forEach((l) => l());
    }
  }

  const resizeObserver = new ResizeObserver(() => update());
  let observing = false;

  function startObserving() {
    const el = getElement();
    if (!el || observing) return;
    resizeObserver.observe(el);
    const child = el.firstElementChild;
    if (child) resizeObserver.observe(child);
    el.addEventListener('scroll', update, { passive: true });
    observing = true;
    update();
  }

  function stopObserving() {
    const el = getElement();
    resizeObserver.disconnect();
    if (el) el.removeEventListener('scroll', update);
    observing = false;
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!observing) startObserving();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stopObserving();
      };
    },
    getSnapshot() {
      if (!observing) {
        const el = getElement();
        if (el) {
          const canScrollLeft = el.scrollLeft > 0;
          const canScrollRight =
            el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
          snapshot = { canScrollLeft, canScrollRight };
        }
      }
      return snapshot;
    },
  };
}

export function useScrollOverflow(): {
  ref: RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const storeRef = useRef<ScrollOverflowStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createScrollOverflowStore(() => ref.current);
  }

  const { canScrollLeft, canScrollRight } = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    () => INITIAL,
  );

  return { ref, canScrollLeft, canScrollRight };
}
