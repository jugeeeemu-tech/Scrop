import { test, expect, Page } from '@playwright/test';
import type { PortInfo } from '../src/types';

test.describe.configure({ mode: 'serial' });

// --- Helpers ---

async function seedPorts(page: Page, ports: PortInfo[]) {
  await page.evaluate(
    (data) => localStorage.setItem('scrop:ports', JSON.stringify(data)),
    ports
  );
}

const SEED_PORTS: PortInfo[] = [
  { type: 'port', port: 80, label: 'HTTP' },
  { type: 'port', port: 443, label: 'HTTPS' },
  { type: 'etc', label: 'Other' },
];

// --- Tests ---

test.describe('ポートインライン編集', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
    await seedPorts(page, SEED_PORTS);
    await page.reload();
    await page.waitForSelector('[data-testid="mailbox-80"]');
  });

  test('ポート番号をクリックすると編集モードになる', async ({ page }) => {
    const portNumber = page.getByTestId('port-number-80');
    await portNumber.click();

    const input = page.getByTestId('port-number-80-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('Enterキーでポート番号の編集を確定できる', async ({ page }) => {
    // ポート番号をクリックして編集モードに
    await page.getByTestId('port-number-80').click();
    const input = page.getByTestId('port-number-80-input');
    await expect(input).toBeVisible();

    // 80→8080 に変更（コミットまでストアは更新されない）
    await input.fill('8080');
    await input.press('Enter');

    // mailbox-8080 が表示され、ラベルが自動で "Proxy" になる
    await expect(page.getByTestId('mailbox-8080')).toBeVisible();
    await expect(page.getByTestId('port-label-8080')).toHaveText('Proxy');
  });

  test('Escapeキーで編集モードを終了できる', async ({ page }) => {
    await page.getByTestId('port-number-80').click();
    const input = page.getByTestId('port-number-80-input');
    await expect(input).toBeVisible();

    // Escape で編集モードを終了
    await input.press('Escape');

    // input が消えて表示モードに戻る
    await expect(input).not.toBeVisible();
    await expect(page.getByTestId('port-number-80')).toBeVisible();
  });

  test('ラベルをクリックして編集・確定できる', async ({ page }) => {
    const label = page.getByTestId('port-label-80');
    await label.click();

    const input = page.getByTestId('port-label-80-input');
    await expect(input).toBeVisible();

    await input.fill('My Web');
    await input.press('Enter');

    await expect(page.getByTestId('port-label-80')).toHaveText('My Web');
  });

  test('重複するポート番号は拒否される', async ({ page }) => {
    // 80→443 に変更を試みる（443は既に存在）
    // fill は一度に値をセットするので中間値による意図しない更新を回避
    await page.getByTestId('port-number-80').click();
    const input = page.getByTestId('port-number-80-input');
    await expect(input).toBeVisible();

    await input.fill('443');
    // 重複で updatePort が拒否 → port は 80 のまま → testId も port-number-80-input のまま
    await input.press('Enter');

    // 443 のメールボックスが2つにならない（元々あった443は1つだけ）
    await expect(page.locator('[data-testid="mailbox-443"]')).toHaveCount(1);
    // 80 のメールボックスが残っている
    await expect(page.getByTestId('mailbox-80')).toBeVisible();
  });

  test('ポート番号変更でサービス名が自動入力される', async ({ page }) => {
    // 80→22 に変更
    await page.getByTestId('port-number-80').click();
    const input = page.getByTestId('port-number-80-input');
    await expect(input).toBeVisible();

    // コミットまでストアは更新されない
    await input.fill('22');
    await input.press('Enter');

    // ラベルが "SSH" に自動変更
    await expect(page.getByTestId('port-label-22')).toHaveText('SSH');
  });
});
