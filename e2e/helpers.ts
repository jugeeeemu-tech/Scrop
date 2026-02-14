import type { Page } from '@playwright/test';

interface MockConfig {
  intervalMs?: number;
  nicDropRate?: number;
  fwDropRate?: number;
  batchSize?: number;
  trafficProfile?: 'realistic' | 'bench' | 'dataset';
  datasetSize?: number;
}

/**
 * PUT /api/mock/config でモック設定を更新する。
 * mockモードサーバでのみ有効。
 */
export async function configureMock(page: Page, config: MockConfig): Promise<void> {
  const res = await page.request.put('/api/mock/config', { data: config });
  if (!res.ok()) {
    throw new Error(`Failed to configure mock: ${res.status()} ${await res.text()}`);
  }
}

/**
 * ドロップ系テスト用: 高頻度・高ドロップ率に設定。
 * intervalMs=50, nicDropRate=0.3, fwDropRate=0.3
 */
export async function configureFastDrops(page: Page): Promise<void> {
  await configureMock(page, {
    intervalMs: 50,
    nicDropRate: 0.3,
    fwDropRate: 0.3,
  });
}
