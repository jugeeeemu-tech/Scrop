import { test, expect, Page } from '@playwright/test';
import type { PortInfo } from '../src/types';

// --- Helpers ---

async function seedPorts(page: Page, ports: PortInfo[]) {
  await page.evaluate(
    (data) => localStorage.setItem('scrop:ports', JSON.stringify(data)),
    ports
  );
}

const SEED_PORTS: PortInfo[] = [
  { type: 'port', port: 80, label: 'HTTP' },
  { type: 'etc', label: 'Other' },
];

test.describe('メールボックスバッジ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
  });

  test('パケット受信でバッジが表示される', async ({ page }) => {
    // delivered-count > 0 を待つ
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="delivered-count"]');
      return el && Number(el.textContent) > 0;
    }, null, { timeout: 30000 });

    // mailbox-badge-* が1つ以上 visible
    const badges = page.locator('[data-testid^="mailbox-badge-"]');
    await expect(async () => {
      const count = await badges.count();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 30000 });
  });

  test('バッジにパケット数が表示される', async ({ page }) => {
    // delivered-count >= 3 を待つ
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="delivered-count"]');
      return el && Number(el.textContent) >= 3;
    }, null, { timeout: 30000 });

    // バッジテキストが数値 or "99+"
    const badges = page.locator('[data-testid^="mailbox-badge-"]');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveText(/^\d+$|^99\+$/);
    }
  });
});

test.describe('localStorage永続化', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
    await seedPorts(page, SEED_PORTS);
    await page.reload();
    await page.waitForSelector('[data-testid="mailbox-80"]');
  });

  test('ポート番号編集がlocalStorageに永続化される', async ({ page }) => {
    // 80→22 に編集
    await page.getByTestId('port-number-80').click();
    const input = page.getByTestId('port-number-80-input');
    await expect(input).toBeVisible();
    await input.fill('22');
    // fill で onChange が発火し testId が port-number-22-input に変わる
    await page.getByTestId('port-number-22-input').press('Enter');

    // 変更を確認
    await expect(page.getByTestId('mailbox-22')).toBeVisible();

    // リロード
    await page.reload();
    await page.waitForSelector('[data-testid="capture-toggle"]');

    // mailbox-22 が表示、mailbox-80 は非表示
    await expect(page.getByTestId('mailbox-22')).toBeVisible();
    await expect(page.getByTestId('mailbox-80')).not.toBeVisible();
  });

  test('ラベル編集がlocalStorageに永続化される', async ({ page }) => {
    // ラベルを編集
    await page.getByTestId('port-label-80').click();
    const input = page.getByTestId('port-label-80-input');
    await expect(input).toBeVisible();
    await input.fill('Custom');
    await input.press('Enter');

    // 変更を確認
    await expect(page.getByTestId('port-label-80')).toHaveText('Custom');

    // リロード
    await page.reload();
    await page.waitForSelector('[data-testid="capture-toggle"]');

    // "Custom" が表示される
    await expect(page.getByTestId('port-label-80')).toHaveText('Custom');
  });

  test('不正なlocalStorageデータでデフォルトにフォールバックする', async ({ page }) => {
    // 不正JSONをlocalStorageに設定
    await page.evaluate(() => localStorage.setItem('scrop:ports', 'invalid-json{{{'));

    // リロード
    await page.reload();
    await page.waitForSelector('[data-testid="capture-toggle"]');

    // デフォルト(80/etc)が復元される
    await expect(page.getByTestId('mailbox-80')).toBeVisible();
    await expect(page.getByTestId('mailbox-etc')).toBeVisible();
  });
});
