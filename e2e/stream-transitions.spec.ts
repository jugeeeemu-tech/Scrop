import { test, expect } from '@playwright/test';
import { configureMock } from './helpers';

/**
 * ストリームモード遷移テスト
 *
 * mockサーバーの設定はグローバル状態のため、高レート設定に依存するテストは
 * 並行実行すると他テストのbeforeEachで設定が上書きされて不安定になる。
 * このファイルはplaywright.config.tsでdefaultプロジェクト完了後にシリアル実行される。
 */
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/capture/stop');
  await page.request.post('/api/capture/reset');
});

test('キャプチャ停止後にストリームがフェードアウトする', async ({ page }) => {
  // 高レートでストリームモードを開始
  await configureMock(page, { intervalMs: 50, nicDropRate: 0, fwDropRate: 0 });
  await page.goto('/');
  await page.waitForSelector('[data-testid="capture-toggle"]');
  await page.request.post('/api/capture/start');

  // ストリームモードが有効になるのを待つ
  await expect(async () => {
    const count = await page.locator('[data-testid="packet-stream"]').count();
    expect(count).toBeGreaterThan(0);
  }).toPass({ timeout: 10000 });

  // キャプチャ停止でパケット流入を完全に止める
  await page.request.post('/api/capture/stop');

  // ストリームが消えるのを確認
  // レート計算ウィンドウ(1s) + フェードアウト(500ms) + マージン
  await expect(page.locator('[data-testid="packet-stream"]')).toHaveCount(0, { timeout: 15000 });
});

test('高ドロップレートでドロップストリームが有効化される', async ({ page }) => {
  // 高ドロップレート設定
  await configureMock(page, { intervalMs: 20, nicDropRate: 0.8, fwDropRate: 0, batchSize: 2 });
  await page.goto('/');
  await page.waitForSelector('[data-testid="capture-toggle"]');

  // NIC層までスクロール
  await page.getByTestId('nic-device').scrollIntoViewIfNeeded();

  await page.request.post('/api/capture/start');

  // drop-stream 要素が出現（ドロップストリームモード有効化）
  await expect(async () => {
    const count = await page.locator('[data-testid="drop-stream"]').count();
    expect(count).toBeGreaterThan(0);
  }).toPass({ timeout: 15000 });

  await page.request.post('/api/capture/stop');
});
