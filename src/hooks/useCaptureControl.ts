import { useSyncExternalStore } from 'react';
import {
  subscribe,
  selectIsCapturing,
  toggleCapture as storeToggleCapture,
  resetCapture as storeResetCapture,
} from '../stores/packetStore';

export interface UseCaptureControlResult {
  isCapturing: boolean;
  toggleCapture: () => void;
  resetCapture: () => void;
}

export function useCaptureControl(): UseCaptureControlResult {
  const isCapturing = useSyncExternalStore(subscribe, selectIsCapturing);

  const toggleCapture = () => storeToggleCapture();
  const resetCapture = () => storeResetCapture();

  return {
    isCapturing,
    toggleCapture,
    resetCapture,
  };
}
