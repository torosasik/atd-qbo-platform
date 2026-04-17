/**
 * Auth fixture for Playwright E2E tests.
 * Seeds a mock Firebase auth session so pages render as authenticated.
 */
const { test as base } = require('@playwright/test');
const seedData = require('./seed-data.json');

// ---------------------------------------------------------------------------
// Mock auth payload — mimics what /api/auth/status returns when connected
// ---------------------------------------------------------------------------
const MOCK_AUTH_STATUS = {
  success: true,
  data: {
    connected: true,
    realmId: 'test-realm-123',
    tokenExpiry: new Date(Date.now() + 86_400_000).toISOString(),
    lastRefreshed: new Date().toISOString(),
  },
};

const MOCK_SETTINGS = {
  success: true,
  data: {
    po_sheet_id: 'test-sheet-id',
    ai_provider: 'cloud',
    modules: {
      purchase_orders: { enabled: true },
      bills: { enabled: true },
      invoices: { enabled: true },
      payments: { enabled: true },
      expenses: { enabled: true },
      vendor_management: { enabled: true },
      sheets_import: { enabled: true },
      ai_chat: { enabled: true },
    },
  },
};

// ---------------------------------------------------------------------------
// Custom fixture
// ---------------------------------------------------------------------------
const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Intercept auth status to return "connected"
    await page.route('**/api/auth/status', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_AUTH_STATUS) });
    });

    // Intercept settings
    await page.route('**/api/settings', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SETTINGS) });
    });

    // Seed auth token in localStorage before navigation
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'auth',
        JSON.stringify({
          user: { email: 'test-user@atd.com', displayName: 'Test User' },
          token: 'mock-firebase-token-12345',
          expiresAt: Date.now() + 86_400_000,
        })
      );
    });

    await use(page);

    // Cleanup routes
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  },
});

module.exports = { test, seedData };
