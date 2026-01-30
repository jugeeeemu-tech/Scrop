import { useSyncExternalStore } from 'react';
import type { AnimatingPacket } from '../types';
import {
  subscribe,
  selectDeliveredPacketsForPort,
  selectFwToPortPackets,
  selectStreamingPorts,
  selectDeliveredCountForPort,
  selectIsPortActive,
} from '../stores/packetStore';

const EMPTY_PACKETS: AnimatingPacket[] = [];

export function usePortLayerStore() {
  const fwToPortPackets = useSyncExternalStore(subscribe, selectFwToPortPackets);
  const streamingPorts = useSyncExternalStore(subscribe, selectStreamingPorts);

  return { fwToPortPackets, streamingPorts };
}

export function usePortDeliveredPackets(portKey: number): AnimatingPacket[] {
  return useSyncExternalStore(
    subscribe,
    () => selectDeliveredPacketsForPort(portKey) ?? EMPTY_PACKETS
  );
}

export function useMailboxPacketCount(portKey: number): number {
  return useSyncExternalStore(
    subscribe,
    () => selectDeliveredCountForPort(portKey)
  );
}

export function useMailboxIsActive(portKey: number): boolean {
  return useSyncExternalStore(
    subscribe,
    () => selectIsPortActive(portKey)
  );
}
