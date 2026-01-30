import { test } from '@playwright/test';
import { configureMock } from '../e2e/helpers';
import fs from 'fs';

const REPORT_PATH = 'perf-report/stress-test.json';

interface StressLevel {
  label: string;
  targetPktPerSec: number;
  intervalMs: number;
  batchSize: number;
}

const STRESS_LEVELS: StressLevel[] = [
  { label: '1 pkt/s', targetPktPerSec: 1, intervalMs: 1000, batchSize: 1 },
  { label: '10 pkt/s', targetPktPerSec: 10, intervalMs: 100, batchSize: 1 },
  { label: '50 pkt/s', targetPktPerSec: 50, intervalMs: 20, batchSize: 1 },
  { label: '100 pkt/s', targetPktPerSec: 100, intervalMs: 10, batchSize: 1 },
  { label: '200 pkt/s', targetPktPerSec: 200, intervalMs: 10, batchSize: 2 },
  { label: '500 pkt/s', targetPktPerSec: 500, intervalMs: 10, batchSize: 5 },
  { label: '1000 pkt/s', targetPktPerSec: 1000, intervalMs: 10, batchSize: 10 },
];

interface LevelResult {
  label: string;
  targetPktPerSec: number;
  intervalMs: number;
  batchSize: number;
  fps: number;
  longTaskCount: number;
  longTasks: Array<{ duration: number }>;
  memoryMB: number;
  domNodeCount: number;
}

const results: LevelResult[] = [];

test.describe.serial('フロントエンド負荷限界ストレステスト', () => {
  for (const level of STRESS_LEVELS) {
    test(`${level.label} (interval=${level.intervalMs}ms, batch=${level.batchSize})`, async ({ page }) => {
      // ページ遷移
      await page.goto('/');
      await page.waitForSelector('[data-testid="capture-toggle"]');

      // Reset
      await page.request.post('/api/capture/reset');

      // Mock 設定
      await configureMock(page, {
        intervalMs: level.intervalMs,
        batchSize: level.batchSize,
      });

      // Start + attach
      await page.request.post('/api/capture/start');
      await page.request.post('/api/interfaces/eth0/attach');

      // 2秒ウォームアップ
      await page.waitForTimeout(2000);

      // CDP セッションを取得してメモリ計測の準備
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');

      // 5秒間計測: FPS + Long Tasks を同時に計測
      const measurement = await page.evaluate(() => new Promise<{
        fps: number;
        longTasks: Array<{ duration: number }>;
      }>(resolve => {
        let frames = 0;
        const longTasks: Array<{ duration: number }> = [];

        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            longTasks.push({ duration: entry.duration });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });

        const start = performance.now();
        const countFrame = () => {
          frames++;
          if (performance.now() - start < 5000) {
            requestAnimationFrame(countFrame);
          } else {
            observer.disconnect();
            const elapsed = (performance.now() - start) / 1000;
            resolve({
              fps: frames / elapsed,
              longTasks,
            });
          }
        };
        requestAnimationFrame(countFrame);
      }));

      // メモリ計測 (CDP)
      const { metrics } = await cdp.send('Performance.getMetrics');
      const heapMetric = metrics.find((m: { name: string; value: number }) => m.name === 'JSHeapUsedSize');
      const memoryMB = heapMetric ? heapMetric.value / (1024 * 1024) : 0;

      // DOM ノード数
      const domNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);

      // Stop
      await page.request.post('/api/capture/stop');

      const result: LevelResult = {
        label: level.label,
        targetPktPerSec: level.targetPktPerSec,
        intervalMs: level.intervalMs,
        batchSize: level.batchSize,
        fps: Math.round(measurement.fps * 10) / 10,
        longTaskCount: measurement.longTasks.length,
        longTasks: measurement.longTasks,
        memoryMB: Math.round(memoryMB * 100) / 100,
        domNodeCount,
      };

      results.push(result);

      console.log(
        `  ${level.label}: FPS=${result.fps}, LongTasks=${result.longTaskCount}, ` +
        `Memory=${result.memoryMB}MB, DOM=${result.domNodeCount}`
      );
    });
  }

  test.afterAll(() => {
    // サマリー計算
    const maxSustainableFps60 = results
      .filter(r => r.fps >= 55)
      .reduce((max, r) => Math.max(max, r.targetPktPerSec), 0);

    const firstLongTaskEntry = results.find(r => r.longTaskCount > 0);
    const firstLongTaskAt = firstLongTaskEntry ? firstLongTaskEntry.targetPktPerSec : null;

    const peakMemoryMB = Math.max(...results.map(r => r.memoryMB));

    const report = {
      timestamp: new Date().toISOString(),
      levels: results,
      summary: {
        maxSustainableFps60,
        firstLongTaskAt,
        peakMemoryMB: Math.round(peakMemoryMB * 100) / 100,
      },
    };

    fs.mkdirSync('perf-report', { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log('\n=== ストレステスト サマリー ===');
    console.log(`  55fps以上を維持できる最大レート: ${maxSustainableFps60} pkt/s`);
    console.log(`  最初の Long Task 検出レート: ${firstLongTaskAt ?? 'なし'} pkt/s`);
    console.log(`  ピークメモリ: ${report.summary.peakMemoryMB} MB`);
    console.log(`\nResults saved to ${REPORT_PATH}`);
  });
});
