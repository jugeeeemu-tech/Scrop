import { useSyncExternalStore } from 'react';
import { subscribeNics, getNicsSnapshot, getNicsServerSnapshot } from '../stores/nicStore';

export function useNicStore() {
  return useSyncExternalStore(subscribeNics, getNicsSnapshot, getNicsServerSnapshot);
}
