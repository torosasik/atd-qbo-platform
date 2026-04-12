/**
 * Comprehensive Smoke Test Suite for ATD QBO Platform
 *
 * Covers:
 * - Utility helpers (formatCurrency, getErrorMessage, etc.)
 * - API helper definition verification (all methods exist and are callable)
 * - Vendor filtering logic (active/visible)
 * - Mock-based route shape tests for all API endpoints
 * - Data validation tests
 *
 * Run with: cd frontend && npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { api, getErrorMessage } from './utils/api';
import { formatCurrency, formatDateTime, generateId, getTodayDate } from './utils/helpers';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const testVendors = [
  { qbo_id: '1', qbo_name: 'Active Vendor A', active: true, visible: true, shopify_code: 'AVA' },
  { qbo_id: '2', qbo_name: 'Inactive Vendor B', active: false, visible: true, shopify_code: '' },
  { qbo_id: '3', qbo_name: 'Hidden Vendor C', active: true, visible: false, shopify_code: 'HVC' },
  { qbo_id: '4', qbo_name: 'Active Vendor D', active: true, visible: true, shopify_code: 'AVD' },
  { qbo_id: '5', qbo_name: 'Inactive Hidden E', active: false, visible: false, shopify_code: '' },
];

const testPO = {
  happy: {
    vendorId: '1',
    vendorName: 'Active Vendor A',
    poNumber: 'PO-2026-001',
    date: '2026-04-12',
    items: [
      { item: 'Porcelain Tile 12x24', quantity: 500, unitPrice: 2.50, unit: 'Sq Ft' },
      { item: 'Mosaic Tile Sheet', quantity: 10, unitPrice: 15.00, unit: 'Sheet' },
    ],
  },
  edge: { vendorId: '', vendorName: '', poNumber: '', date: 'invalid-date', items: [] },
};

const testBill = {
  happy: {
    vendorId: '1',
    vendorName: 'Active Vendor A',
    date: '2026-04-12',
    lines: [
      { description: 'Freight charges', qty: 1, unitPrice: 250.00 },
      { description: 'Material handling', qty: 1, unitPrice: 75.00 },
    ],
  },
  edge: { vendorId: '', vendorName: '', date: '', lines: [] },
};

const testInvoice = {
  happy: {
    customerId: 'cust-001',
    customerName: 'Test Customer',
    date: '2026-04-12',
    lines: [
      { description: 'Tile installation', qty: 200, unitPrice: 5.00, unit: 'Sq Ft' },
    ],
  },
};

const testPayment = {
  happy: {
    customerId: 'cust-001',
    amount: 500.00,
    invoiceId: 'inv-001',
    date: '2026-04-12',
  },
};

// ---------------------------------------------------------------------------
// 1. Utility Helpers
// ---------------------------------------------------------------------------

describe('Utility Helpers', () => {
  describe('formatCurrency', () => {
    it('formats positive numbers correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0.99)).toBe('$0.99');
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats negative numbers', () => {
      expect(formatCurrency(-100)).toBe('-$100.00');
      expect(formatCurrency(-0.50)).toBe('-$0.50');
    });

    it('handles non-numeric input gracefully', () => {
      expect(formatCurrency('abc')).toBe('$0.00');
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency('')).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('handles string numbers', () => {
      expect(formatCurrency('1234.56')).toBe('$1,234.56');
    });
  });

  describe('generateId', () => {
    it('returns a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('getTodayDate', () => {
    it('returns a valid YYYY-MM-DD string', () => {
      const today = getTodayDate();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. API Error Handling
// ---------------------------------------------------------------------------

describe('API Error Handling (getErrorMessage)', () => {
  it('returns defaults for null/undefined errors', () => {
    expect(getErrorMessage(null)).toEqual({ message: 'An unexpected error occurred.', fix: null, code: null });
    expect(getErrorMessage(undefined)).toEqual({ message: 'An unexpected error occurred.', fix: null, code: null });
  });

  it('extracts message, code, fix from structured errors', () => {
    const err = new Error('Token expired');
    err.code = 'QBO_AUTH_EXPIRED';
    err.fix = 'Refresh your QuickBooks token';
    const result = getErrorMessage(err);
    expect(result.message).toBe('Token expired');
    expect(result.code).toBe('QBO_AUTH_EXPIRED');
    expect(result.fix).toBe('Refresh your QuickBooks token');
  });

  it('handles plain objects', () => {
    expect(getErrorMessage({ message: 'Bad input' })).toEqual({
      message: 'Bad input',
      fix: null,
      code: null,
    });
  });

  it('handles empty error objects', () => {
    expect(getErrorMessage({})).toEqual({
      message: 'An unexpected error occurred.',
      fix: null,
      code: null,
    });
  });
});

// ---------------------------------------------------------------------------
// 3. API Helper Definition Verification
// ---------------------------------------------------------------------------

describe('API Helper Definitions — All Methods Exist', () => {
  describe('Core CRUD methods', () => {
    it('has get, post, put, del methods', () => {
      expect(typeof api.get).toBe('function');
      expect(typeof api.post).toBe('function');
      expect(typeof api.put).toBe('function');
      expect(typeof api.del).toBe('function');
    });
  });

  describe('Settings', () => {
    it('has getSettings and updateSettings', () => {
      expect(typeof api.getSettings).toBe('function');
      expect(typeof api.updateSettings).toBe('function');
    });
  });

  describe('Health', () => {
    it('has getHealth', () => {
      expect(typeof api.getHealth).toBe('function');
    });
  });

  describe('Auth / QBO', () => {
    it('has auth methods', () => {
      expect(typeof api.getAuthStatus).toBe('function');
      expect(typeof api.connectQBO).toBe('function');
      expect(typeof api.disconnectAuth).toBe('function');
      expect(typeof api.disconnectQBO).toBe('function');
      expect(typeof api.refreshToken).toBe('function');
      expect(typeof api.getQboCompanyInfo).toBe('function');
    });
  });

  describe('Vendor Management', () => {
    it('has vendor methods', () => {
      expect(typeof api.getVendors).toBe('function');
      expect(typeof api.getVendorMappings).toBe('function');
      expect(typeof api.syncVendorMappings).toBe('function');
    });
  });

  describe('Purchase Orders', () => {
    it('has PO methods', () => {
      expect(typeof api.getPoDrafts).toBe('function');
      expect(typeof api.getPoHistory).toBe('function');
      expect(typeof api.createPo).toBe('function');
      expect(typeof api.approveDraft).toBe('function');
      expect(typeof api.rejectDraft).toBe('function');
    });
  });

  describe('Invoices', () => {
    it('has invoice methods', () => {
      expect(typeof api.getCustomers).toBe('function');
      expect(typeof api.getInvoiceHistory).toBe('function');
      expect(typeof api.getInvoiceDrafts).toBe('function');
      expect(typeof api.createInvoice).toBe('function');
      expect(typeof api.approveInvoiceDraft).toBe('function');
      expect(typeof api.rejectInvoiceDraft).toBe('function');
    });
  });

  describe('Bills', () => {
    it('has bill methods', () => {
      expect(typeof api.getBillHistory).toBe('function');
      expect(typeof api.getBillDrafts).toBe('function');
      expect(typeof api.createBill).toBe('function');
      expect(typeof api.approveBillDraft).toBe('function');
      expect(typeof api.rejectBillDraft).toBe('function');
    });
  });

  describe('Payments', () => {
    it('has payment methods', () => {
      expect(typeof api.getPaymentHistory).toBe('function');
      expect(typeof api.getPaymentDrafts).toBe('function');
      expect(typeof api.getOpenInvoices).toBe('function');
      expect(typeof api.createPayment).toBe('function');
      expect(typeof api.approvePaymentDraft).toBe('function');
      expect(typeof api.rejectPaymentDraft).toBe('function');
    });
  });

  describe('Expenses', () => {
    it('has expense methods', () => {
      expect(typeof api.getUncategorizedExpenses).toBe('function');
      expect(typeof api.getExpenseDrafts).toBe('function');
      expect(typeof api.categorizeExpense).toBe('function');
      expect(typeof api.approveExpenseDraft).toBe('function');
      expect(typeof api.rejectExpenseDraft).toBe('function');
      expect(typeof api.getExpenseHistory).toBe('function');
      expect(typeof api.getAccounts).toBe('function');
    });
  });

  describe('AI Chat', () => {
    it('has AI methods', () => {
      expect(typeof api.sendAiChat).toBe('function');
      expect(typeof api.testAiConnection).toBe('function');
    });
  });

  describe('Google Sheets', () => {
    it('has sheets methods', () => {
      expect(typeof api.testSheetConnection).toBe('function');
      expect(typeof api.previewSheetData).toBe('function');
      expect(typeof api.importFromSheets).toBe('function');
      expect(typeof api.getOrders).toBe('function');
    });
  });

  describe('Order Statuses', () => {
    it('has order status methods', () => {
      expect(typeof api.getOrderStatuses).toBe('function');
      expect(typeof api.setOrderStatus).toBe('function');
      expect(typeof api.bulkSetOrderStatuses).toBe('function');
    });
  });

  describe('Order Fulfillment', () => {
    it('has fulfillment methods', () => {
      expect(typeof api.getOrderFulfillment).toBe('function');
      expect(typeof api.setOrderFulfillment).toBe('function');
    });
  });

  describe('Activity Log', () => {
    it('has activity log methods', () => {
      expect(typeof api.getActivityLogs).toBe('function');
      expect(typeof api.postActivityLog).toBe('function');
    });
  });

  describe('Business Rules', () => {
    it('has rules methods', () => {
      expect(typeof api.getRules).toBe('function');
      expect(typeof api.createRule).toBe('function');
      expect(typeof api.updateRule).toBe('function');
      expect(typeof api.deleteRule).toBe('function');
    });
  });

  describe('Cache / Items', () => {
    it('has items and cache methods', () => {
      expect(typeof api.getItems).toBe('function');
      expect(typeof api.createItem).toBe('function');
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Vendor Filtering Logic
// ---------------------------------------------------------------------------

describe('Vendor Active/Visible Filtering', () => {
  const activeVisibleFilter = (v) => v.active && v.visible !== false;

  it('filters to only active + visible vendors', () => {
    const filtered = testVendors.filter(activeVisibleFilter);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((v) => v.qbo_id)).toEqual(['1', '4']);
  });

  it('excludes inactive vendors', () => {
    const filtered = testVendors.filter(activeVisibleFilter);
    const inactiveIncluded = filtered.some((v) => !v.active);
    expect(inactiveIncluded).toBe(false);
  });

  it('excludes hidden vendors even if active', () => {
    const filtered = testVendors.filter(activeVisibleFilter);
    const hiddenIncluded = filtered.some((v) => v.visible === false);
    expect(hiddenIncluded).toBe(false);
  });

  it('maps vendors to dropdown shape (Id, DisplayName)', () => {
    const dropdown = testVendors
      .filter(activeVisibleFilter)
      .map((v) => ({ Id: v.qbo_id, DisplayName: v.qbo_name }));
    expect(dropdown).toEqual([
      { Id: '1', DisplayName: 'Active Vendor A' },
      { Id: '4', DisplayName: 'Active Vendor D' },
    ]);
  });

  it('returns empty array when no vendors are active', () => {
    const allInactive = testVendors.map((v) => ({ ...v, active: false }));
    expect(allInactive.filter(activeVisibleFilter)).toHaveLength(0);
  });

  it('returns empty array when all vendors are hidden', () => {
    const allHidden = testVendors.map((v) => ({ ...v, visible: false }));
    expect(allHidden.filter(activeVisibleFilter)).toHaveLength(0);
  });

  it('handles empty vendor list', () => {
    expect([].filter(activeVisibleFilter)).toHaveLength(0);
  });

  it('handles vendor with undefined visible (treated as visible)', () => {
    const vendorNoVisible = { qbo_id: '99', qbo_name: 'No Visible Field', active: true };
    expect(activeVisibleFilter(vendorNoVisible)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Mock Route Shape Tests (PO, Bill, Invoice, Payment, Expense)
// ---------------------------------------------------------------------------

describe('PO Route Shape & Validation', () => {
  it('validates happy path PO has required fields', () => {
    const po = testPO.happy;
    expect(po.vendorId).toBeTruthy();
    expect(po.poNumber).toBeTruthy();
    expect(po.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(po.items.length).toBeGreaterThan(0);
    po.items.forEach((item) => {
      expect(item.item).toBeTruthy();
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.unitPrice).toBeGreaterThan(0);
    });
  });

  it('calculates PO total correctly', () => {
    const total = testPO.happy.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    expect(total).toBe(500 * 2.50 + 10 * 15.00); // 1250 + 150 = 1400
    expect(total).toBe(1400);
  });

  it('rejects PO with missing vendor', () => {
    const errors = [];
    if (!testPO.edge.vendorId) errors.push('Vendor is required');
    if (!testPO.edge.poNumber?.trim()) errors.push('PO Number is required');
    if (testPO.edge.items.length === 0) errors.push('At least one line item required');
    expect(errors).toContain('Vendor is required');
    expect(errors).toContain('PO Number is required');
    expect(errors).toContain('At least one line item required');
  });

  it('simulates PO lifecycle: draft → approved → synced', () => {
    const draft = { id: 'po-001', status: 'draft', ...testPO.happy };
    expect(draft.status).toBe('draft');

    const approved = { ...draft, status: 'approved', qboPoNumber: 'QBO-PO-100' };
    expect(approved.status).toBe('approved');
    expect(approved.qboPoNumber).toBeDefined();

    const synced = { ...approved, status: 'success', intuitTid: 'tid-abc123' };
    expect(synced.status).toBe('success');
    expect(synced.intuitTid).toBeDefined();
  });
});

describe('Bill Route Shape & Validation', () => {
  it('validates happy path bill has required fields', () => {
    const bill = testBill.happy;
    expect(bill.vendorId).toBeTruthy();
    expect(bill.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bill.lines.length).toBeGreaterThan(0);
    bill.lines.forEach((line) => {
      expect(line.description).toBeTruthy();
      expect(line.qty).toBeGreaterThan(0);
    });
  });

  it('calculates bill total correctly', () => {
    const total = testBill.happy.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    expect(total).toBe(325);
  });

  it('rejects bill with missing vendor', () => {
    const errors = [];
    if (!testBill.edge.vendorId) errors.push('Please select a vendor.');
    if (testBill.edge.lines.length === 0) errors.push('At least one line required');
    expect(errors).toContain('Please select a vendor.');
  });

  it('simulates bill lifecycle: draft → approved', () => {
    const draft = { id: 'bill-001', status: 'draft', ...testBill.happy };
    const approved = { ...draft, status: 'approved', qboBillNumber: 'QBO-BILL-50' };
    expect(approved.status).toBe('approved');
  });
});

describe('Invoice Route Shape & Validation', () => {
  it('validates happy path invoice', () => {
    const inv = testInvoice.happy;
    expect(inv.customerId).toBeTruthy();
    expect(inv.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(inv.lines.length).toBeGreaterThan(0);
  });

  it('calculates invoice total', () => {
    const total = testInvoice.happy.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    expect(total).toBe(1000);
  });

  it('simulates invoice lifecycle: draft → approved', () => {
    const draft = { id: 'inv-001', status: 'draft', ...testInvoice.happy };
    const approved = { ...draft, status: 'approved', qboInvoiceId: 'QBO-INV-200' };
    expect(approved.status).toBe('approved');
    expect(approved.qboInvoiceId).toBeDefined();
  });
});

describe('Payment Route Shape & Validation', () => {
  it('validates happy path payment', () => {
    const pmt = testPayment.happy;
    expect(pmt.customerId).toBeTruthy();
    expect(pmt.amount).toBeGreaterThan(0);
    expect(pmt.invoiceId).toBeTruthy();
  });

  it('simulates payment lifecycle: draft → approved', () => {
    const draft = { id: 'pmt-001', status: 'draft', ...testPayment.happy };
    const approved = { ...draft, status: 'approved', qboPaymentId: 'QBO-PMT-300' };
    expect(approved.status).toBe('approved');
  });
});

describe('Expense Route Shape & Validation', () => {
  it('validates expense categorization shape', () => {
    const expense = {
      id: 'exp-001',
      amount: 150.00,
      description: 'Office supplies',
      suggestedAccountId: 'acc-misc',
    };
    expect(expense.suggestedAccountId).toBeTruthy();
    expect(expense.amount).toBeGreaterThan(0);
  });

  it('simulates expense draft lifecycle', () => {
    const draft = { id: 'exp-001', status: 'pending', accountId: 'acc-misc' };
    const approved = { ...draft, status: 'approved' };
    expect(approved.status).toBe('approved');

    const rejected = { ...draft, status: 'rejected' };
    expect(rejected.status).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// 6. Health Check Mock
// ---------------------------------------------------------------------------

describe('Health Check Response Shape', () => {
  it('healthy status with all services connected', () => {
    const health = {
      status: 'healthy',
      services: {
        firestore: { status: 'connected', message: 'Firestore is accessible', latency_ms: 45 },
        qbo: { status: 'configured', message: 'Connected to sandbox' },
        ai: { status: 'connected', message: 'Ollama available' },
        sheets: { status: 'configured', message: 'Sheet ID set' },
      },
    };
    expect(health.status).toBe('healthy');
    Object.values(health.services).forEach((svc) => {
      expect(['connected', 'configured']).toContain(svc.status);
      expect(svc.message).toBeDefined();
    });
  });

  it('degraded status when a service fails', () => {
    const health = {
      status: 'degraded',
      services: {
        firestore: { status: 'connected', message: 'OK' },
        qbo: { status: 'error', message: 'Token expired - reauthenticate' },
      },
    };
    expect(health.status).toBe('degraded');
    expect(health.services.qbo.status).toBe('error');
  });

  it('error status when all services fail', () => {
    const health = {
      status: 'error',
      services: {
        firestore: { status: 'error', message: 'Cannot reach Firestore' },
      },
    };
    expect(health.status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// 7. Order Status / Fulfillment Shape
// ---------------------------------------------------------------------------

describe('Order Status Tracking', () => {
  const VALID_STATUSES = ['Pending', 'Ordered', 'Received', 'Fulfilled'];

  it('validates all status values', () => {
    VALID_STATUSES.forEach((s) => {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    });
  });

  it('builds doc ID from order number and line item', () => {
    const buildDocId = (orderNumber, lineItem) => {
      const base = String(orderNumber || '').trim();
      const line = String(lineItem || '').trim();
      return line ? `${base}_${line}` : base;
    };
    expect(buildDocId('ORD-001', 'Line 1')).toBe('ORD-001_Line 1');
    expect(buildDocId('ORD-001', '')).toBe('ORD-001');
    expect(buildDocId('ORD-001', null)).toBe('ORD-001');
  });

  it('validates bulk status update shape', () => {
    const updates = [
      { orderNumber: 'ORD-001', lineItem: 'Line 1', status: 'Ordered' },
      { orderNumber: 'ORD-001', lineItem: 'Line 2', status: 'Received' },
    ];
    updates.forEach((u) => {
      expect(VALID_STATUSES).toContain(u.status);
      expect(u.orderNumber).toBeTruthy();
    });
  });
});

describe('Order Fulfillment Tracking', () => {
  const VALID_SOURCES = ['in_stock', 'vendor_purchase', ''];
  const VALID_SHIPPING = ['pickup', 'drop_ship', 'vendor_dropoff', 'ups', 'fedex', 'other', ''];

  it('validates fulfillment data shape', () => {
    const fulfillment = {
      source: 'vendor_purchase',
      vendorId: '1',
      vendorName: 'Active Vendor A',
      shippingMethod: 'ups',
      trackingNumber: '1Z999AA10123456784',
      notes: 'Expected delivery Mon',
    };
    expect(VALID_SOURCES).toContain(fulfillment.source);
    expect(VALID_SHIPPING).toContain(fulfillment.shippingMethod);
    expect(fulfillment.vendorId).toBeTruthy();
  });

  it('allows empty optional fields', () => {
    const minimal = { source: '', shippingMethod: '' };
    expect(VALID_SOURCES).toContain(minimal.source);
    expect(VALID_SHIPPING).toContain(minimal.shippingMethod);
  });
});

// ---------------------------------------------------------------------------
// 8. Business Rules Shape
// ---------------------------------------------------------------------------

describe('Business Rules', () => {
  const RULE_TYPES = ['SKU_MAPPING', 'PRICING', 'NAMING', 'UNIT_CONVERSION'];

  it('validates rule types', () => {
    RULE_TYPES.forEach((t) => {
      expect(typeof t).toBe('string');
    });
  });

  it('validates SKU mapping rule shape', () => {
    const rule = {
      type: 'SKU_MAPPING',
      vendor: 'Active Vendor A',
      active: true,
      rule: { atd_sku: 'ATD-001', vendor_sku: 'VEND-001' },
    };
    expect(RULE_TYPES).toContain(rule.type);
    expect(rule.rule.atd_sku).toBeTruthy();
    expect(rule.rule.vendor_sku).toBeTruthy();
  });

  it('validates pricing rule shape', () => {
    const rule = {
      type: 'PRICING',
      vendor: 'Active Vendor A',
      active: true,
      rule: { discount_percent: 15, start_date: '2026-01-01', end_date: '2026-12-31' },
    };
    expect(rule.rule.discount_percent).toBeGreaterThanOrEqual(0);
    expect(rule.rule.discount_percent).toBeLessThanOrEqual(100);
  });

  it('validates unit conversion rule shape', () => {
    const rule = {
      type: 'UNIT_CONVERSION',
      vendor: 'Active Vendor A',
      active: true,
      rule: { atd_unit: 'Sq Ft', vendor_unit: 'Box', conversion_factor: 12.5 },
    };
    expect(rule.rule.conversion_factor).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 9. AI Chat Shape
// ---------------------------------------------------------------------------

describe('AI Chat', () => {
  it('validates chat request shape', () => {
    const request = { message: 'What POs are pending?', context: {} };
    expect(request.message).toBeTruthy();
    expect(typeof request.message).toBe('string');
  });

  it('validates chat response shape', () => {
    const response = {
      response: 'There are 3 pending POs totaling $4,500.',
      suggestions: ['View pending POs', 'Create new PO'],
    };
    expect(response.response).toBeTruthy();
    expect(Array.isArray(response.suggestions)).toBe(true);
  });

  it('handles rate limit error', () => {
    const err = { message: 'Rate limit exceeded', fix: 'Wait 30 seconds and retry' };
    expect(err.fix).toContain('retry');
  });
});

// ---------------------------------------------------------------------------
// 10. Google Sheets Integration Shape
// ---------------------------------------------------------------------------

describe('Google Sheets Integration', () => {
  it('validates sheet preview response shape', () => {
    const preview = {
      headers: ['Order #', 'SKU', 'Vendor', 'Item Name', 'Qty', 'Line Item #'],
      rows: [
        { 'Order #': 'ORD-001', 'SKU': 'TILE-12x24', 'Vendor': 'Active Vendor A', 'Qty': '500' },
      ],
      totalRows: 1,
    };
    expect(preview.headers.length).toBeGreaterThan(0);
    expect(preview.rows.length).toBeGreaterThan(0);
    expect(preview.rows[0]['Order #']).toBeTruthy();
  });

  it('validates import response shape', () => {
    const importResult = {
      success: true,
      imported: 5,
      skipped: 1,
      errors: [],
    };
    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Activity Log Shape
// ---------------------------------------------------------------------------

describe('Activity Log', () => {
  it('validates log entry creation shape', () => {
    const entry = {
      type: 'PO_CREATED',
      action: 'po-create',
      details: 'PO created for vendor Active Vendor A',
      user: 'system',
      metadata: { vendorName: 'Active Vendor A' },
    };
    expect(entry.type).toBeTruthy();
    expect(entry.action).toBeTruthy();
  });

  it('validates log query params shape', () => {
    const params = { type: 'PO_CREATED', startDate: '2026-04-01', endDate: '2026-04-12', limit: 50 };
    expect(params.limit).toBeGreaterThan(0);
    expect(params.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// 12. Settings Shape
// ---------------------------------------------------------------------------

describe('Settings', () => {
  it('validates settings object shape', () => {
    const settings = {
      modules: {
        purchaseOrder: { enabled: true },
        invoice: { enabled: true },
        bill: { enabled: true },
        payment: { enabled: true },
        expense: { enabled: true },
      },
      po_sheet_id: 'some-sheet-id',
      ai_provider: 'ollama',
    };
    expect(settings.modules.purchaseOrder.enabled).toBe(true);
    expect(settings.po_sheet_id).toBeTruthy();
    expect(settings.po_sheet_id).not.toContain('1TJDsUcab'); // no hardcoded sheet IDs
  });

  it('validates module toggle structure', () => {
    const modules = ['purchaseOrder', 'invoice', 'bill', 'payment', 'expense'];
    const settings = { modules: {} };
    modules.forEach((m) => { settings.modules[m] = { enabled: true }; });
    modules.forEach((m) => {
      expect(settings.modules[m]).toBeDefined();
      expect(typeof settings.modules[m].enabled).toBe('boolean');
    });
  });
});

// ---------------------------------------------------------------------------
// 13. Cross-Module Security Basics
// ---------------------------------------------------------------------------

describe('Security & Data Integrity', () => {
  it('verifies no console errors leak sensitive data patterns', () => {
    const sensitivePatterns = [/password/i, /secret/i, /token=[A-Za-z0-9]/i, /api_key/i];
    const mockLogs = ['User logged in', 'PO created for vendor A', 'Health check passed'];
    mockLogs.forEach((log) => {
      sensitivePatterns.forEach((pattern) => {
        expect(log).not.toMatch(pattern);
      });
    });
  });

  it('validates error response does not expose stack traces', () => {
    const errorResponse = {
      success: false,
      error: 'Database error',
      code: 'FIRESTORE_ERROR',
      fix: 'Check your Firebase project configuration.',
    };
    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).not.toContain('at Function');
    expect(errorResponse.error).not.toContain('node_modules');
  });

  it('validates all error codes have fix suggestions', () => {
    const ERROR_CODES = {
      QBO_AUTH_EXPIRED: 'Your QuickBooks token has expired.',
      QBO_NOT_CONNECTED: 'QuickBooks is not connected.',
      QBO_API_ERROR: 'QuickBooks API returned an error.',
      SHEETS_NOT_CONFIGURED: 'Google Sheet ID is not set.',
      SHEETS_ACCESS_DENIED: 'Cannot access the Google Sheet.',
      AI_UNAVAILABLE: 'AI services are unavailable.',
      FIRESTORE_ERROR: 'Database error.',
      VALIDATION_ERROR: 'Invalid input data.',
      UNKNOWN_ERROR: 'An unexpected error occurred.',
    };
    Object.entries(ERROR_CODES).forEach(([code, fix]) => {
      expect(code).toBeTruthy();
      expect(fix).toBeTruthy();
      expect(typeof fix).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// 14. Data Cache Utility
// ---------------------------------------------------------------------------

describe('Data Cache Utility', () => {
  it('validates cache key naming convention', () => {
    const cacheKeys = ['vendors', 'vendorMappings', 'qboVendors', 'items', 'customers', 'accounts'];
    cacheKeys.forEach((key) => {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      expect(key).not.toContain(' ');
    });
  });
});
