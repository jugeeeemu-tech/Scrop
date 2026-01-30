import { test, expect } from '@playwright/test';

test.describe('Scrop E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // mockモードでは自動的にキャプチャ中なので、一旦停止してからテストを始める
    await page.waitForSelector('[data-testid="capture-toggle"]');
  });

  test.describe('ページ読み込み', () => {
    test('タイトルとヘッダーが表示される', async ({ page }) => {
      await expect(page.getByText('Scrop')).toBeVisible();
      await expect(page.getByText('Packet Capture Visualizer')).toBeVisible();
    });

    test('3つの層が存在する', async ({ page }) => {
      // ポート層: Mailboxが表示されている
      await expect(page.getByTestId('mailbox-80')).toBeVisible();

      // FW層
      await expect(page.getByText('Firewall')).toBeVisible();
      await expect(page.getByText('iptables/nftables')).toBeVisible();

      // NIC層
      await expect(page.getByText('NIC')).toBeVisible();
      await expect(page.getByText('XDP Layer')).toBeVisible();
    });

    test('カウンターが表示される', async ({ page }) => {
      await expect(page.getByTestId('delivered-count')).toBeVisible();
      await expect(page.getByTestId('dropped-count')).toBeVisible();
    });
  });

  test.describe('キャプチャ制御', () => {
    test('キャプチャの開始と停止ができる', async ({ page }) => {
      const toggleBtn = page.getByTestId('capture-toggle');

      // 初期状態はキャプチャ中（mockモード）→ 停止
      await toggleBtn.click();
      // API処理完了を待ってからステータス確認
      await expect(async () => {
        const res = await page.request.get('/api/capture/status');
        const status = await res.json();
        expect(status.isCapturing).toBe(false);
      }).toPass({ timeout: 5000 });

      // 再開
      await toggleBtn.click();
      await expect(async () => {
        const res = await page.request.get('/api/capture/status');
        const status = await res.json();
        expect(status.isCapturing).toBe(true);
      }).toPass({ timeout: 5000 });
    });

    test('リセットするとカウンターが0になる', async ({ page }) => {
      // パケットが蓄積されるのを待つ
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="delivered-count"]');
        return el && Number(el.textContent) > 0;
      }, null, { timeout: 5000 });

      // リセット
      await page.getByTestId('capture-reset').click();

      // カウンターが0に戻る
      await expect(page.getByTestId('delivered-count')).toHaveText('0');
      await expect(page.getByTestId('dropped-count')).toHaveText('0');
    });
  });

  test.describe('ポート管理', () => {
    test('ポートを追加できる', async ({ page }) => {
      // 初期状態のMailbox数を数える
      const initialCount = await page.locator('button[data-testid^="mailbox-"]').count();

      // Addボタンをクリック
      await page.getByTestId('add-port').click();

      // Mailboxが1つ増える
      const newCount = await page.locator('button[data-testid^="mailbox-"]').count();
      expect(newCount).toBe(initialCount + 1);
    });

    test('デフォルトのポート80が存在する', async ({ page }) => {
      await expect(page.getByTestId('mailbox-80')).toBeVisible();
      await expect(page.getByText('HTTP')).toBeVisible();
    });

    test('ETCポートが存在する', async ({ page }) => {
      await expect(page.getByTestId('mailbox-etc')).toBeVisible();
      await expect(page.getByText('Other')).toBeVisible();
    });
  });

  test.describe('パケット詳細モーダル', () => {
    test('メールボックスをクリックするとモーダルが開く', async ({ page }) => {
      // ETCメールボックスはパケットが溜まりやすい
      await page.getByTestId('mailbox-etc').click();

      // モーダルが表示される
      await expect(page.getByTestId('packet-modal-overlay')).toBeVisible();
    });

    test('閉じるボタンでモーダルが閉じる', async ({ page }) => {
      await page.getByTestId('mailbox-etc').click();
      await expect(page.getByTestId('packet-modal-overlay')).toBeVisible();

      // 閉じるボタン
      await page.getByTestId('packet-modal-close').click();
      await expect(page.getByTestId('packet-modal-overlay')).not.toBeVisible();
    });

    test('Escapeキーでモーダルが閉じる', async ({ page }) => {
      await page.getByTestId('mailbox-etc').click();
      await expect(page.getByTestId('packet-modal-overlay')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.getByTestId('packet-modal-overlay')).not.toBeVisible();
    });

    test('モーダル表示中は背面がスクロールできない', async ({ page }) => {
      // NIC層が見えるようスクロールし、スクロール可能な状態を作る
      await page.getByTestId('nic-device').scrollIntoViewIfNeeded();
      const scrolledY = await page.evaluate(() => window.scrollY);
      expect(scrolledY).toBeGreaterThan(0);

      // モーダルを開く
      await page.getByTestId('mailbox-etc').click();
      await expect(page.getByTestId('packet-modal-overlay')).toBeVisible();

      // body に overflow: hidden が設定されている
      const overflow = await page.evaluate(() => document.body.style.overflow);
      expect(overflow).toBe('hidden');

      // マウスホイールでスクロールを試みる
      const beforeY = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(200);
      const afterY = await page.evaluate(() => window.scrollY);
      expect(afterY).toBe(beforeY);

      // モーダルを閉じるとスクロール可能に戻る
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('packet-modal-overlay')).not.toBeVisible();
      const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(restoredOverflow).toBe('');
    });

    test('モーダルにパケット情報が表示される', async ({ page }) => {
      // パケットが蓄積されるのを少し待つ
      await page.waitForTimeout(1000);

      await page.getByTestId('mailbox-etc').click();
      await expect(page.getByTestId('packet-modal-overlay')).toBeVisible();

      // パケット情報が含まれている (Protocol, サイズ, アドレス)
      const modal = page.getByTestId('packet-modal-overlay');
      await expect(modal.getByText('TCP').first()).toBeVisible();
      // "→" (矢印) を含むアドレス表示がある
      await expect(modal.getByText(/→/).first()).toBeVisible();
    });
  });

  test.describe('NIC管理', () => {
    test('NICデバイスをクリックするとインターフェース一覧が展開する', async ({ page }) => {
      // NICデバイスまでスクロール
      const nicDevice = page.getByTestId('nic-device');
      await nicDevice.scrollIntoViewIfNeeded();
      await nicDevice.click();

      // mockモードのインターフェースが表示される
      await expect(page.getByTestId(/^nic-/).first()).toBeVisible();
    });
  });

  test.describe('リアルタイム更新', () => {
    test('キャプチャ中にカウンターが増加する', async ({ page }) => {
      // 初期値を記録
      const initialText = await page.getByTestId('delivered-count').textContent();
      const initialCount = Number(initialText);

      // しばらく待つ
      await page.waitForTimeout(2000);

      // カウンターが増加している
      const updatedText = await page.getByTestId('delivered-count').textContent();
      const updatedCount = Number(updatedText);
      expect(updatedCount).toBeGreaterThan(initialCount);
    });
  });

  test.describe('REST API', () => {
    test('GET /api/capture/status が正しい形式を返す', async ({ page }) => {
      const res = await page.request.get('/api/capture/status');
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty('isCapturing');
      expect(body).toHaveProperty('stats');
      expect(body.stats).toHaveProperty('totalPackets');
      expect(body.stats).toHaveProperty('nicDropped');
      expect(body.stats).toHaveProperty('fwDropped');
      expect(body.stats).toHaveProperty('delivered');
    });

    test('GET /api/interfaces がインターフェース一覧を返す', async ({ page }) => {
      const res = await page.request.get('/api/interfaces');
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(Array.isArray(body)).toBeTruthy();
    });

    test('POST /api/capture/start と stop が動作する', async ({ page }) => {
      // 停止
      const stopRes = await page.request.post('/api/capture/stop');
      expect(stopRes.ok()).toBeTruthy();

      let status = await (await page.request.get('/api/capture/status')).json();
      expect(status.isCapturing).toBe(false);

      // 開始
      const startRes = await page.request.post('/api/capture/start');
      expect(startRes.ok()).toBeTruthy();

      status = await (await page.request.get('/api/capture/status')).json();
      expect(status.isCapturing).toBe(true);
    });
  });
});
