import { useSyncExternalStore } from 'react';
import {
  subscribe,
  selectNicDropped,
  selectNicDroppedCounter,
  selectNicDropAnimations,
  selectIncomingPackets,
  selectIsNicDropStreamMode,
  selectIsIncomingStreamMode,
  selectNicActive,
} from '../stores/packetStore';

export function useNICLayerStore() {
  const nicDropped = useSyncExternalStore(subscribe, selectNicDropped);
  const nicDroppedCounter = useSyncExternalStore(subscribe, selectNicDroppedCounter);
  const nicDropAnimations = useSyncExternalStore(subscribe, selectNicDropAnimations);
  const incomingPackets = useSyncExternalStore(subscribe, selectIncomingPackets);
  const isNicDropStreamMode = useSyncExternalStore(subscribe, selectIsNicDropStreamMode);
  const isIncomingStreamMode = useSyncExternalStore(subscribe, selectIsIncomingStreamMode);
  const nicActive = useSyncExternalStore(subscribe, selectNicActive);

  return {
    nicDropped,
    nicDroppedCounter,
    nicDropAnimations,
    incomingPackets,
    isNicDropStreamMode,
    isIncomingStreamMode,
    nicActive,
  };
}
