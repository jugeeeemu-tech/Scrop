import { transportReady } from '../transport';

export interface NicStoreState {
  availableNics: string[];
  attachedNics: Set<string>;
}

type Listener = () => void;

const STORAGE_KEY = 'scrop:attached-nics';

function loadAttachedNics(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === 'string'));
  } catch {
    return new Set();
  }
}

function saveAttachedNics(attached: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...attached]));
  } catch {
    // Ignore storage errors
  }
}

// Module-level state
let state: NicStoreState = {
  availableNics: [],
  attachedNics: loadAttachedNics(),
};
const listeners = new Set<Listener>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

// useSyncExternalStore API
export function subscribeNics(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNicsSnapshot(): NicStoreState {
  return state;
}

export function getNicsServerSnapshot(): NicStoreState {
  return state;
}

async function attachNicBackend(name: string): Promise<void> {
  const transport = await transportReady;
  await transport.attachInterface(name);
}

async function detachNicBackend(name: string): Promise<void> {
  const transport = await transportReady;
  await transport.detachInterface(name);
}

export async function toggleNic(name: string): Promise<void> {
  const wasAttached = state.attachedNics.has(name);

  // フロントエンド状態を即座に更新（source of truth）
  const newAttached = new Set(state.attachedNics);
  if (wasAttached) {
    newAttached.delete(name);
  } else {
    newAttached.add(name);
  }
  state = { ...state, attachedNics: newAttached };
  saveAttachedNics(newAttached);
  emitChange();

  // バックエンド同期（best-effort: 停止中は失敗するが問題ない）
  try {
    if (wasAttached) {
      await detachNicBackend(name);
    } else {
      await attachNicBackend(name);
    }
  } catch (e) {
    console.error(`Failed to ${wasAttached ? 'detach' : 'attach'} interface ${name}:`, e);
  }
}

export async function fetchAvailableNics(): Promise<void> {
  const transport = await transportReady;
  const interfaces = await transport.listInterfaces();
  state = { ...state, availableNics: interfaces };
  emitChange();
}

export async function initializeNics(): Promise<void> {
  await fetchAvailableNics();

  // 保存済み設定がなければ（初回起動）全NICをattach対象にする
  const hasSavedPreference = localStorage.getItem(STORAGE_KEY) !== null;
  const targetNics = hasSavedPreference
    ? loadAttachedNics()
    : new Set(state.availableNics);

  // バックエンドに全対象NICをattach
  const attached = new Set<string>();
  for (const name of targetNics) {
    if (state.availableNics.includes(name)) {
      try {
        await attachNicBackend(name);
        attached.add(name);
      } catch (e) {
        console.error(`Failed to attach interface ${name}:`, e);
      }
    }
  }

  state = { ...state, attachedNics: attached };
  saveAttachedNics(attached);
  emitChange();
}
