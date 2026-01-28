import { useSyncExternalStore } from 'react';
import { subscribePorts, getPortsSnapshot, getPortsServerSnapshot } from '../stores/portStore';

export function usePortStore() {
  return useSyncExternalStore(subscribePorts, getPortsSnapshot, getPortsServerSnapshot);
}
