/**
 * Visual Regression Suite — ATD QBO Platform
 *
 * Captures pixel-perfect snapshots of all 15 pages at 2 viewports (desktop + mobile).
 * Run: npx playwright test tests/e2e/visual.spec.js
 * Update baselines: npx playwright test tests/e2e/visual.spec.js --update-snapshots
 */
const { test, expect } = require('@playwright/test');
const { mockApiRoutes } = require('./fixtures/qbo-mocks');

// ---------------------------------------------------------------------------
// Page definitions: route + selector to wait for before snapshotting
// ---------------------------------------------------------------------------
const PAGES = [
  { route: '/', label: 'dashboard', waitFor: '.stat-card, .page-header' },
  { route: '/purchase-orders', label: 'purchase-orders', waitFor: 'text=Purchase Orders' },
  { route: '/orders', label: 'orders', waitFor: 'text=Orders' },
  { route: '/invoices', label: 'invoices', waitFor: 'text=Invoices' },
  { route: '/bills', label: 'bills', waitFor: 'text=Bills' },
  { route: '/payments', label: 'payments', waitFor: 'text=Payments' },
  { route: '/expenses', label: 'expenses', waitFor: 'text=Expenses' },
  { route: '/ai-chat', label: 'ai-chat', waitFor: 'text=AI Chat' },
  { route: '/qbo-connect', label: 'qbo-connect', waitFor: 'text=QBO Connect' },
  { route: '/settings', label: 'settings', waitFor: 'text=Settings' },
  { route: '/vendor-management', label: 'vendor-management', waitFor: 'text=Vendor Mapping' },
  { route: '/health', label: 'health', waitFor: 'text=System Health' },
  { route: '/activity-log', label: 'activity-log', waitFor: 'text=Activity Log' },
  { route: '/rules', label: 'rules', waitFor: 'text=Business Rules' },
  { route: '/help', label: 'help', waitFor: 'text=Help' },
];

test.describe('Visual Regression — All Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Seed mock API routes before any navigation
    await mockApiRoutes(page);
    // Seed auth in localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth', JSON.stringify({
        user: { email: 'test-user@atd.com', displayName: 'Test User' },
        token: 'mock-firebase-token-12345',
        expiresAt: Date.now() + 86_400_000,
      }));
    });
  });

  for (const pageDef of PAGES) {
    test(`visual snapshot — ${pageDef.label}`, async ({ page }) => {
      await page.goto(pageDef.route);
      // Wait for page-specific content to render
      await expect(page.locator(pageDef.waitFor).first()).toBeVisible({ timeout: 10_000 });
      // Wait for network idle so dynamic content settles
      await page.waitForLoadState('networkidle').catch(() => {});
      // Small delay for animations
      await page.waitForTimeout(300);

      // Take snapshot — masks are applied per-page for dynamic elements
      await expect(page).toHaveScreenshot(`${pageDef.label}.png`, {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
        caret: 'hide',
        mask: [page.locator('[data-testid="dynamic-timestamp"], .live-clock, .relative-time')],
      });
    });
  }
});
