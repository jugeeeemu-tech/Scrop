import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('NICアタッチ/デタッチとパケットフロー', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage をクリアして初期状態にする（全NICアタッチ）
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('scrop:attached-nics'));
    await page.reload();
    await page.waitForSelector('[data-testid="capture-toggle"]');
    // initializeNics() が全NICをアタッチしてキャプチャが始まるのを待つ
    await expect(async () => {
      const res = await page.request.get('/api/capture/status');
      const status = await res.json();
      expect(status.isCapturing).toBe(true);
    }).toPass({ timeout: 10000 });
  });

  test('NICアタッチ状態でキャプチャするとパケットが増加する', async ({ page }) => {
    // initializeNics()で全NICアタッチ済み、キャプチャ中
    // パケットが蓄積されるのを待つ
    await expect(async () => {
      const res = await page.request.get('/api/capture/status');
      const status = await res.json();
      expect(status.stats.totalPackets).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
  });

  test('全NICデタッチ後はパケットが生成されない', async ({ page }) => {
    // パケットが少なくとも1つ生成されるのを待つ（NICがアタッチされている証拠）
    await expect(async () => {
      const res = await page.request.get('/api/capture/status');
      const status = await res.json();
      expect(status.stats.totalPackets).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });

    // キャプチャ停止
    await page.request.post('/api/capture/stop');

    // 全NICをAPIで直接デタッチ
    const res = await page.request.get('/api/interfaces');
    const interfaces: string[] = await res.json();
    for (const name of interfaces) {
      await page.request.post(`/api/interfaces/${name}/detach`).catch(() => {});
    }

    // リセット（パケットカウンターを0にする）
    await page.request.post('/api/capture/reset');

    // キャプチャ開始（NICアタッチなし）
    await page.request.post('/api/capture/start');

    // 開始直後のパケット数を記録
    const initial = await (await page.request.get('/api/capture/status')).json();
    const initialPackets = initial.stats.totalPackets;

    // 5秒待ってパケット数が増えていないことを確認
    await page.waitForTimeout(5000);
    const status = await (await page.request.get('/api/capture/status')).json();
    expect(status.stats.totalPackets).toBe(initialPackets);

    // クリーンアップ
    await page.request.post('/api/capture/stop');
  });

  test('NICデタッチ後に再アタッチするとパケット生成が再開する', async ({ page }) => {
    // キャプチャ停止
    await page.request.post('/api/capture/stop');

    // 全NICをデタッチ
    const res = await page.request.get('/api/interfaces');
    const interfaces: string[] = await res.json();
    for (const name of interfaces) {
      await page.request.post(`/api/interfaces/${name}/detach`).catch(() => {});
    }

    // リセット
    await page.request.post('/api/capture/reset');

    // eth0 を再アタッチ
    const attachRes = await page.request.post('/api/interfaces/eth0/attach');
    expect(attachRes.ok()).toBeTruthy();

    // キャプチャ開始
    await page.request.post('/api/capture/start');

    // パケットが生成されるのを確認
    await expect(async () => {
      const statusRes = await page.request.get('/api/capture/status');
      const status = await statusRes.json();
      expect(status.stats.totalPackets).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });

    // クリーンアップ
    await page.request.post('/api/capture/stop');
  });

  test('UIからNICをトグルできる', async ({ page }) => {
    // NICデバイスまでスクロールして展開
    const nicDevice = page.getByTestId('nic-device');
    await nicDevice.scrollIntoViewIfNeeded();
    await nicDevice.click();

    // eth0 のNICボタンが表示される
    const eth0Button = page.getByTestId('nic-eth0');
    await expect(eth0Button).toBeVisible();

    // eth0 をクリックしてデタッチ（初期状態はアタッチ済み）
    await eth0Button.click();

    // UIが更新されたことを確認（破線ボーダーに変わる）
    await expect(async () => {
      const classes = await eth0Button.getAttribute('class');
      expect(classes).toContain('border-dashed');
    }).toPass({ timeout: 3000 });

    // もう一度クリックして再アタッチ
    await eth0Button.click();

    // アタッチ状態に戻る（実線ボーダーに戻る）
    await expect(async () => {
      const classes = await eth0Button.getAttribute('class');
      expect(classes).not.toContain('border-dashed');
    }).toPass({ timeout: 3000 });
  });

  test('UIから全NICをデタッチするとパケット生成が止まる', async ({ page }) => {
    // NICデバイスまでスクロールして展開
    const nicDevice = page.getByTestId('nic-device');
    await nicDevice.scrollIntoViewIfNeeded();
    await nicDevice.click();

    // 全NICをクリックしてデタッチ
    for (const name of ['eth0', 'lo', 'wlan0', 'docker0']) {
      const btn = page.getByTestId(`nic-${name}`);
      await btn.click();
      // 破線ボーダーになるのを待つ
      await expect(async () => {
        const classes = await btn.getAttribute('class');
        expect(classes).toContain('border-dashed');
      }).toPass({ timeout: 3000 });
    }

    // リセットしてカウンターを0にする
    await page.request.post('/api/capture/reset');

    // 3秒待ってもパケットが0のまま
    await page.waitForTimeout(3000);
    const status = await (await page.request.get('/api/capture/status')).json();
    expect(status.stats.totalPackets).toBe(0);
  });

  test('存在しないインターフェースのアタッチはエラーを返す', async ({ page }) => {
    const res = await page.request.post('/api/interfaces/nonexistent/attach');
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  test('未アタッチのインターフェースのデタッチはエラーを返す', async ({ page }) => {
    // まず全NICをデタッチ
    const res = await page.request.get('/api/interfaces');
    const interfaces: string[] = await res.json();
    for (const name of interfaces) {
      await page.request.post(`/api/interfaces/${name}/detach`).catch(() => {});
    }

    // 既にデタッチ済みのeth0をデタッチしようとするとエラー
    const detachRes = await page.request.post('/api/interfaces/eth0/detach');
    expect(detachRes.status()).toBe(500);
    const body = await detachRes.json();
    expect(body.error).toContain('not attached');
  });
});
