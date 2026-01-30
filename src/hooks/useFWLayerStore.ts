import { useSyncExternalStore } from 'react';
import {
  subscribe,
  selectFirewallDropped,
  selectFwDroppedCounter,
  selectFwActive,
  selectFwDropAnimations,
  selectNicToFwPackets,
  selectIsFwDropStreamMode,
  selectIsNicToFwStreamMode,
} from '../stores/packetStore';

export function useFWLayerStore() {
  const firewallDropped = useSyncExternalStore(subscribe, selectFirewallDropped);
  const fwDroppedCounter = useSyncExternalStore(subscribe, selectFwDroppedCounter);
  const fwActive = useSyncExternalStore(subscribe, selectFwActive);
  const fwDropAnimations = useSyncExternalStore(subscribe, selectFwDropAnimations);
  const nicToFwPackets = useSyncExternalStore(subscribe, selectNicToFwPackets);
  const isFwDropStreamMode = useSyncExternalStore(subscribe, selectIsFwDropStreamMode);
  const isNicToFwStreamMode = useSyncExternalStore(subscribe, selectIsNicToFwStreamMode);

  return {
    firewallDropped,
    fwDroppedCounter,
    fwActive,
    fwDropAnimations,
    nicToFwPackets,
    isFwDropStreamMode,
    isNicToFwStreamMode,
  };
}
