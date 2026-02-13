import { test, expect, Page } from '@playwright/test';
import type { PortInfo } from '../src/types';
import { configureMock } from './helpers';

test.describe.configure({ mode: 'serial' });

// --- Helpers ---

/** localStorage にポート構成をシードする */
async function seedPorts(page: Page, ports: PortInfo[]) {
  await page.evaluate(
    (data) => localStorage.setItem('scrop:ports', JSON.stringify(data)),
    ports
  );
}

/** mailbox-* のtestidを持つ要素をX座標でソートして返す（page.evaluate で一括取得） */
async function getMailboxOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button[data-testid^="mailbox-"]'));
    return els
      .map((el) => ({
        testId: el.getAttribute('data-testid')!,
        x: el.getBoundingClientRect().x,
      }))
      .sort((a, b) => a.x - b.x)
      .map((item) => item.testId);
  });
}

/** packet-stream の left 座標を昇順で取得 */
async function getPacketStreamLefts(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="packet-stream"]'))
      .map((el) => Math.round(el.getBoundingClientRect().left))
      .sort((a, b) => a - b);
  });
}

/** Framer Motion互換のドラッグ操作 */
async function drag(
  page: Page,
  source: { x: number; y: number },
  deltaX: number,
  deltaY: number,
  steps = 20
) {
  await page.mouse.move(source.x, source.y);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(100);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      source.x + (deltaX * i) / steps,
      source.y + (deltaY * i) / steps
    );
  }
  await page.waitForTimeout(100);
  await page.mouse.up();
  // ドロップ後のアニメーション完了を待つ
  await page.waitForTimeout(500);
}

/** 要素の中心座標を取得 */
async function getCenter(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`Element ${testId} not found or not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// --- Seed data ---

const SEED_PORTS: PortInfo[] = [
  { type: 'port', port: 80, label: 'HTTP' },
  { type: 'port', port: 443, label: 'HTTPS' },
  { type: 'port', port: 22, label: 'SSH' },
  { type: 'etc', label: 'Other' },
];

// --- Tests ---

test.describe('ポートレイヤ: ドラッグ&ドロップ・削除', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
    // ポートをシードしてリロード
    await seedPorts(page, SEED_PORTS);
    await page.reload();
    await page.waitForSelector('[data-testid="mailbox-80"]');
    // レイアウト安定を待つ
    await page.waitForTimeout(500);
  });

  test.describe('並び替え（水平ドラッグ）', () => {
    test('水平ドラッグでポートを並び替えできる', async ({ page }) => {
      // 初期順序を確認
      const before = await getMailboxOrder(page);
      expect(before).toEqual(['mailbox-80', 'mailbox-443', 'mailbox-22', 'mailbox-etc']);

      // mailbox-80 を右にドラッグ（443の位置を超える）
      const source = await getCenter(page, 'mailbox-80');
      const target = await getCenter(page, 'mailbox-443');
      const deltaX = target.x - source.x + 50;

      await drag(page, source, deltaX, 0);

      // 並び替えが反映されるまで待つ
      await expect(async () => {
        const after = await getMailboxOrder(page);
        const idx80 = after.indexOf('mailbox-80');
        const idx443 = after.indexOf('mailbox-443');
        expect(idx80).toBeGreaterThan(idx443);
      }).toPass({ timeout: 5000 });
    });

    test('並び替え後もetcは常に最後', async ({ page }) => {
      const source = await getCenter(page, 'mailbox-80');
      const target = await getCenter(page, 'mailbox-22');
      const deltaX = target.x - source.x + 50;

      await drag(page, source, deltaX, 0);

      await expect(async () => {
        const after = await getMailboxOrder(page);
        expect(after[after.length - 1]).toBe('mailbox-etc');
      }).toPass({ timeout: 5000 });
    });

    test('並び替えがlocalStorageに永続化される', async ({ page }) => {
      const source = await getCenter(page, 'mailbox-80');
      const target = await getCenter(page, 'mailbox-443');
      const deltaX = target.x - source.x + 50;

      await drag(page, source, deltaX, 0);

      // 並び替えが反映されるまで待つ
      await expect(async () => {
        const after = await getMailboxOrder(page);
        const idx80 = after.indexOf('mailbox-80');
        const idx443 = after.indexOf('mailbox-443');
        expect(idx80).toBeGreaterThan(idx443);
      }).toPass({ timeout: 5000 });

      // localStorageを確認
      const stored = await page.evaluate(() => localStorage.getItem('scrop:ports'));
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!) as PortInfo[];
      const idx80 = parsed.findIndex((p) => p.type === 'port' && p.port === 80);
      const idx443 = parsed.findIndex((p) => p.type === 'port' && p.port === 443);
      expect(idx443).toBeLessThan(idx80);
      expect(parsed[parsed.length - 1].type).toBe('etc');
    });
  });

  test.describe('削除（垂直ドラッグ）', () => {
    test('下方向100px以上で削除される', async ({ page }) => {
      await expect(page.getByTestId('mailbox-443')).toBeVisible();
      const source = await getCenter(page, 'mailbox-443');

      await drag(page, source, 0, 150);

      await expect(page.getByTestId('mailbox-443')).not.toBeVisible({ timeout: 5000 });
    });

    test('上方向100px以上で削除される', async ({ page }) => {
      await expect(page.getByTestId('mailbox-22')).toBeVisible();
      const source = await getCenter(page, 'mailbox-22');

      await drag(page, source, 0, -150);

      await expect(page.getByTestId('mailbox-22')).not.toBeVisible({ timeout: 5000 });
    });

    test('100px未満では削除されない', async ({ page }) => {
      await expect(page.getByTestId('mailbox-443')).toBeVisible();
      const source = await getCenter(page, 'mailbox-443');

      await drag(page, source, 0, 50);

      // まだ表示されている
      await expect(page.getByTestId('mailbox-443')).toBeVisible();
    });

    test('削除がlocalStorageに永続化される', async ({ page }) => {
      await expect(page.getByTestId('mailbox-443')).toBeVisible();
      const source = await getCenter(page, 'mailbox-443');

      await drag(page, source, 0, 150);

      await expect(page.getByTestId('mailbox-443')).not.toBeVisible({ timeout: 5000 });

      const stored = await page.evaluate(() => localStorage.getItem('scrop:ports'));
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!) as PortInfo[];
      const has443 = parsed.some((p) => p.type === 'port' && p.port === 443);
      expect(has443).toBe(false);
    });

    test('削除直後に左端へストリームが残らない', async ({ page }) => {
      await page.request.post('/api/capture/stop');
      await page.request.post('/api/capture/reset');
      await configureMock(page, {
        intervalMs: 20,
        batchSize: 5,
        nicDropRate: 0,
        fwDropRate: 0,
      });

      await page.evaluate(() => {
        localStorage.setItem('scrop:attached-nics', JSON.stringify(['eth0']));
      });
      await seedPorts(page, SEED_PORTS);
      await page.reload();
      await page.waitForSelector('[data-testid="mailbox-443"]');
      await page.request.post('/api/capture/start');

      await expect(async () => {
        const lefts = await getPacketStreamLefts(page);
        expect(lefts.length).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      const source = await getCenter(page, 'mailbox-443');
      await drag(page, source, 0, 150);

      await expect(page.getByTestId('mailbox-443')).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const lefts = await getPacketStreamLefts(page);
        const hasLeftEdgeResidue = lefts.some((left) => left <= 20);
        expect(hasLeftEdgeResidue).toBe(false);
      }).toPass({ timeout: 1500 });

      await page.request.post('/api/capture/stop');
    });

    test('etcポートはドラッグで削除できない', async ({ page }) => {
      await expect(page.getByTestId('mailbox-etc')).toBeVisible();
      const source = await getCenter(page, 'mailbox-etc');

      await drag(page, source, 0, 150);

      // etcはまだ表示されている
      await expect(page.getByTestId('mailbox-etc')).toBeVisible();
    });
  });
});
