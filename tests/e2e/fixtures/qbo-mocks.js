/**
 * QBO / API route mock helpers for Playwright E2E tests.
 * Intercepts all backend API calls and returns deterministic seed data.
 */
const seedData = require('./seed-data.json');

function ok(body) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: body }) };
}

function created(body) {
  return { status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: body }) };
}

/**
 * Set up all API route interceptions on a Playwright page.
 * Awaits every `page.route()` registration to avoid the first navigation
 * firing before CDP has installed the mock.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ partial?: Record<string, any> }} options - Override specific routes
 */
async function mockApiRoutes(page, options = {}) {
  const overrides = options.partial || {};

  await Promise.all([
    // --- Auth ---
    page.route('**/api/auth/status**', (route) => {
      if (overrides['auth/status']) return route.fulfill(overrides['auth/status']);
      route.fulfill(ok({
        connected: true,
        realmId: 'test-realm-123',
        tokenExpiry: new Date(Date.now() + 86_400_000).toISOString(),
        lastRefreshed: new Date().toISOString(),
      }));
    }),

    // --- Settings ---
    page.route('**/api/settings**', (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill(created({ ...overrides['settings_put'], updated: true }));
      }
      route.fulfill(ok({
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
      }));
    }),

    // --- Health ---
    page.route('**/api/health**', (route) => {
      if (overrides['health']) return route.fulfill(overrides['health']);
      route.fulfill(ok({
        status: 'healthy',
        services: {
          firestore: { status: 'connected', message: 'OK' },
          qbo: { status: 'configured', message: 'Sandbox' },
          ai: { status: 'connected', message: 'Cloud AI' },
          sheets: { status: 'configured', message: 'Sheet set' },
        },
        ai_mode: 'cloud',
      }));
    }),

    // --- Vendors ---
    // The PO page calls `api.getVendors()` and `api.getActiveVendors()`. Both
    // endpoints return `{ success: true, data: { vendors: [...] } }` in production
    // (see functions/api/vendor-routes.js + middleware.js), so the mocks must
    // mirror that shape — not a bare array — or loadLists() reads `.vendors` as
    // undefined and the PO page shows "Cannot load vendors".
    page.route('**/api/vendors**', (route) => route.fulfill(ok({ vendors: seedData.vendors }))),
    page.route('**/api/vendor/mappings/active**', (route) =>
      route.fulfill(ok({ vendors: seedData.vendors.filter((v) => v.active && v.visible) }))
    ),
    page.route('**/api/vendor/mappings/sync**', (route) =>
      route.fulfill(ok({ synced: true, count: seedData.vendors.length }))
    ),
    page.route('**/api/vendor/mappings**', (route) =>
      route.fulfill(ok({ vendors: seedData.vendors.filter((v) => v.active && v.visible) }))
    ),

    // --- Items / Catalog ---
    // Wrap in `{ items: [...] }` because loadLists() reads `iRes.items` / `iRes.data?.items`.
    page.route('**/api/items/catalog/active**', (route) => route.fulfill(ok({ items: seedData.items }))),
    page.route('**/api/items/catalog/sync**', (route) => route.fulfill(ok({ synced: true, count: seedData.items.length }))),
    page.route('**/api/items/catalog**', (route) => route.fulfill(ok({ items: seedData.items }))),
    page.route('**/api/items**', (route) => route.fulfill(ok({ items: seedData.items }))),

    // --- Purchase Orders ---
    // DraftsTab reads `res.drafts ?? res.data?.drafts`, so wrap the array.
    page.route('**/api/po/drafts/*/reject**', (route) =>
      route.fulfill(ok({ status: 'rejected', rejectReason: 'Test rejection', message: 'Draft rejected' }))
    ),
    page.route('**/api/po/drafts**', (route) =>
      route.fulfill(ok({ drafts: seedData.purchaseOrders.filter((p) => p.status === 'draft') }))
    ),
    page.route('**/api/po/history**', (route) =>
      route.fulfill(ok({ history: seedData.purchaseOrders, pos: seedData.purchaseOrders }))
    ),
    page.route('**/api/po/stats**', (route) =>
      route.fulfill(ok({
        draft: seedData.purchaseOrders.filter((p) => p.status === 'draft').length,
        pending_review: seedData.purchaseOrders.filter((p) => p.status === 'pending_review').length,
        approved: seedData.purchaseOrders.filter((p) => p.status === 'approved').length,
        rejected: seedData.purchaseOrders.filter((p) => p.status === 'rejected').length,
      }))
    ),
    page.route('**/api/po/create**', (route) =>
      route.fulfill(created({ id: `po-new-${Date.now()}`, status: 'draft', message: 'Draft saved successfully' }))
    ),
    page.route('**/api/po/approve/**', (route) =>
      route.fulfill(ok({ id: route.request().url().split('/').pop(), status: 'approved', qboPoNumber: 'QBO-PO-99', message: 'Approved and sent to QuickBooks' }))
    ),
    page.route('**/api/po/drafts/*/reject**', (route) =>
      route.fulfill(ok({ status: 'rejected', rejectReason: 'Test rejection', message: 'Draft rejected' }))
    ),

    // --- Bills ---
    // Single handler covers GET (list) and POST (create); /drafts glob comes first so it wins via LIFO.
    page.route('**/api/bills/drafts**', (route) => route.fulfill(ok([]))),
    page.route('**/api/bills**', (route) => {
      if (route.request().method() === 'POST') return route.fulfill(created({ id: `bill-new-${Date.now()}`, status: 'open' }));
      route.fulfill(ok(seedData.bills));
    }),
    page.route('**/api/bills/drafts/*/approve**', (route) =>
      route.fulfill(ok({ status: 'approved', qboBillId: 'QBO-BILL-99' }))
    ),

    // --- Invoices ---
    page.route('**/api/invoices**', (route) => {
      if (route.request().method() === 'POST') return route.fulfill(created({ id: `inv-new-${Date.now()}`, status: 'draft' }));
      route.fulfill(ok(seedData.invoices));
    }),
    page.route('**/api/invoices/drafts**', (route) => route.fulfill(ok([]))),
    page.route('**/api/customers**', (route) => route.fulfill(ok(seedData.customers))),
    page.route('**/api/open-invoices/**', (route) => route.fulfill(ok(seedData.invoices.filter((i) => i.balanceDue > 0)))),

    // --- Payments ---
    page.route('**/api/payments**', (route) => {
      if (route.request().method() === 'POST') return route.fulfill(created({ id: `pay-new-${Date.now()}`, status: 'completed' }));
      route.fulfill(ok(seedData.payments));
    }),
    page.route('**/api/payments/drafts**', (route) => route.fulfill(ok([]))),

    // --- Expenses ---
    page.route('**/api/expenses**', (route) => route.fulfill(ok(seedData.expenses))),
    page.route('**/api/expenses/uncategorized**', (route) =>
      route.fulfill(ok(seedData.expenses.filter((e) => e.status === 'uncategorized')))
    ),
    page.route('**/api/expenses/drafts**', (route) => route.fulfill(ok([]))),
    page.route('**/api/accounts**', (route) => route.fulfill(ok(seedData.accounts))),
    page.route('**/api/expenses/categorize**', (route) =>
      route.fulfill(ok({ categorized: true }))
    ),

    // --- Orders / Sheets ---
    // The Orders page expects `{ headers, rows }` where each row is keyed by header name.
    // We build that shape on the fly from the flat seed orders so both old tests (that
    // treat orders as an array) and new tests (that render the real Orders table) work.
    page.route('**/api/sheets/orders**', (route) => route.fulfill(ok({
      headers: ['Order #', 'Customer', 'Item Name', 'Qty', 'SKU', 'Status', 'Fulfillment'],
      rows: seedData.orders.map((o, i) => ({
        'Order #': o.orderNumber,
        'Customer': o.customer,
        'Item Name': o.lineItem,
        'Qty': String(o.quantity),
        'SKU': `SKU-${String(i + 1).padStart(3, '0')}`,
        'Status': o.status,
        'Fulfillment': o.fulfillmentSource,
      })),
      lastSyncedAt: new Date().toISOString(),
      source: 'live',
      cachedAtMs: Date.now(),
    }))),
    page.route('**/api/order-statuses**', (route) => route.fulfill(ok({
      statuses: Object.fromEntries(seedData.orders.map((o) => [`${o.orderNumber}`, o.status])),
    }))),
    page.route('**/api/order-statuses/**', (route) => route.fulfill(ok({ updated: true }))),
    page.route('**/api/order-fulfillment**', (route) => route.fulfill(ok({
      fulfillment: Object.fromEntries(seedData.orders.map((o) => [`${o.orderNumber}`, { source: o.fulfillmentSource }])),
    }))),
    page.route('**/api/order-fulfillment/**', (route) => route.fulfill(ok({ updated: true }))),

    // --- Google Sheets ---
    page.route('**/api/sheets/test-connection**', (route) => route.fulfill(ok({ connected: true }))),
    page.route('**/api/sheets/preview**', (route) => route.fulfill(ok({ headers: ['Order#', 'Customer', 'Item', 'Qty'], rows: [['ORD-001', 'ABC Co', 'Tile', '500']], totalRows: 3 }))),
    page.route('**/api/sheets/import**', (route) => route.fulfill(ok({ imported: 15, created: 10, updated: 5 }))),

    // --- AI Chat ---
    page.route('**/api/ai/chat**', (route) => {
      const body = route.request().postDataJSON();
      if (body?.test) return route.fulfill(ok({ response: 'OK', provider: 'cloud' }));
      route.fulfill(ok({
        response: `I understand you asked about "${body?.message || 'your request'}". This is a mock AI response for testing.`,
        suggestions: ['Create a PO for this order', 'Check vendor pricing', 'Review pending drafts'],
        provider: 'cloud',
      }));
    }),

    // --- Rules ---
    page.route('**/api/rules**', (route) => {
      if (route.request().method() === 'POST') return route.fulfill(created({ id: `rule-new-${Date.now()}`, active: true }));
      if (route.request().method() === 'PUT') return route.fulfill(ok({ updated: true }));
      if (route.request().method() === 'DELETE') return route.fulfill(ok({ deleted: true }));
      route.fulfill(ok(seedData.rules));
    }),

    // --- Activity Log ---
    page.route('**/api/activity-log**', (route) => route.fulfill(ok(seedData.activityLog))),

    // --- QBO Company Info ---
    page.route('**/api/qbo/company-info**', (route) =>
      route.fulfill(ok({
        CompanyInfo: { CompanyName: 'American Tile Depot (Test)', Industry: 'Building Materials', LegalAddr: { City: 'Los Angeles', Country: 'US' } },
      }))
    ),

    // --- PO Auto-create from sheets ---
    page.route('**/api/po/auto-create**', (route) =>
      route.fulfill(created({ id: `po-auto-${Date.now()}`, status: 'draft', itemsCreated: 3 }))
    ),
  ]);
}

module.exports = { mockApiRoutes, seedData };
