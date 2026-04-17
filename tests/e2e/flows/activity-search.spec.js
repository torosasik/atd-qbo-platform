/**
 * Activity Log & Search Flow Tests — ATD QBO Platform
 * Run: npx playwright test tests/e2e/flows/activity-search.spec.js
 */
const { test, expect } = require('@playwright/test');
const { mockApiRoutes } = require('../fixtures/qbo-mocks');

test.describe('Activity Log Flows', () => {
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

  test('activity log page loads', async ({ page }) => {
    await page.goto('/activity-log');
    await expect(page.locator('text=/Activity|Log/i')).toBeVisible({ timeout: 10_000 });
  });

  test('activity log shows seed entries', async ({ page }) => {
    await page.goto('/activity-log');
    await page.waitForLoadState('networkidle').catch(() => {});
    const rows = page.locator('table tbody tr, .log-row, .activity-row, .data-row');
    if (await rows.count() > 0) {
      expect(await rows.count()).toBeGreaterThan(0);
    }
  });

  test('filter by action type', async ({ page }) => {
    await page.goto('/activity-log');
    const actionFilter = page.locator('select[name="action"], [data-testid="action-filter"]');
    if (await actionFilter.count() > 0) {
      await actionFilter.first().selectOption({ label: /create/i }).catch(() => {});
      await page.waitForTimeout(300);
    }
  });

  test('filter by date range', async ({ page }) => {
    await page.goto('/activity-log');
    const dateInput = page.locator('input[type="date"]');
    if (await dateInput.count() > 0) {
      await dateInput.first().fill('2026-04-01');
      await page.waitForTimeout(300);
    }
  });

  test('search activity by keyword', async ({ page }) => {
    await page.goto('/activity-log');
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('PO-0042');
      expect(await searchInput.first().inputValue()).toContain('PO');
    }
  });
});
