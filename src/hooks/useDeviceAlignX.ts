import { useRef, useSyncExternalStore, type RefObject } from 'react';

interface DeviceAlignStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
}

function createDeviceAlignStore(
  getDevice: () => HTMLElement | null,
  getZone: () => HTMLElement | null
): DeviceAlignStore {
  let centerX = 0;
  const listeners = new Set<() => void>();

  function update() {
    const device = getDevice();
    const zone = getZone();
    if (!device || !zone) return;

    const deviceRect = device.getBoundingClientRect();
    const zoneRect = zone.getBoundingClientRect();
    const newCenterX = deviceRect.left + deviceRect.width / 2 - zoneRect.left;

    if (newCenterX !== centerX) {
      centerX = newCenterX;
      listeners.forEach((l) => l());
    }
  }

  const resizeObserver = new ResizeObserver(() => update());
  let observing = false;
  let windowListenerAdded = false;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (!observing) {
        const device = getDevice();
        const zone = getZone();
        if (device && zone) {
          update();
          resizeObserver.observe(device);
          resizeObserver.observe(zone);
          observing = true;
        }
      }

      if (!windowListenerAdded) {
        window.addEventListener('resize', update);
        windowListenerAdded = true;
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          if (observing) {
            resizeObserver.disconnect();
            observing = false;
          }
          if (windowListenerAdded) {
            window.removeEventListener('resize', update);
            windowListenerAdded = false;
          }
        }
      };
    },
    getSnapshot() {
      if (centerX === 0) {
        const device = getDevice();
        const zone = getZone();
        if (device && zone) {
          const deviceRect = device.getBoundingClientRect();
          const zoneRect = zone.getBoundingClientRect();
          centerX = deviceRect.left + deviceRect.width / 2 - zoneRect.left;
        }
      }
      return centerX;
    },
  };
}

export function useDeviceAlignX(
  deviceRef: RefObject<HTMLElement | null>,
  animationZoneRef: RefObject<HTMLElement | null>
): number {
  const storeRef = useRef<DeviceAlignStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createDeviceAlignStore(
      () => deviceRef.current,
      () => animationZoneRef.current
    );
  }

  return useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    () => 0
  );
}
