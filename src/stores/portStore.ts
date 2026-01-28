import type { PortInfo } from '../types';
import { DEFAULT_PORTS } from '../constants';
import { SERVICE_NAMES } from '../utils/constants';

export interface PortStoreState {
  ports: PortInfo[];
  editingIndex: number | null;
  editingField: 'port' | 'label' | null;
}

type Listener = () => void;

const STORAGE_KEY = 'scrop:ports';


function loadPorts(): PortInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_PORTS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_PORTS];
    // Validate structure
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) return [...DEFAULT_PORTS];
      if (item.type === 'port') {
        if (typeof item.port !== 'number' || typeof item.label !== 'string') return [...DEFAULT_PORTS];
      } else if (item.type === 'etc') {
        if (typeof item.label !== 'string') return [...DEFAULT_PORTS];
      } else {
        return [...DEFAULT_PORTS];
      }
    }
    // Ensure last entry is etc
    if (parsed[parsed.length - 1].type !== 'etc') return [...DEFAULT_PORTS];
    return parsed as PortInfo[];
  } catch {
    return [...DEFAULT_PORTS];
  }
}

function savePorts(ports: PortInfo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ports));
  } catch {
    // Ignore storage errors
  }
}

// Module-level state
let state: PortStoreState = {
  ports: loadPorts(),
  editingIndex: null,
  editingField: null,
};
const listeners = new Set<Listener>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

// useSyncExternalStore API
export function subscribePorts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPortsSnapshot(): PortStoreState {
  return state;
}

export function getPortsServerSnapshot(): PortStoreState {
  return state;
}

/** Non-reactive getter for use from packetStore */
export function getPorts(): PortInfo[] {
  return state.ports;
}

/** 未使用のランダムポート番号を生成 */
function randomUnusedPort(usedPorts: Set<number>): number | null {
  // 有効ポート数 65535 に対して全部使い切ることはまずないが一応チェック
  if (usedPorts.size >= 65535) return null;
  let port: number;
  do {
    port = Math.floor(Math.random() * 65535) + 1;
  } while (usedPorts.has(port));
  return port;
}

/** Add a new port with an auto-selected port number before the etc entry */
export function addPort(): void {
  const usedPorts = new Set(
    state.ports.filter((p) => p.type === 'port').map((p) => p.port)
  );
  const candidate = randomUnusedPort(usedPorts);
  if (candidate === null) return;

  const newPort: PortInfo = {
    type: 'port',
    port: candidate,
    label: SERVICE_NAMES[candidate] ?? '',
  };
  const etcIndex = state.ports.length - 1;
  const newPorts = [
    ...state.ports.slice(0, etcIndex),
    newPort,
    ...state.ports.slice(etcIndex),
  ];
  state = { ...state, ports: newPorts, editingIndex: null, editingField: null };
  savePorts(newPorts);
  emitChange();
}

/**
 * Update a port's properties.
 * Returns false if the port number is a duplicate.
 */
export function updatePort(index: number, update: { port?: number; label?: string }): boolean {
  const port = state.ports[index];
  if (!port || port.type !== 'port') return false;

  // Duplicate check for port number
  if (update.port !== undefined && update.port !== 0) {
    const isDuplicate = state.ports.some(
      (p, i) => i !== index && p.type === 'port' && p.port === update.port
    );
    if (isDuplicate) return false;
  }

  const newPort = update.port ?? port.port;
  let newLabel = update.label ?? port.label;

  // Auto-fill label from SERVICE_NAMES if label is empty and port is known
  if (update.port !== undefined && (newLabel === '' || newLabel === (SERVICE_NAMES[port.port] ?? ''))) {
    newLabel = SERVICE_NAMES[newPort] ?? '';
  }

  const newPorts = state.ports.map((p, i) =>
    i === index ? { ...p, port: newPort, label: newLabel } : p
  );
  state = { ...state, ports: newPorts };
  savePorts(newPorts);
  emitChange();
  return true;
}

/** Remove a port (etc cannot be removed) */
export function removePort(index: number): void {
  const port = state.ports[index];
  if (!port || port.type === 'etc') return;

  const newPorts = state.ports.filter((_, i) => i !== index);
  // Clear editing if the removed port was being edited
  const newEditing = state.editingIndex === index
    ? { editingIndex: null, editingField: null }
    : state.editingIndex !== null && state.editingIndex > index
      ? { editingIndex: state.editingIndex - 1, editingField: state.editingField }
      : { editingIndex: state.editingIndex, editingField: state.editingField };

  state = {
    ports: newPorts,
    editingIndex: newEditing.editingIndex,
    editingField: newEditing.editingField as 'port' | 'label' | null,
  };
  savePorts(newPorts);
  emitChange();
}

/** Start editing a field */
export function setEditing(index: number, field: 'port' | 'label'): void {
  const port = state.ports[index];
  if (!port || port.type === 'etc') return;
  state = { ...state, editingIndex: index, editingField: field };
  emitChange();
}

/** Clear editing state */
export function clearEditing(): void {
  state = { ...state, editingIndex: null, editingField: null };
  emitChange();
}

/** Reorder ports (etc is always kept at the end) */
export function reorderPorts(newOrder: PortInfo[]): void {
  const etc = state.ports.find((p) => p.type === 'etc');
  if (!etc) return;
  const filtered = newOrder.filter((p) => p.type !== 'etc');
  const newPorts = [...filtered, etc];
  state = { ...state, ports: newPorts, editingIndex: null, editingField: null };
  savePorts(newPorts);
  emitChange();
}

/** Commit editing. If port is still 0, remove it (cancel). */
export function commitEditing(): void {
  if (state.editingIndex === null) return;
  const port = state.ports[state.editingIndex];
  if (port && port.type === 'port' && port.port === 0) {
    // Remove uncommitted port
    removePort(state.editingIndex);
    return;
  }
  clearEditing();
}
