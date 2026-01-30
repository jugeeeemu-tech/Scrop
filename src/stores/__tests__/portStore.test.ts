import { describe, it, expect, beforeEach, vi } from 'vitest';

// portStore はモジュールレベル状態を持つため、テスト間で動的importでクリーンな状態を確保
async function importFresh() {
  vi.resetModules();
  return await import('../portStore');
}

describe('portStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe('初期状態', () => {
    it('localStorage無しでDEFAULT_PORTSを返す', async () => {
      const store = await importFresh();
      const state = store.getPortsSnapshot();
      expect(state.ports.length).toBeGreaterThanOrEqual(2);
      expect(state.ports[state.ports.length - 1].type).toBe('etc');
      expect(state.editingIndex).toBeNull();
      expect(state.editingField).toBeNull();
    });

    it('localStorageに有効なデータがあればそれを復元', async () => {
      const saved = [
        { type: 'port', port: 443, label: 'HTTPS' },
        { type: 'port', port: 22, label: 'SSH' },
        { type: 'etc', label: 'Other' },
      ];
      localStorage.setItem('scrop:ports', JSON.stringify(saved));
      const store = await importFresh();
      const state = store.getPortsSnapshot();
      expect(state.ports).toHaveLength(3);
      expect(state.ports[0]).toEqual({ type: 'port', port: 443, label: 'HTTPS' });
    });

    it('localStorageに不正データがあればDEFAULT_PORTSにフォールバック', async () => {
      localStorage.setItem('scrop:ports', 'invalid json');
      const store = await importFresh();
      const state = store.getPortsSnapshot();
      expect(state.ports.length).toBeGreaterThanOrEqual(2);
      expect(state.ports[state.ports.length - 1].type).toBe('etc');
    });

    it('localStorageの末尾がetcでなければDEFAULT_PORTSにフォールバック', async () => {
      const saved = [{ type: 'port', port: 80, label: 'HTTP' }];
      localStorage.setItem('scrop:ports', JSON.stringify(saved));
      const store = await importFresh();
      const state = store.getPortsSnapshot();
      expect(state.ports[state.ports.length - 1].type).toBe('etc');
    });
  });

  describe('addPort', () => {
    it('etc直前にポートを追加する', async () => {
      const store = await importFresh();
      const beforeLen = store.getPortsSnapshot().ports.length;
      store.addPort();
      const state = store.getPortsSnapshot();
      expect(state.ports.length).toBe(beforeLen + 1);
      // 末尾は常にetc
      expect(state.ports[state.ports.length - 1].type).toBe('etc');
      // 追加されたポートはetcの前
      expect(state.ports[state.ports.length - 2].type).toBe('port');
    });

    it('サービス名が自動設定される（既知ポートの場合）', async () => {
      // addPortはランダムポートなので、既知サービスかどうかは不定
      // 少なくとも追加されることを確認
      const store = await importFresh();
      store.addPort();
      const state = store.getPortsSnapshot();
      const added = state.ports[state.ports.length - 2];
      expect(added.type).toBe('port');
      if (added.type === 'port') {
        expect(typeof added.port).toBe('number');
        expect(typeof added.label).toBe('string');
      }
    });
  });

  describe('updatePort', () => {
    it('ポートを更新できる', async () => {
      const store = await importFresh();
      // index 0 は port:80, label:HTTP
      const result = store.updatePort(0, { port: 443, label: 'HTTPS' });
      expect(result).toBe(true);
      const state = store.getPortsSnapshot();
      const port = state.ports[0];
      expect(port.type).toBe('port');
      if (port.type === 'port') {
        expect(port.port).toBe(443);
        expect(port.label).toBe('HTTPS');
      }
    });

    it('重複ポート番号はfalseを返す', async () => {
      const saved = [
        { type: 'port', port: 80, label: 'HTTP' },
        { type: 'port', port: 443, label: 'HTTPS' },
        { type: 'etc', label: 'Other' },
      ];
      localStorage.setItem('scrop:ports', JSON.stringify(saved));
      const store = await importFresh();
      const result = store.updatePort(1, { port: 80 });
      expect(result).toBe(false);
    });

    it('ポート番号変更時にラベルが空or旧サービス名なら新サービス名を自動設定', async () => {
      const store = await importFresh();
      // port:80, label:HTTP → port:22 にすると label が SSH になる
      store.updatePort(0, { port: 22 });
      const state = store.getPortsSnapshot();
      if (state.ports[0].type === 'port') {
        expect(state.ports[0].label).toBe('SSH');
      }
    });

    it('etc型のインデックスを指定するとfalseを返す', async () => {
      const store = await importFresh();
      const lastIdx = store.getPortsSnapshot().ports.length - 1;
      const result = store.updatePort(lastIdx, { label: 'modified' });
      expect(result).toBe(false);
    });
  });

  describe('removePort', () => {
    it('ポートを削除できる', async () => {
      const store = await importFresh();
      const beforeLen = store.getPortsSnapshot().ports.length;
      store.removePort(0);
      expect(store.getPortsSnapshot().ports.length).toBe(beforeLen - 1);
    });

    it('etc型は削除できない', async () => {
      const store = await importFresh();
      const lastIdx = store.getPortsSnapshot().ports.length - 1;
      const beforeLen = store.getPortsSnapshot().ports.length;
      store.removePort(lastIdx);
      expect(store.getPortsSnapshot().ports.length).toBe(beforeLen);
    });

    it('編集中のポートを削除するとeditingがクリアされる', async () => {
      const store = await importFresh();
      store.setEditing(0, 'port');
      expect(store.getPortsSnapshot().editingIndex).toBe(0);
      store.removePort(0);
      expect(store.getPortsSnapshot().editingIndex).toBeNull();
    });

    it('編集中ポートより前のポートを削除するとeditingIndexが調整される', async () => {
      const saved = [
        { type: 'port', port: 80, label: 'HTTP' },
        { type: 'port', port: 443, label: 'HTTPS' },
        { type: 'port', port: 22, label: 'SSH' },
        { type: 'etc', label: 'Other' },
      ];
      localStorage.setItem('scrop:ports', JSON.stringify(saved));
      const store = await importFresh();
      store.setEditing(2, 'port'); // SSH
      expect(store.getPortsSnapshot().editingIndex).toBe(2);
      store.removePort(0); // HTTP を削除
      expect(store.getPortsSnapshot().editingIndex).toBe(1); // SSH は index 1 に
    });
  });

  describe('setEditing / clearEditing', () => {
    it('編集状態を設定・クリアできる', async () => {
      const store = await importFresh();
      store.setEditing(0, 'port');
      expect(store.getPortsSnapshot().editingIndex).toBe(0);
      expect(store.getPortsSnapshot().editingField).toBe('port');

      store.setEditing(0, 'label');
      expect(store.getPortsSnapshot().editingField).toBe('label');

      store.clearEditing();
      expect(store.getPortsSnapshot().editingIndex).toBeNull();
      expect(store.getPortsSnapshot().editingField).toBeNull();
    });

    it('etc型には編集状態を設定できない', async () => {
      const store = await importFresh();
      const lastIdx = store.getPortsSnapshot().ports.length - 1;
      store.setEditing(lastIdx, 'port');
      expect(store.getPortsSnapshot().editingIndex).toBeNull();
    });
  });

  describe('reorderPorts', () => {
    it('並び替えてもetcは末尾を維持', async () => {
      const saved = [
        { type: 'port', port: 80, label: 'HTTP' },
        { type: 'port', port: 443, label: 'HTTPS' },
        { type: 'etc', label: 'Other' },
      ];
      localStorage.setItem('scrop:ports', JSON.stringify(saved));
      const store = await importFresh();
      // 順序を逆にしてetcも混ぜる
      store.reorderPorts([
        { type: 'etc', label: 'Other' },
        { type: 'port', port: 443, label: 'HTTPS' },
        { type: 'port', port: 80, label: 'HTTP' },
      ]);
      const state = store.getPortsSnapshot();
      expect(state.ports[state.ports.length - 1].type).toBe('etc');
      expect(state.ports[0].type).toBe('port');
      if (state.ports[0].type === 'port') {
        expect(state.ports[0].port).toBe(443);
      }
    });
  });

  describe('commitEditing', () => {
    it('port=0のポートは自動削除される', async () => {
      const saved = [
        { type: 'port', port: 0, label: '' },
        { type: 'port', port: 80, label: 'HTTP' },
        { type: 'etc', label: 'Other' },
      ];
      localStorage.setItem('scrop:ports', JSON.stringify(saved));
      const store = await importFresh();
      store.setEditing(0, 'port');
      store.commitEditing();
      const state = store.getPortsSnapshot();
      // port=0 のエントリは削除されている
      expect(state.ports.every((p) => p.type === 'etc' || p.port !== 0)).toBe(true);
    });

    it('port!=0なら編集がクリアされるだけ', async () => {
      const store = await importFresh();
      store.setEditing(0, 'port');
      store.commitEditing();
      expect(store.getPortsSnapshot().editingIndex).toBeNull();
    });
  });

  describe('subscribePorts', () => {
    it('リスナーが変更通知を受ける', async () => {
      const store = await importFresh();
      const listener = vi.fn();
      const unsubscribe = store.subscribePorts(listener);
      store.addPort();
      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('unsubscribe後は通知されない', async () => {
      const store = await importFresh();
      const listener = vi.fn();
      const unsubscribe = store.subscribePorts(listener);
      unsubscribe();
      store.addPort();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
