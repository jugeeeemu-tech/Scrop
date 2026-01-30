import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';

const PORT = process.env.E2E_PORT ?? '3000';
const url = `http://localhost:${PORT}`;

// サーバーが起動済みか確認し、未起動なら自動起動
async function ensureServer(): Promise<ReturnType<typeof spawn> | null> {
  try {
    await fetch(url);
    return null; // already running
  } catch {
    // サーバーを起動
    const server = spawn(
      'cargo',
      ['run', '-p', 'scrop-server', '--no-default-features', '--', '--port', PORT],
      { stdio: 'ignore' },
    );
    // サーバーの準備完了を待機
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        await fetch(url);
        return server;
      } catch {
        // retry
      }
    }
    server.kill();
    throw new Error('Server failed to start within 120s');
  }
}

const server = await ensureServer();

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
  server?.kill();
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
server?.kill();
