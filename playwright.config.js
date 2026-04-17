// Playwright config for ATD QBO Platform E2E + Visual Regression tests.
// Run with: npm run test:e2e (requires Firebase emulators running on :5002).
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [
    '**/e2e-*.test.js',
    '**/visual.spec.js',
    '**/a11y.spec.js',
    '**/flows/*.spec.js',
  ],
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  fullyParallel: false,

  // Global expect configuration for visual snapshots
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  // All APIs are mocked via page.route(); we only need hosting to serve the built frontend.
  webServer: {
    command: 'firebase emulators:start --only hosting',
    url: 'http://127.0.0.1:5002',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5002',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
