import { test, expect } from '@playwright/test';
import { configureMock } from './helpers';

test.describe('アニメーション', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
    // キャプチャを停止してリセット
    await page.request.post('/api/capture/stop');
    await page.request.post('/api/capture/reset');
    // デフォルト設定に戻す
    await configureMock(page, { intervalMs: 500, nicDropRate: 0, fwDropRate: 0 });
  });

  test.describe('パケット配達アニメーション', () => {
    test('低レートでは個別パケットアニメーションが表示される', async ({ page }) => {
      // 低レート（1パケット/500ms = 2pps < 閾値5pps）でキャプチャ開始
      await configureMock(page, { intervalMs: 500, nicDropRate: 0, fwDropRate: 0 });
      await page.request.post('/api/capture/start');

      // animated-packet 要素がDOMに出現するのを待つ
      await expect(async () => {
        const count = await page.locator('[data-testid="animated-packet"]').count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      await page.request.post('/api/capture/stop');
    });

    test('パケットアニメーション完了後にDOMから消える', async ({ page }) => {
      await configureMock(page, { intervalMs: 500, nicDropRate: 0, fwDropRate: 0 });
      await page.request.post('/api/capture/start');

      // パケットが出現するのを待つ
      await expect(async () => {
        const count = await page.locator('[data-testid="animated-packet"]').count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      // キャプチャ停止して新パケットの追加を止める
      await page.request.post('/api/capture/stop');

      // 停止後もWebSocket経由でキューイングされたパケットが届く可能性がある
      // すべてのアニメーション（900ms）が完了するまで十分待つ
      await expect(page.locator('[data-testid="animated-packet"]')).toHaveCount(0, { timeout: 10000 });
    });
  });

  test.describe('ストリームモード切替', () => {
    test('高レートでストリームアニメーションが有効化される', async ({ page }) => {
      // 高レート（1パケット/50ms = 20pps > 閾値5pps）に設定
      await configureMock(page, { intervalMs: 50, nicDropRate: 0, fwDropRate: 0 });
      await page.request.post('/api/capture/start');

      // packet-stream 要素が出現（ストリームモード有効化）
      await expect(async () => {
        const count = await page.locator('[data-testid="packet-stream"]').count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      await page.request.post('/api/capture/stop');
    });
  });

  test.describe('ドロップアニメーション', () => {
    test('NIC層でドロップアニメーションが表示される', async ({ page }) => {
      // NIC層までスクロール
      await page.getByTestId('nic-device').scrollIntoViewIfNeeded();

      // 高ドロップレート設定
      await configureMock(page, { intervalMs: 100, nicDropRate: 0.5, fwDropRate: 0 });
      await page.request.post('/api/capture/start');

      // ドロップカウンターが増加するのを確認（アニメーション有無に関わらず確実）
      await expect(async () => {
        const badge = page.getByTestId('drop-count-nic');
        const text = await badge.textContent();
        expect(Number(text)).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      await page.request.post('/api/capture/stop');
    });

    test('FW層でドロップアニメーションが表示される', async ({ page }) => {
      // FW層までスクロール
      await page.getByText('Firewall').scrollIntoViewIfNeeded();

      // 高FWドロップレート設定
      await configureMock(page, { intervalMs: 100, nicDropRate: 0, fwDropRate: 0.5 });
      await page.request.post('/api/capture/start');

      // FWドロップカウンターが増加するのを確認
      await expect(async () => {
        const badge = page.getByTestId('drop-count-firewall');
        const text = await badge.textContent();
        expect(Number(text)).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      await page.request.post('/api/capture/stop');
    });
  });

  test.describe('NICデバイス展開アニメーション', () => {
    test('クリックでインターフェースボタンがアニメーション付きで出現する', async ({ page }) => {
      const nicDevice = page.getByTestId('nic-device');
      await nicDevice.scrollIntoViewIfNeeded();

      // 初期状態: NICボタンは非表示
      await expect(page.locator('[data-testid^="nic-"]:not([data-testid="nic-device"]):not([data-testid="nic-flag"])')).toHaveCount(0);

      // クリックで展開
      await nicDevice.click();

      // NICインターフェースボタンが出現
      const nicButtons = page.locator('[data-testid^="nic-"]:not([data-testid="nic-device"]):not([data-testid="nic-flag"])');
      await expect(async () => {
        const count = await nicButtons.count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 5000 });

      // 全ボタンが表示状態になる（スタガーアニメーション完了）
      const count = await nicButtons.count();
      for (let i = 0; i < count; i++) {
        await expect(nicButtons.nth(i)).toBeVisible();
      }
    });

    test('再クリックでインターフェースボタンが消える', async ({ page }) => {
      const nicDevice = page.getByTestId('nic-device');
      await nicDevice.scrollIntoViewIfNeeded();

      // 展開
      await nicDevice.click();
      const nicButtons = page.locator('[data-testid^="nic-"]:not([data-testid="nic-device"]):not([data-testid="nic-flag"])');
      await expect(async () => {
        const count = await nicButtons.count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 5000 });

      // 閉じる（外側クリック）
      await page.locator('body').click({ position: { x: 10, y: 10 } });

      // AnimatePresenceの退出アニメーション完了後に非表示
      await expect(nicButtons).toHaveCount(0, { timeout: 5000 });
    });
  });

  test.describe('メールボックスフラグ', () => {
    test('パケット受信時にフラグが立つ（rotate-0）', async ({ page }) => {
      // 初期状態ではフラグは倒れている
      const flag = page.getByTestId('mailbox-flag-etc');
      await expect(flag).toBeVisible();

      // キャプチャ開始
      await configureMock(page, { intervalMs: 200, nicDropRate: 0, fwDropRate: 0 });
      await page.request.post('/api/capture/start');

      // パケットが届いてフラグが立つ（bg-successクラスが付く）
      await expect(async () => {
        const classList = await flag.evaluate(el => el.className);
        expect(classList).toContain('bg-success');
        expect(classList).toContain('rotate-0');
      }).toPass({ timeout: 10000 });

      await page.request.post('/api/capture/stop');
    });

    test('NICデバイスフラグがキャプチャ状態で立つ', async ({ page }) => {
      const nicFlag = page.getByTestId('nic-flag');
      await page.getByTestId('nic-device').scrollIntoViewIfNeeded();

      // キャプチャ開始
      await configureMock(page, { intervalMs: 200, nicDropRate: 0, fwDropRate: 0 });
      await page.request.post('/api/capture/start');

      // NICフラグが立つ
      await expect(async () => {
        const classList = await nicFlag.evaluate(el => el.className);
        expect(classList).toContain('bg-success');
        expect(classList).toContain('rotate-0');
      }).toPass({ timeout: 10000 });

      await page.request.post('/api/capture/stop');
    });
  });

  test.describe('キャプチャ停止後のアニメーション', () => {
    test('停止後に個別パケットアニメーションがDOMから消える', async ({ page }) => {
      // 低レートでキャプチャ開始（ストリームモードにならない設定）
      await configureMock(page, { intervalMs: 300, nicDropRate: 0, fwDropRate: 0 });
      await page.request.post('/api/capture/start');

      // パケットが出現するのを確認
      await expect(async () => {
        const count = await page.locator('[data-testid="animated-packet"]').count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      // キャプチャ停止
      await page.request.post('/api/capture/stop');

      // 個別パケットアニメーション（900ms）が完了してDOMから消える
      await expect(page.locator('[data-testid="animated-packet"]')).toHaveCount(0, { timeout: 10000 });
    });
  });
});
