import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Transport } from '../../transport';
import type { AnimatingPacket, CapturedPacket, PortInfo } from '../../types';
import {
  LAYER_TRANSITION_DURATION,
  STREAM_MODE_RATE_THRESHOLD,
  STREAM_MODE_RATE_WINDOW,
  MAX_STORED_DELIVERED_PACKETS,
  MAX_STORED_DROPPED_PACKETS,
} from '../../constants';

// --- transport モック ---
// subscribePackets のコールバックを捕獲できるようにする
let capturedOnPacket: ((data: CapturedPacket) => void) | null = null;

const mockTransport: Transport = {
  startCapture: vi.fn().mockResolvedValue(undefined),
  stopCapture: vi.fn().mockResolvedValue(undefined),
  resetCapture: vi.fn().mockResolvedValue(undefined),
  listInterfaces: vi.fn().mockResolvedValue([]),
  attachInterface: vi.fn().mockResolvedValue(undefined),
  detachInterface: vi.fn().mockResolvedValue(undefined),
  subscribePackets: vi.fn().mockImplementation((cb) => {
    capturedOnPacket = cb;
    return () => { capturedOnPacket = null; };
  }),
};

// portStore モック
const mockPorts: PortInfo[] = [
  { type: 'port', port: 80, label: 'HTTP' },
  { type: 'port', port: 443, label: 'HTTPS' },
  { type: 'etc', label: 'Other' },
];

vi.mock('../../transport', () => ({
  transportReady: Promise.resolve(mockTransport),
}));

vi.mock('../portStore', () => ({
  getPorts: () => mockPorts,
  subscribePorts: vi.fn().mockReturnValue(() => {}),
}));

let pktCounter = 0;
function createPacket(overrides?: Partial<AnimatingPacket>): AnimatingPacket {
  return {
    id: `pkt-${pktCounter++}`,
    protocol: 'TCP',
    size: 512,
    source: '192.168.1.1',
    srcPort: 12345,
    destination: '10.0.0.1',
    destPort: 80,
    timestamp: Date.now(),
    ...overrides,
  };
}

async function importFresh() {
  vi.resetModules();
  capturedOnPacket = null;

  vi.doMock('../../transport', () => ({
    transportReady: Promise.resolve(mockTransport),
  }));
  vi.doMock('../portStore', () => ({
    getPorts: () => mockPorts,
    subscribePorts: vi.fn().mockReturnValue(() => {}),
  }));

  return await import('../packetStore');
}

/** subscribe() → startCapture() → subscribeToPackets() の Promise を消化 */
async function initAndSubscribe(store: Awaited<ReturnType<typeof importFresh>>) {
  store.subscribe(() => {});
  // transportReady の Promise + startCapture 内の await を flush
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(0);
}

/** コールバック経由でパケットを注入 */
function injectPacket(packet: AnimatingPacket, result: CapturedPacket['result']) {
  if (!capturedOnPacket) throw new Error('subscribePackets callback not captured');
  capturedOnPacket({ packet, result });
}

describe('packetStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.clearAllMocks();
    pktCounter = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================
  // アニメーション完了ハンドラ
  // ==========================================
  describe('アニメーション完了ハンドラ', () => {
    it('handleIncomingComplete: incomingPacketsから除去', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-ic-1' }), 'delivered');
      // 通常モードなので incomingPackets に追加される
      expect(store.getSnapshot().incomingPackets.some((p) => p.id === 'pkt-ic-1')).toBe(true);

      store.handleIncomingComplete('pkt-ic-1');
      expect(store.getSnapshot().incomingPackets.some((p) => p.id === 'pkt-ic-1')).toBe(false);
    });

    it('handleNicToFwComplete: nicToFwPacketsから除去', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-nf-1' }), 'delivered');
      // LAYER_TRANSITION_DURATION 後に NIC処理 → nicToFwPackets に追加
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION);
      expect(store.getSnapshot().nicToFwPackets.some((p) => p.id === 'pkt-nf-1')).toBe(true);

      store.handleNicToFwComplete('pkt-nf-1');
      expect(store.getSnapshot().nicToFwPackets.some((p) => p.id === 'pkt-nf-1')).toBe(false);
    });

    it('handleFwToPortComplete: fwToPortPacketsからdeliveredPacketsへ移動', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-fp-1' }), 'delivered');
      // incoming → NIC → FW と進める
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // → NIC (nicToFw追加)
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // → FW (fwToPort追加)
      expect(store.getSnapshot().fwToPortPackets.some((p) => p.id === 'pkt-fp-1')).toBe(true);

      store.handleFwToPortComplete('pkt-fp-1', 80);
      expect(store.getSnapshot().fwToPortPackets.some((p) => p.id === 'pkt-fp-1')).toBe(false);
      // deliveredPackets はバッファリングされ 500ms 後にフラッシュ
      vi.advanceTimersByTime(500);
      expect(store.getSnapshot().deliveredPackets[80].some((p) => p.id === 'pkt-fp-1')).toBe(true);
    });

    it('handleDropAnimationComplete: nicDropAnimationsから除去', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-nd-1' }), 'nic-drop');
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // → NIC処理
      expect(store.getSnapshot().nicDropAnimations.some((p) => p.id === 'pkt-nd-1')).toBe(true);

      store.handleDropAnimationComplete('pkt-nd-1', 'nic');
      expect(store.getSnapshot().nicDropAnimations.some((p) => p.id === 'pkt-nd-1')).toBe(false);
    });

    it('handleDropAnimationComplete: fwDropAnimationsから除去', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-fd-1' }), 'fw-drop');
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // → NIC処理(通過)
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // → FW処理(drop)
      expect(store.getSnapshot().fwDropAnimations.some((p) => p.id === 'pkt-fd-1')).toBe(true);

      store.handleDropAnimationComplete('pkt-fd-1', 'fw');
      expect(store.getSnapshot().fwDropAnimations.some((p) => p.id === 'pkt-fd-1')).toBe(false);
    });
  });

  // ==========================================
  // パケット処理パイプライン
  // ==========================================
  describe('パケット処理パイプライン', () => {
    it('Deliveredパケット: incoming → NIC → FW → port', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-d-1', destPort: 80 }), 'delivered');
      // Step 1: incomingPackets に追加
      expect(store.getSnapshot().incomingPackets).toHaveLength(1);
      expect(store.getSnapshot().deliveredCounter).toBe(0);

      // Step 2: NIC 処理 → nicToFwPackets に追加
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION);
      expect(store.getSnapshot().nicToFwPackets).toHaveLength(1);
      expect(store.getSnapshot().nicActive).toBe(true);

      // Step 3: FW 処理 → fwToPortPackets に追加
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION);
      expect(store.getSnapshot().fwToPortPackets).toHaveLength(1);
      expect(store.getSnapshot().fwActive).toBe(true);
      expect(store.getSnapshot().deliveredCounter).toBe(1);
      expect(store.getSnapshot().deliveredCounterPerPort[80]).toBe(1);
    });

    it('NIC Dropパケット: incoming → NIC drop', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-nd-1' }), 'nic-drop');
      // incoming 追加
      expect(store.getSnapshot().incomingPackets).toHaveLength(1);

      // NIC処理: drop
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION);
      expect(store.getSnapshot().droppedCounter).toBe(1);
      expect(store.getSnapshot().nicDroppedCounter).toBe(1);
      expect(store.getSnapshot().nicDropped).toHaveLength(1);
      expect(store.getSnapshot().nicDropAnimations).toHaveLength(1);
      // FW まで進まない
      expect(store.getSnapshot().nicToFwPackets).toHaveLength(0);
    });

    it('FW Dropパケット: incoming → NIC通過 → FW drop', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ id: 'pkt-fd-1' }), 'fw-drop');
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // NIC通過
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // FW drop
      expect(store.getSnapshot().droppedCounter).toBe(1);
      expect(store.getSnapshot().fwDroppedCounter).toBe(1);
      expect(store.getSnapshot().firewallDropped).toHaveLength(1);
      expect(store.getSnapshot().fwDropAnimations).toHaveLength(1);
      // port まで進まない
      expect(store.getSnapshot().fwToPortPackets).toHaveLength(0);
    });

    it('resolveTargetPort: 設定済みポートに一致すればそのポート', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ destPort: 443 }), 'delivered');
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION * 2);
      // port 443 にカウントされている
      expect(store.getSnapshot().deliveredCounterPerPort[443]).toBe(1);
    });

    it('resolveTargetPort: 未設定ポートはetc (-1) に振り分け', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      injectPacket(createPacket({ destPort: 9999 }), 'delivered');
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION * 2);
      // ETC_PORT_KEY = -1
      expect(store.getSnapshot().deliveredCounterPerPort[-1]).toBe(1);
    });
  });

  // ==========================================
  // ストリームモード
  // ==========================================
  describe('ストリームモード', () => {
    it('レート閾値超過でストリームモード突入 (アニメーションスキップ)', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      // STREAM_MODE_RATE_THRESHOLD 個以上を短時間に注入
      for (let i = 0; i < STREAM_MODE_RATE_THRESHOLD; i++) {
        injectPacket(createPacket({ destPort: 80 }), 'delivered');
      }
      const state = store.getSnapshot();
      expect(state.isIncomingStreamMode).toBe(true);
      // ストリーム中はincomingPacketsに追加されない（直接NIC処理へ）
      // 最初の数パケットは通常モードだったかもしれないが、
      // 閾値到達後のパケットはincomingをスキップ
    });

    it('ヒステリシス: exit閾値未満でストリームモード離脱', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      // ストリームモード突入
      for (let i = 0; i < STREAM_MODE_RATE_THRESHOLD; i++) {
        injectPacket(createPacket({ destPort: 80 }), 'delivered');
      }
      expect(store.getSnapshot().isIncomingStreamMode).toBe(true);

      // レートウィンドウ時間を過ぎてタイマーを消化
      vi.advanceTimersByTime(STREAM_MODE_RATE_WINDOW);
      // scheduleRateWindowUpdate が exit 判定 → レート0 < exit閾値 → 離脱
      vi.advanceTimersByTime(STREAM_MODE_RATE_WINDOW);

      expect(store.getSnapshot().isIncomingStreamMode).toBe(false);
    });

    it('NIC dropストリームモード: ドロップアニメーションスキップ', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      // 閾値+2パケットを一度に注入（同一タイムスタンプで incoming に追加される）
      const count = STREAM_MODE_RATE_THRESHOLD + 2;
      for (let i = 0; i < count; i++) {
        injectPacket(createPacket(), 'nic-drop');
      }
      // 1回のタイマー進行で全パケットの processNIC が同タイミングで実行される
      // → getRate() が閾値以上 → ストリームモード突入
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION);

      expect(store.getSnapshot().isNicDropStreamMode).toBe(true);
      expect(store.getSnapshot().nicDroppedCounter).toBe(count);
      // ストリーム突入後のドロップはアニメーションに追加されない
      expect(store.getSnapshot().nicDropAnimations.length).toBeLessThan(count);
    });

    it('FW dropストリームモード: ドロップアニメーションスキップ', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      // 大量にFW dropを一度に注入
      const count = STREAM_MODE_RATE_THRESHOLD + 2;
      for (let i = 0; i < count; i++) {
        injectPacket(createPacket(), 'fw-drop');
      }
      // incoming → NIC → FW の2段を一括進行
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // processNIC (NIC通過 → nicToFw追加)
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION); // processFW (FW drop)

      expect(store.getSnapshot().isFwDropStreamMode).toBe(true);
      expect(store.getSnapshot().fwDroppedCounter).toBe(count);
    });
  });

  // ==========================================
  // 格納上限
  // ==========================================
  describe('格納上限', () => {
    it('deliveredPackets が MAX_STORED_DELIVERED_PACKETS を超えない', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      const total = MAX_STORED_DELIVERED_PACKETS + 10;
      for (let i = 0; i < total; i++) {
        injectPacket(createPacket({ destPort: 80 }), 'delivered');
        // 全段通過させる
        vi.advanceTimersByTime(LAYER_TRANSITION_DURATION * 2);
        // fwToPort完了でdeliveredPacketsに移動
        const fwPkts = store.getSnapshot().fwToPortPackets;
        for (const p of fwPkts) {
          store.handleFwToPortComplete(p.id, p.targetPort ?? 80);
        }
      }
      // deliveredPackets はバッファリングされ 500ms 後にフラッシュ
      vi.advanceTimersByTime(500);
      expect(store.getSnapshot().deliveredPackets[80].length).toBeLessThanOrEqual(
        MAX_STORED_DELIVERED_PACKETS
      );
    });

    it('nicDropped が MAX_STORED_DROPPED_PACKETS を超えない', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      const total = MAX_STORED_DROPPED_PACKETS + 10;
      for (let i = 0; i < total; i++) {
        injectPacket(createPacket(), 'nic-drop');
        vi.advanceTimersByTime(LAYER_TRANSITION_DURATION);
      }
      expect(store.getSnapshot().nicDropped.length).toBeLessThanOrEqual(
        MAX_STORED_DROPPED_PACKETS
      );
    });

    it('firewallDropped が MAX_STORED_DROPPED_PACKETS を超えない', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      const total = MAX_STORED_DROPPED_PACKETS + 10;
      for (let i = 0; i < total; i++) {
        injectPacket(createPacket(), 'fw-drop');
        vi.advanceTimersByTime(LAYER_TRANSITION_DURATION * 2);
      }
      expect(store.getSnapshot().firewallDropped.length).toBeLessThanOrEqual(
        MAX_STORED_DROPPED_PACKETS
      );
    });
  });

  // ==========================================
  // toggleCapture / resetCapture
  // ==========================================
  describe('toggleCapture', () => {
    it('停止中 → 開始', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);
      expect(store.getSnapshot().isCapturing).toBe(true);

      await store.toggleCapture(); // stop
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getSnapshot().isCapturing).toBe(false);

      await store.toggleCapture(); // start
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getSnapshot().isCapturing).toBe(true);
    });

    it('startCapture失敗時にerrorが設定される', async () => {
      const store = await importFresh();
      vi.mocked(mockTransport.startCapture).mockRejectedValueOnce(new Error('fail'));

      await store.toggleCapture();
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getSnapshot().error).toBeTruthy();
    });

    it('stopCapture失敗時にerrorが設定される', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      vi.mocked(mockTransport.stopCapture).mockRejectedValueOnce(new Error('fail'));
      await store.toggleCapture(); // try to stop
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getSnapshot().error).toBeTruthy();
    });
  });

  describe('resetCapture', () => {
    it('リセット後に再開される', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);
      expect(store.getSnapshot().isCapturing).toBe(true);

      await store.resetCapture();
      await vi.advanceTimersByTimeAsync(0);
      // リセット後に再開
      expect(store.getSnapshot().isCapturing).toBe(true);
      expect(store.getSnapshot().deliveredCounter).toBe(0);
    });

    it('resetCapture失敗時にerrorが設定される', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      vi.mocked(mockTransport.resetCapture).mockRejectedValueOnce(new Error('reset fail'));
      await store.resetCapture();
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getSnapshot().error).toBeTruthy();
    });
  });

  // ==========================================
  // clearAll / syncPortConfig
  // ==========================================
  describe('clearAll', () => {
    it('全状態をリセットし generation をインクリメント', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      // パケットを注入して状態を変化
      injectPacket(createPacket(), 'delivered');
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION * 2);
      expect(store.getSnapshot().deliveredCounter).toBe(1);

      store.clearAll();
      const state = store.getSnapshot();
      expect(state.deliveredCounter).toBe(0);
      expect(state.droppedCounter).toBe(0);
      expect(state.incomingPackets).toEqual([]);
      expect(state.nicToFwPackets).toEqual([]);
      expect(state.fwToPortPackets).toEqual([]);
      expect(state.nicDropAnimations).toEqual([]);
      expect(state.fwDropAnimations).toEqual([]);
      expect(state.isCapturing).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isIncomingStreamMode).toBe(false);
    });

    it('clearAll後のpending setTimeoutは無効化される (generationチェック)', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);

      // パケット注入 (pending setTimeout が作られる)
      injectPacket(createPacket(), 'delivered');
      expect(store.getSnapshot().incomingPackets).toHaveLength(1);

      // clearAll で generation インクリメント
      store.clearAll();
      expect(store.getSnapshot().deliveredCounter).toBe(0);

      // setTimeout が発火しても generation が古いので処理されない
      vi.advanceTimersByTime(LAYER_TRANSITION_DURATION * 3);
      expect(store.getSnapshot().deliveredCounter).toBe(0);
    });
  });

  describe('syncPortConfig', () => {
    it('新しいポートのエントリを確保', async () => {
      const store = await importFresh();
      const newPorts: PortInfo[] = [
        { type: 'port', port: 80, label: 'HTTP' },
        { type: 'port', port: 8080, label: 'Proxy' },
        { type: 'etc', label: 'Other' },
      ];
      store.syncPortConfig(newPorts);
      const state = store.getSnapshot();
      expect(8080 in state.deliveredPackets).toBe(true);
      expect(8080 in state.deliveredCounterPerPort).toBe(true);
    });

    it('削除されたポートのデータを削除', async () => {
      const store = await importFresh();
      expect(80 in store.getSnapshot().deliveredPackets).toBe(true);

      store.syncPortConfig([{ type: 'etc', label: 'Other' }]);
      expect(80 in store.getSnapshot().deliveredPackets).toBe(false);
    });
  });

  // ==========================================
  // subscribeToPackets
  // ==========================================
  describe('subscribeToPackets', () => {
    it('isCapturing=false で unsubscribe される', async () => {
      const store = await importFresh();
      await initAndSubscribe(store);
      expect(capturedOnPacket).not.toBeNull();

      store.subscribeToPackets(false);
      // unsubscribe が呼ばれ、コールバックがnullに
      expect(capturedOnPacket).toBeNull();
    });
  });

  // ==========================================
  // subscribe / getServerSnapshot
  // ==========================================
  describe('subscribe', () => {
    it('リスナーを登録し解除できる', async () => {
      const store = await importFresh();
      const listener = vi.fn();
      const unsub = store.subscribe(listener);
      store.clearAll();
      expect(listener).toHaveBeenCalled();
      unsub();
      listener.mockClear();
      store.clearAll();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getServerSnapshot', () => {
    it('初期状態を返す', async () => {
      const store = await importFresh();
      const snap = store.getServerSnapshot();
      expect(snap.deliveredCounter).toBe(0);
      expect(snap.isCapturing).toBe(false);
    });
  });
});
