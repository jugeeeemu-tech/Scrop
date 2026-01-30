import { useSyncExternalStore } from 'react';
import {
  subscribe,
  selectDeliveredCounter,
  selectDroppedCounter,
  selectError,
} from '../stores/packetStore';

export function useHeaderStore() {
  const deliveredCounter = useSyncExternalStore(subscribe, selectDeliveredCounter);
  const droppedCounter = useSyncExternalStore(subscribe, selectDroppedCounter);
  const error = useSyncExternalStore(subscribe, selectError);

  return { deliveredCounter, droppedCounter, error };
}
