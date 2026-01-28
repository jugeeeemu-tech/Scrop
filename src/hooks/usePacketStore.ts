import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, getServerSnapshot } from '../stores/packetStore';

export function usePacketStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
