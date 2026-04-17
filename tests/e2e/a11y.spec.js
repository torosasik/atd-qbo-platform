/**
 * Accessibility Scan — ATD QBO Platform
 * Uses @axe-core/playwright to scan all major pages.
 * Fails on serious or critical violations.
 *
 * Run: npx playwright test tests/e2e/a11y.spec.js
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { mockApiRoutes } = require('./fixtures/qbo-mocks');

const PAGES = [
  { name: 'Dashboard', path: '/' },
  { name: 'Orders', path: '/orders' },
  { name: 'Purchase Orders', path: '/purchase-orders' },
  { name: 'Invoices', path: '/invoices' },
  { name: 'Bills', path: '/bills' },
  { name: 'Payments', path: '/payments' },
  { name: 'Expenses', path: '/expenses' },
  { name: 'AI Chat', path: '/ai-chat' },
  { name: 'QBO Connect', path: '/qbo-connect' },
  { name: 'Settings', path: '/settings' },
  { name: 'Vendor Management', path: '/vendor-management' },
  { name: 'Health Check', path: '/health' },
  { name: 'Activity Log', path: '/activity-log' },
  { name: 'Rules', path: '/rules' },
  { name: 'Help', path: '/help' },
];

test.describe('Accessibility scan (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth', JSON.stringify({
        user: { email: 'test-user@atd.com', displayName: 'Test User' },
        token: 'mock-firebase-token-12345',
        expiresAt: Date.now() + 86_400_000,
      }));
    });
  });

  for (const { name, path } of PAGES) {
    test(`a11y: ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const serious = results.violations.filter((v) =>
        v.impact === 'serious' || v.impact === 'critical'
      );

      if (serious.length > 0) {
        console.log(`\n❌ A11y violations on ${name}:`);
        serious.forEach((v) => {
          console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
          console.log(`    ${v.helpUrl}`);
          console.log(`    Nodes: ${v.nodes.length}`);
        });
      }

      expect(serious, `Serious/critical a11y issues on ${name}`).toEqual([]);
    });
  }
});
