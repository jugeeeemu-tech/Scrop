import { test } from '@playwright/test';
import { configureMock } from '../e2e/helpers';
import fs from 'fs';

const REPORT_PATH = 'perf-report/cdp-metrics.json';
const results: Record<string, unknown> = {};

test.describe('パフォーマンス計測', () => {
  test('ページロード メトリクス', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');

    const { metrics } = await cdp.send('Performance.getMetrics');
    results.pageLoad = Object.fromEntries(metrics.map(m => [m.name, m.value]));
    console.log('=== Page Load Metrics ===');
    for (const m of metrics) console.log(`  ${m.name}: ${m.value}`);
  });

  test('アニメーション FPS (5秒間)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
    await configureMock(page, { intervalMs: 50 });

    // FPS 計測: requestAnimationFrame で 5 秒間カウント
    const fps = await page.evaluate(() => new Promise<number>(resolve => {
      let frames = 0;
      const start = performance.now();
      const count = () => {
        frames++;
        if (performance.now() - start < 5000) {
          requestAnimationFrame(count);
        } else {
          resolve(frames / ((performance.now() - start) / 1000));
        }
      };
      requestAnimationFrame(count);
    }));

    results.fps = { value: fps, duration: '5s', mockInterval: '50ms' };
    console.log(`=== FPS (5s) === ${fps.toFixed(1)} fps`);
  });

  test('Long Tasks 検出 (5秒間)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
    await configureMock(page, { intervalMs: 50 });

    const longTasks = await page.evaluate(() => new Promise<Array<{ duration: number }>>(resolve => {
      const tasks: Array<{ duration: number }> = [];
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          tasks.push({ duration: entry.duration });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
      setTimeout(() => { observer.disconnect(); resolve(tasks); }, 5000);
    }));

    results.longTasks = { count: longTasks.length, tasks: longTasks };
    console.log(`=== Long Tasks === ${longTasks.length} detected`);
    if (longTasks.length > 0) {
      for (const t of longTasks) console.log(`  ${t.duration.toFixed(1)}ms`);
    }
  });

  test.afterAll(() => {
    fs.mkdirSync('perf-report', { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${REPORT_PATH}`);
  });
});
