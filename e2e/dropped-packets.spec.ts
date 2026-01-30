import { test, expect } from '@playwright/test';

test.describe('ドロップパケット表示・エラーハンドリング', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
  });

  test.describe('ドロップパケット表示', () => {
    test('FW層にドロップパケットが表示される', async ({ page }) => {
      // API polling で fwDropped > 0 を待つ
      await expect(async () => {
        const res = await page.request.get('/api/capture/status');
        const status = await res.json();
        expect(status.stats.fwDropped).toBeGreaterThan(0);
      }).toPass({ timeout: 60000 });

      // drop-pile-firewall が visible（スクロールして確認）
      const pile = page.getByTestId('drop-pile-firewall');
      await pile.scrollIntoViewIfNeeded();
      await expect(pile).toBeVisible();
    });

    test('NIC層にドロップパケットが表示される', async ({ page }) => {
      // API polling で nicDropped > 0 を待つ
      await expect(async () => {
        const res = await page.request.get('/api/capture/status');
        const status = await res.json();
        expect(status.stats.nicDropped).toBeGreaterThan(0);
      }).toPass({ timeout: 60000 });

      // drop-pile-nic が visible（スクロールして確認）
      const pile = page.getByTestId('drop-pile-nic');
      await pile.scrollIntoViewIfNeeded();
      await expect(pile).toBeVisible();
    });

    test('ドロップ数バッジが正しく表示される', async ({ page }) => {
      // UI上でバッジが表示されるまで待つ（WebSocket経由で受信）
      const fwBadge = page.getByTestId('drop-count-firewall');
      const nicBadge = page.getByTestId('drop-count-nic');

      await expect(async () => {
        // FW層にスクロール
        const fwPile = page.getByTestId('drop-pile-firewall');
        await fwPile.scrollIntoViewIfNeeded();
        const fwCount = await fwBadge.count();
        // NIC層にスクロール
        const nicPile = page.getByTestId('drop-pile-nic');
        await nicPile.scrollIntoViewIfNeeded();
        const nicCount = await nicBadge.count();
        expect(fwCount + nicCount).toBeGreaterThan(0);
      }).toPass({ timeout: 60000 });

      // 表示されているバッジのテキストが数値 or "99+"
      const fwCount = await fwBadge.count();
      if (fwCount > 0) {
        await page.getByTestId('drop-pile-firewall').scrollIntoViewIfNeeded();
        await expect(fwBadge).toHaveText(/^\d+$|^99\+$/);
      }
      const nicCount = await nicBadge.count();
      if (nicCount > 0) {
        await page.getByTestId('drop-pile-nic').scrollIntoViewIfNeeded();
        await expect(nicBadge).toHaveText(/^\d+$|^99\+$/);
      }
    });

    test('ドロップ理由がホバーで表示される', async ({ page }) => {
      // UI上でFWドロップバッジが表示されるまで待つ
      const fwBadge = page.getByTestId('drop-count-firewall');
      await expect(async () => {
        const fwPile = page.getByTestId('drop-pile-firewall');
        await fwPile.scrollIntoViewIfNeeded();
        await expect(fwBadge).toBeVisible();
      }).toPass({ timeout: 60000 });

      // drop-pile-firewall にホバー
      const pile = page.getByTestId('drop-pile-firewall');
      await pile.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await pile.hover();

      // ツールチップが表示される
      const tooltip = page.getByTestId('drop-tooltip-firewall');
      await expect(tooltip).toBeVisible({ timeout: 5000 });
      // ドロップ情報が含まれる（"Firewall Drops" ヘッダーが表示される）
      await expect(tooltip.getByText('Firewall Drops')).toBeVisible();
    });
  });

  test.describe('エラーハンドリング', () => {
    test('API失敗時にエラーバナーが表示される', async ({ page }) => {
      // /api/capture/stop を500エラーに置き換え
      await page.route('**/api/capture/stop', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal Server Error' }) })
      );

      // キャプチャ停止ボタンをクリック（失敗させる）
      await page.getByTestId('capture-toggle').click();

      // エラーバナーが表示される
      await expect(page.getByTestId('error-banner')).toBeVisible();
    });

    test('エラーはキャプチャ成功時にクリアされる', async ({ page }) => {
      // まずエラーを発生させる
      await page.route('**/api/capture/stop', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal Server Error' }) })
      );

      await page.getByTestId('capture-toggle').click();
      await expect(page.getByTestId('error-banner')).toBeVisible();

      // routeを解除
      await page.unroute('**/api/capture/stop');

      // 再度クリックして正常に動作させる
      await page.getByTestId('capture-toggle').click();

      // エラーバナーが非表示になる
      await expect(page.getByTestId('error-banner')).not.toBeVisible();
    });
  });
});
