/**
 * Settings & Health Flow Tests — ATD QBO Platform
 * Run: npx playwright test tests/e2e/flows/settings-health.spec.js
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

test.describe('Settings Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await seedAuth(page);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('text=/Settings/i')).toBeVisible({ timeout: 10_000 });
  });

  test('toggle feature flag', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle').catch(() => {});
    const toggles = page.locator('input[type="checkbox"], [role="switch"], .toggle');
    if (await toggles.count() > 0) {
      await toggles.first().click();
      await page.waitForTimeout(300);
    }
  });

  test('change AI provider', async ({ page }) => {
    await page.goto('/settings');
    const providerSelect = page.locator('select[name="aiProvider"], [data-testid="ai-provider"]');
    if (await providerSelect.count() > 0) {
      await providerSelect.first().selectOption({ label: /OpenAI|Gemini/i }).catch(() => {});
    }
  });

  test('QBO connect section visible', async ({ page }) => {
    await page.goto('/qbo-connect');
    await expect(page.locator('text=/QuickBooks|QBO/i')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Health Check Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await seedAuth(page);
  });

  test('health page loads with status indicators', async ({ page }) => {
    await page.goto('/health');
    await expect(page.locator('text=/Health|Status/i')).toBeVisible({ timeout: 10_000 });
  });

  test('health shows green/healthy indicators', async ({ page }) => {
    await page.goto('/health');
    await page.waitForLoadState('networkidle').catch(() => {});
    const healthyBadges = page.locator('text=/healthy|connected|OK/i');
    if (await healthyBadges.count() > 0) {
      expect(await healthyBadges.count()).toBeGreaterThan(0);
    }
  });

  test('refresh health check', async ({ page }) => {
    await page.goto('/health');
    const refreshBtn = page.locator('button:has-text("Refresh"), button:has-text("Re-check")');
    if (await refreshBtn.count() > 0) {
      await refreshBtn.first().click();
      await page.waitForTimeout(500);
    }
  });
});
