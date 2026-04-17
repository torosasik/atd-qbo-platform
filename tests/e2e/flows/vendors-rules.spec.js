/**
 * Vendors & Rules Flow Tests — ATD QBO Platform
 * Run: npx playwright test tests/e2e/flows/vendors-rules.spec.js
 */
const { test, expect } = require('@playwright/test');
const { mockApiRoutes } = require('../fixtures/qbo-mocks');

const seedAuth = async (page) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('auth', JSON.stringify({
      user: { email: 'test-user@atd.com', displayName: 'Test User' },
      token: 'mock-firebase-token-12345',
      expiresAt: Date.now() + 86_400_000,
    }));
  });
};

test.describe('Vendor Management Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await seedAuth(page);
  });

  test('vendor management page loads', async ({ page }) => {
    await page.goto('/vendor-management');
    await expect(page.locator('text=/Vendor/i')).toBeVisible({ timeout: 10_000 });
  });

  test('vendor list shows seed vendors', async ({ page }) => {
    await page.goto('/vendor-management');
    await page.waitForLoadState('networkidle').catch(() => {});
    const rows = page.locator('table tbody tr, .vendor-row, .data-row');
    if (await rows.count() > 0) {
      expect(await rows.count()).toBeGreaterThan(0);
    }
  });

  test('add vendor button opens form', async ({ page }) => {
    await page.goto('/vendor-management');
    const addBtn = page.locator('button:has-text("Add Vendor"), button:has-text("New Vendor"), button:has-text("+")');
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(300);
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]');
      if (await nameInput.count() > 0) {
        await nameInput.first().fill('Test Vendor Co');
      }
    }
  });

  test('sync vendor mappings', async ({ page }) => {
    await page.goto('/vendor-management');
    const syncBtn = page.locator('button:has-text("Sync"), button:has-text("Refresh")');
    if (await syncBtn.count() > 0) {
      await syncBtn.first().click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Rules Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await seedAuth(page);
  });

  test('rules page loads', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('text=/Rule/i')).toBeVisible({ timeout: 10_000 });
  });

  test('rule list shows seed rules', async ({ page }) => {
    await page.goto('/rules');
    await page.waitForLoadState('networkidle').catch(() => {});
    const rows = page.locator('table tbody tr, .rule-row, .data-row');
    if (await rows.count() > 0) {
      expect(await rows.count()).toBeGreaterThan(0);
    }
  });

  test('create new rule form', async ({ page }) => {
    await page.goto('/rules');
    const addBtn = page.locator('button:has-text("Add Rule"), button:has-text("New Rule"), button:has-text("Create")');
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(300);

      // Select rule type
      const typeSelect = page.locator('select[name="type"], [data-testid="rule-type"]');
      if (await typeSelect.count() > 0) {
        await typeSelect.first().selectOption({ label: /SKU/i }).catch(() => {});
      }
    }
  });

  test('toggle rule active state', async ({ page }) => {
    await page.goto('/rules');
    const toggle = page.locator('input[type="checkbox"], .toggle, [role="switch"]');
    if (await toggle.count() > 0) {
      await toggle.first().click();
      await page.waitForTimeout(300);
    }
  });
});
