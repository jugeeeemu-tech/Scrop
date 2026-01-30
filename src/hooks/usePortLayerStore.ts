import { useSyncExternalStore } from 'react';
import {
  subscribe,
  selectDeliveredPackets,
  selectDeliveredCounterPerPort,
  selectFwToPortPackets,
  selectStreamingPorts,
} from '../stores/packetStore';

export function usePortLayerStore() {
  const deliveredPackets = useSyncExternalStore(subscribe, selectDeliveredPackets);
  const deliveredCounterPerPort = useSyncExternalStore(subscribe, selectDeliveredCounterPerPort);
  const fwToPortPackets = useSyncExternalStore(subscribe, selectFwToPortPackets);
  const streamingPorts = useSyncExternalStore(subscribe, selectStreamingPorts);

  return { deliveredPackets, deliveredCounterPerPort, fwToPortPackets, streamingPorts };
}
