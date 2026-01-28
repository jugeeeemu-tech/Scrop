import { useSyncExternalStore, useCallback } from 'react';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  toggleCapture as storeToggleCapture,
  resetCapture as storeResetCapture,
} from '../stores/packetStore';

export interface UseCaptureControlResult {
  isCapturing: boolean;
  toggleCapture: () => void;
  resetCapture: () => void;
}

export function useCaptureControl(): UseCaptureControlResult {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleCapture = useCallback(() => {
    storeToggleCapture();
  }, []);

  const resetCapture = useCallback(() => {
    storeResetCapture();
  }, []);

  return {
    isCapturing: store.isCapturing,
    toggleCapture,
    resetCapture,
  };
}
