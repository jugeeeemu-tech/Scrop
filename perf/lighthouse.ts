import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import fs from 'fs';

const PORT = process.env.E2E_PORT ?? '3000';
const url = `http://localhost:${PORT}`;

// Playwright Chromium をリモートデバッグ付きで起動
const browser = await chromium.launch({
  args: ['--remote-debugging-port=9222'],
  headless: true,
});

const result = await lighthouse(url, {
  port: 9222,
  output: 'json',
  onlyCategories: ['performance'],
});

if (!result) {
  console.error('Lighthouse returned no result');
  await browser.close();
  process.exit(1);
}

// JSON 出力
fs.mkdirSync('perf-report', { recursive: true });
fs.writeFileSync('perf-report/lighthouse.json', JSON.stringify(result.lhr, null, 2));

// サマリ表示
const { categories, audits } = result.lhr;
console.log('=== Lighthouse Performance ===');
console.log(`Score: ${(categories.performance?.score ?? 0) * 100}`);
console.log(`LCP: ${audits['largest-contentful-paint']?.displayValue}`);
console.log(`CLS: ${audits['cumulative-layout-shift']?.displayValue}`);
console.log(`TBT: ${audits['total-blocking-time']?.displayValue}`);

await browser.close();
