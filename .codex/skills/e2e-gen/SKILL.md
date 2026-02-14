---
name: e2e-gen
description: Verify UI behavior and generate Playwright E2E tests for Scrop. Use when the user asks to add or update E2E specs, reproduce browser regressions, validate user flows, or improve flaky Playwright tests.
---

# E2E Gen

## Goal

Create stable Playwright tests based on concrete user flows and observable UI results.

## Workflow

1. Inspect current E2E context.
- Check existing specs with `ls e2e/*.spec.ts`.
- Read `playwright.config.ts`.
- Confirm whether to append to an existing file or create a new one.

2. Ensure a mock server is available.
- Probe `curl -s http://localhost:3000/api/capture/status`.
- If unavailable, run `npm run build` (if needed) and start `cargo run -p scrop-server --no-default-features`.
- If `:3000` is occupied by non-mock mode, start mock on `:3001` using `cargo run -p scrop-server --no-default-features -- --port 3001`.
- Poll until status endpoint responds, then use that port consistently.

3. Define target scenarios before coding tests.
- Convert user intent into specific actions and expected outcomes.
- Capture edge cases and failure signals.

4. Implement tests with stable selectors and waits.
- Prefer `getByTestId`.
- Add missing `data-testid` in frontend code before finalizing tests.
- Prefer `expect(...).toBeVisible()`, `toHaveText`, `toHaveCount`, `waitForSelector`, and `toPass`.
- Avoid `waitForTimeout` unless there is no deterministic signal.
- For scroll behavior, use `page.mouse.wheel(0, dy)` to mimic real user input.

5. Run and stabilize tests.
- Run target spec first: `npx playwright test e2e/<file>.spec.ts`.
- Fix selector, timing, and assertion issues until green.
- Re-run broader suite when shared code is changed.

6. Clean up processes and report.
- Stop only processes started during this run.
- Report changed files and executed verification commands.

## Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('機能名', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="capture-toggle"]');
  });

  test('シナリオ名', async ({ page }) => {
    await page.getByTestId('element-id').click();
    await expect(page.getByTestId('result')).toBeVisible();
  });
});
```

## Guardrails

- Keep tests deterministic and assertion-driven.
- Add selectors in app code when required for robust automation.
- Keep each test focused on one user scenario.
