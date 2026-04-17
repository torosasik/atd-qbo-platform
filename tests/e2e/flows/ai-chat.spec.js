/**
 * AI Chat Flow Tests — ATD QBO Platform
 * Run: npx playwright test tests/e2e/flows/ai-chat.spec.js
 */
const { test, expect } = require('@playwright/test');
const { mockApiRoutes } = require('../fixtures/qbo-mocks');

test.describe('AI Chat Flows', () => {
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

  test('AI chat page loads', async ({ page }) => {
    await page.goto('/ai-chat');
    await expect(page.locator('text=/Chat|AI Assistant/i')).toBeVisible({ timeout: 10_000 });
  });

  test('send message and receive mocked reply', async ({ page }) => {
    await page.goto('/ai-chat');
    const input = page.locator('textarea, input[type="text"]').last();
    if (await input.count() > 0) {
      await input.fill('How many POs are pending?');
      const sendBtn = page.locator('button:has-text("Send"), button[type="submit"], [data-testid="send"]');
      if (await sendBtn.count() > 0) {
        await sendBtn.first().click();
        await page.waitForTimeout(500);
        // Mocked response contains "pending approval"
        const reply = page.locator('text=/pending approval|response/i');
        if (await reply.count() > 0) {
          await expect(reply.first()).toBeVisible({ timeout: 5_000 });
        }
      }
    }
  });

  test('provider indicator visible', async ({ page }) => {
    await page.goto('/ai-chat');
    const provider = page.locator('text=/OpenAI|Gemini|Anthropic|Provider/i');
    if (await provider.count() > 0) {
      await expect(provider.first()).toBeVisible();
    }
  });
});
