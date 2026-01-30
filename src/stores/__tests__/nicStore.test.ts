import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Transport } from '../../transport';

// transportモック
const mockTransport: Transport = {
  startCapture: vi.fn().mockResolvedValue(undefined),
  stopCapture: vi.fn().mockResolvedValue(undefined),
  resetCapture: vi.fn().mockResolvedValue(undefined),
  listInterfaces: vi.fn().mockResolvedValue(['eth0', 'lo', 'wlan0']),
  attachInterface: vi.fn().mockResolvedValue(undefined),
  detachInterface: vi.fn().mockResolvedValue(undefined),
  subscribePackets: vi.fn().mockReturnValue(() => {}),
};

vi.mock('../../transport', () => ({
  transportReady: Promise.resolve(mockTransport),
}));

async function importFresh() {
  vi.resetModules();

  // re-mock after resetModules
  vi.doMock('../../transport', () => ({
    transportReady: Promise.resolve(mockTransport),
  }));

  return await import('../nicStore');
}

describe('nicStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('初期状態', () => {
    it('localStorageなしでattachedNicsは空', async () => {
      const store = await importFresh();
      const state = store.getNicsSnapshot();
      expect(state.availableNics).toEqual([]);
      expect(state.attachedNics.size).toBe(0);
    });

    it('localStorageに有効データがあれば復元', async () => {
      localStorage.setItem('scrop:attached-nics', JSON.stringify(['eth0', 'lo']));
      const store = await importFresh();
      const state = store.getNicsSnapshot();
      expect(state.attachedNics.has('eth0')).toBe(true);
      expect(state.attachedNics.has('lo')).toBe(true);
    });

    it('localStorageに不正データがあれば空Setにフォールバック', async () => {
      localStorage.setItem('scrop:attached-nics', 'not valid');
      const store = await importFresh();
      const state = store.getNicsSnapshot();
      expect(state.attachedNics.size).toBe(0);
    });
  });

  describe('toggleNic', () => {
    it('未attachのNICをattachする', async () => {
      const store = await importFresh();
      await store.toggleNic('eth0');
      const state = store.getNicsSnapshot();
      expect(state.attachedNics.has('eth0')).toBe(true);
    });

    it('attach済のNICをdetachする', async () => {
      localStorage.setItem('scrop:attached-nics', JSON.stringify(['eth0']));
      const store = await importFresh();
      await store.toggleNic('eth0');
      const state = store.getNicsSnapshot();
      expect(state.attachedNics.has('eth0')).toBe(false);
    });

    it('バックエンド失敗時もUI状態は更新維持', async () => {
      vi.mocked(mockTransport.attachInterface).mockRejectedValueOnce(new Error('backend error'));
      const store = await importFresh();
      await store.toggleNic('eth0');
      // UIはattach済みになっている（楽観的更新）
      const state = store.getNicsSnapshot();
      expect(state.attachedNics.has('eth0')).toBe(true);
    });
  });

  describe('fetchAvailableNics', () => {
    it('transport.listInterfacesを呼び出してavailableNicsを更新', async () => {
      const store = await importFresh();
      await store.fetchAvailableNics();
      const state = store.getNicsSnapshot();
      expect(state.availableNics).toEqual(['eth0', 'lo', 'wlan0']);
      expect(mockTransport.listInterfaces).toHaveBeenCalled();
    });
  });

  describe('initializeNics', () => {
    it('初回起動時（保存なし）は全NICをattach', async () => {
      const store = await importFresh();
      await store.initializeNics();
      const state = store.getNicsSnapshot();
      expect(state.attachedNics.size).toBe(3);
      expect(state.attachedNics.has('eth0')).toBe(true);
      expect(state.attachedNics.has('lo')).toBe(true);
      expect(state.attachedNics.has('wlan0')).toBe(true);
    });

    it('2回目以降（保存あり）は保存済みのみattach', async () => {
      localStorage.setItem('scrop:attached-nics', JSON.stringify(['eth0']));
      const store = await importFresh();
      await store.initializeNics();
      const state = store.getNicsSnapshot();
      expect(state.attachedNics.has('eth0')).toBe(true);
      expect(state.attachedNics.has('lo')).toBe(false);
    });
  });
});
