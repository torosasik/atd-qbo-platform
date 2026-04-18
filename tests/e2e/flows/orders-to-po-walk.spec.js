/**
 * Visual user-walk: Orders page → select an order → Create PO (manual) →
 * Purchase Orders page with prefilled line item.
 *
 * This is the "real user" verification requested by the product owner — not a
 * locator smoke test. Each step asserts visible content and saves a screenshot
 * under `DO NOT UPLOAD - SCREENSHOTS/ui-walk-<timestamp>/`.
 *
 * Run: npx playwright test tests/e2e/flows/orders-to-po-walk.spec.js --headed --project=chromium-desktop
 */
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const { mockApiRoutes } = require('../fixtures/qbo-mocks');

const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const SHOT_DIR = path.join('DO NOT UPLOAD - SCREENSHOTS', `ui-walk-${STAMP}`);
fs.mkdirSync(SHOT_DIR, { recursive: true });

test.describe('Orders → Create PO user walk', () => {
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

  test('user sees 3 seed orders, selects one, creates a PO draft, lands on prefilled PO form', async ({ page }) => {
    // 1. Navigate to Orders
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: /^Orders/ })).toBeVisible({ timeout: 15_000 });

    // Wait for the loading state to clear — the row count tells us data is in.
    await page.waitForFunction(
      () => document.querySelectorAll('table tbody tr').length >= 3,
      null,
      { timeout: 15_000 }
    );

    // 2. Count rows. Seed has 3 orders.
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // Each seed order number should be visible on screen.
    await expect(page.getByText('ORD-2026-001')).toBeVisible();
    await expect(page.getByText('ORD-2026-002')).toBeVisible();
    await expect(page.getByText('ORD-2026-003')).toBeVisible();

    await page.screenshot({ path: path.join(SHOT_DIR, '01-orders-list.png'), fullPage: true });

    // 3. Check the first row's checkbox (skip the header checkbox at index 0).
    const rowCheckboxes = page.locator('table tbody tr input[type="checkbox"]');
    await rowCheckboxes.first().check();

    // 4. The "N selected" pill + Create PO dropdown button should appear.
    await expect(page.getByText(/^\d+ selected$/)).toBeVisible({ timeout: 5_000 });
    const createPoBtn = page.getByRole('button', { name: /^Create PO/i });
    await expect(createPoBtn.first()).toBeVisible();

    await page.screenshot({ path: path.join(SHOT_DIR, '02-order-selected.png'), fullPage: true });

    // 5. Open the Create PO dropdown and pick the manual option.
    await createPoBtn.first().click();
    // Manual is labelled "Create Manually" or similar — use any option with "Manual".
    const manualOption = page.getByRole('button', { name: /Manual/i }).first();
    await expect(manualOption).toBeVisible({ timeout: 3_000 });
    await manualOption.click();

    // 6. Receipt modal appears with the selected order number.
    //    The order number shows in both the underlying table row and the modal;
    //    strict mode fails with two matches, so we use .first() or a modal-scoped locator.
    await expect(page.getByRole('button', { name: /Continue to Edit/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/#?ORD-2026-001/).first()).toBeVisible();

    await page.screenshot({ path: path.join(SHOT_DIR, '03-receipt-modal.png'), fullPage: true });

    // 7. Continue → navigates to /purchase-orders with prefilled rows.
    await page.getByRole('button', { name: /Continue to Edit/i }).click();

    await expect(page).toHaveURL(/\/purchase-orders/);
    await expect(page.getByRole('heading', { name: /^Purchase Orders/ })).toBeVisible({ timeout: 10_000 });

    // 8. The Create New tab should be active with line items prefilled.
    //    `innerText` doesn't include `<input value=...>`, so we read the form
    //    inputs directly + the Grand Total that's derived from them.
    await page.waitForTimeout(1_200); // let prefill effect complete after vendors + items load

    // Read every input/textarea/select value on the page so we can assert on
    // form contents regardless of specific label selectors.
    const allFieldValues = await page.locator('input, textarea, select').evaluateAll((nodes) =>
      nodes.map((n) => n.value).filter(Boolean)
    );
    const valuesJoined = allFieldValues.join(' | ');

    // Memo should reference the order number (auto-populated from prefill).
    expect(valuesJoined).toMatch(/ORD-2026-001/);

    // The line item's item name is copied from the order row.
    expect(valuesJoined).toMatch(/Porcelain Tile 12x24 White/);

    // Qty=500 is prefilled from the order row.
    expect(valuesJoined).toMatch(/\b500\b/);

    // Qty=500 × $2.50 = $1,250.00 — derived from the prefilled qty + unit price.
    // This is the strongest visible proof that the full prefill path worked.
    await expect(page.getByText(/Grand Total:\s*\$1,250\.00/)).toBeVisible({ timeout: 3_000 });

    await page.screenshot({ path: path.join(SHOT_DIR, '04-po-form-prefilled.png'), fullPage: true });

    console.log(`\n📸 Screenshots saved to ${SHOT_DIR}/`);
  });
});
