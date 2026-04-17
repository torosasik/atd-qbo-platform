# Testing Guide — ATD QBO Platform

This project uses a layered testing strategy:

| Layer | Tool | Location | Purpose |
|-------|------|----------|---------|
| Unit (frontend) | Vitest | [`frontend/src/**/*.test.js`](../frontend/src) | Pure logic, utils, components |
| Unit (functions) | Vitest | [`functions/api/__tests__`](../functions/api/__tests__) | Middleware, route handlers |
| E2E Flow | Playwright | [`tests/e2e/flows/`](../tests/e2e/flows) | User journeys with mocked APIs |
| Visual Regression | Playwright `toHaveScreenshot` | [`tests/e2e/visual.spec.js`](../tests/e2e/visual.spec.js) | Pixel diffs of all 15 pages × 2 viewports |
| Accessibility | `@axe-core/playwright` | [`tests/e2e/a11y.spec.js`](../tests/e2e/a11y.spec.js) | WCAG 2.1 AA scan |

---

## Quick commands

```bash
# Unit tests (frontend + functions)
npm test

# All E2E tests (flows + visual + a11y)
npx playwright test

# Just user-flow specs
npm run test:e2e:flows

# Visual regression (snapshot compare)
npm run test:e2e:visual

# Update snapshot baselines after intentional UI changes
npm run test:e2e:update

# Interactive debug UI
npm run test:e2e:ui

# Accessibility scan only
npx playwright test tests/e2e/a11y.spec.js
```

---

## Architecture

### Mocked API boundary

All Playwright specs use [`tests/e2e/fixtures/qbo-mocks.js`](../tests/e2e/fixtures/qbo-mocks.js) to intercept every backend call via `page.route()`. This means tests run **without** a live Firebase emulator or real QuickBooks connection — they are fast, deterministic, and offline-capable.

Seed data lives in [`tests/e2e/fixtures/seed-data.json`](../tests/e2e/fixtures/seed-data.json): 5 vendors, 10 items, 4 POs, 2 bills, 2 invoices, 2 payments, 2 expenses, 3 orders, 3 rules, 5 activity logs, 3 customers, 4 accounts.

### Mocked auth

[`tests/e2e/fixtures/auth.js`](../tests/e2e/fixtures/auth.js) injects a fake Firebase auth token into `localStorage` and stubs `/api/auth/status`. Every flow spec's `beforeEach` applies this seed before navigation.

### Viewports

`playwright.config.js` defines two projects:

- **`chromium-desktop`** — 1440×900
- **`chromium-mobile`** — iPhone 13 (390×844)

Visual specs run against both; flow specs run against desktop only unless they reference mobile nav.

---

## Visual regression workflow

### First run / new page

```bash
npx playwright test tests/e2e/visual.spec.js --update-snapshots
```

This generates baselines under `tests/e2e/visual.spec.js-snapshots/`. **Commit these to git.**

### Intentional UI changes

1. Make your code change.
2. Run `npm run test:e2e:visual` — it will fail with diff images.
3. Open the HTML report: `npx playwright show-report`.
4. Inspect the three-panel diff (expected / actual / diff).
5. If the change is intended: `npm run test:e2e:update` → commit new snapshots.
6. If unintended: fix the code until the diff disappears.

### Diff tolerance

`playwright.config.js` sets `maxDiffPixelRatio: 0.01` (1%) and `threshold: 0.2` to absorb font-rendering and sub-pixel antialiasing noise across environments. Tighten these for stricter checks.

### Flaky snapshots

Common causes and fixes:

- **Animations** — add `animations: 'disabled'` (already set globally).
- **Dates/timestamps** — mock `Date.now()` or use stable seed dates like `2026-04-15`.
- **Cursor blink** — `caret: 'hide'` (already set).
- **Loading spinners** — use `await page.waitForLoadState('networkidle')`.

---

## Writing a new flow spec

Template:

```js
const { test, expect } = require('@playwright/test');
const { mockApiRoutes } = require('../fixtures/qbo-mocks');

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth', JSON.stringify({
        user: { email: 'test-user@atd.com' },
        token: 'mock-firebase-token-12345',
        expiresAt: Date.now() + 86_400_000,
      }));
    });
  });

  test('does the thing', async ({ page }) => {
    await page.goto('/my-page');
    await expect(page.locator('text=My Heading')).toBeVisible();
  });
});
```

### Custom mock overrides

`mockApiRoutes(page, overrides)` accepts an `overrides` object to replace default responses for specific endpoints in a single test:

```js
await mockApiRoutes(page, {
  '/api/po': { success: false, error: 'Simulated failure' },
});
```

---

## CI

GitHub Actions workflow: [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml)

- Runs on push/PR to `main` and `develop`.
- Installs deps, runs unit tests, runs E2E flows (required), runs visual regression and a11y (non-blocking, `continue-on-error: true` initially).
- Uploads HTML report as `playwright-report` artifact (14 day retention).
- On failure, uploads `test-results/` with actual vs expected diffs.

To enforce visual regression as blocking in CI, remove `continue-on-error: true` from the "Run visual regression tests" step.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `baseURL` not defined | Check `playwright.config.js` `use.baseURL` — default `http://localhost:5002`. Override via `PLAYWRIGHT_BASE_URL` env. |
| Snapshots fail locally but pass in CI (or vice versa) | Font rendering differs per OS. Run CI snapshots locally via Docker, or keep CI as source of truth. |
| `@axe-core/playwright` not found | `npm install -D @axe-core/playwright` at repo root. |
| Tests time out on slow pages | Increase per-test timeout: `test.setTimeout(120_000)` or bump `playwright.config.js` `timeout`. |
| Mock not intercepting | `mockApiRoutes` must be called **before** `page.goto()`. Check ordering in `beforeEach`. |

---

## Coverage map

- **15 pages** snapshotted at 2 viewports = **30 visual baselines**.
- **10 flow specs** covering auth, navigation, PO, bills, invoices, payments, expenses, orders, vendors, rules, AI chat, settings, health, activity log, search.
- **15 a11y scans** (one per page).

Total expected Playwright test count: ~80–100 depending on sub-tests.
