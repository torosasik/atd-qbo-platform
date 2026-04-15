const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  let rawText = '';
  let data;
  let parseErr = null;

  if (typeof res.text === 'function') {
    rawText = await res.text();
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (err) {
      parseErr = err;
      data = { error: `JSON parse failed: ${err.message}`, raw: rawText };
    }
  } else if (typeof res.json === 'function') {
    try {
      data = await res.json();
    } catch (err) {
      parseErr = err;
      data = { error: `JSON parse failed: ${err.message}`, raw: 'Unable to read response body' };
    }
  } else {
    data = {};
  }

  if (parseErr) {
    const err = new Error(data.error);
    err.status = res.status;
    err.code = null;
    err.fix = 'Ensure API routes are deployed and returning JSON, not HTML.';
    err.data = data;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.code = data.code || null;
    err.fix = data.fix || null;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Extract a normalized error shape from any caught error.
 * Works with errors thrown by `request()` as well as plain Error objects.
 *
 * @param {unknown} error
 * @returns {{ message: string, fix: string|null, code: string|null }}
 */
export function getErrorMessage(error) {
  if (!error) return { message: 'An unexpected error occurred.', fix: null, code: null };
  return {
    message: error.message || 'An unexpected error occurred.',
    fix: error.fix || null,
    code: error.code || null,
  };
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),

  // Named helpers
  getSettings: () => api.get('/settings'),
  updateSettings: (updates) => api.put('/settings', updates),

  getVendors: () => api.get('/vendors'),
  getVendorMappings: () => api.get('/vendor/mappings'),
  getActiveVendors: () => api.get('/vendor/mappings/active'),

  // Items — local catalog (preferred for PO dropdowns)
  getItemsCatalog: () => api.get('/items/catalog'),
  getActiveItemsCatalog: () => api.get('/items/catalog/active'),
  syncItemsCatalog: () => api.post('/items/catalog/sync', {}),
  updateItemsCatalog: (items) => api.put('/items/catalog', { items }),

  // Items — direct QBO (legacy, kept for backward compatibility)
  getItems: () => api.get('/items'),
  createItem: (body) => api.post('/items/create', body),

  getPoDrafts: () => api.get('/po/drafts'),
  getPoHistory: () => api.get('/po/history'),
  createPo: (body) => api.post('/po/create', body),
  approveDraft: (draftId) => api.post(`/po/approve/${draftId}`, {}),
  rejectDraft: (draftId) => api.post(`/po/drafts/${draftId}/reject`, {}),

  // Invoices
  getCustomers: () => api.get('/customers'),
  getInvoiceHistory: () => api.get('/invoices'),
  getInvoiceDrafts: () => api.get('/invoices/drafts'),
  createInvoice: (body) => api.post('/invoices', body),
  approveInvoiceDraft: (draftId) => api.post(`/invoices/drafts/${draftId}/approve`, {}),
  rejectInvoiceDraft: (draftId) => api.post(`/invoices/drafts/${draftId}/reject`, {}),

  // Bills
  getBillHistory: () => api.get('/bills'),
  getBillDrafts: () => api.get('/bills/drafts'),
  createBill: (body) => api.post('/bills', body),
  approveBillDraft: (draftId) => api.post(`/bills/drafts/${draftId}/approve`, {}),
  rejectBillDraft: (draftId) => api.post(`/bills/drafts/${draftId}/reject`, {}),

  // Payments
  getPaymentHistory: () => api.get('/payments'),
  getPaymentDrafts: () => api.get('/payments/drafts'),
  getOpenInvoices: (customerId) => api.get(`/open-invoices/${customerId}`),
  createPayment: (body) => api.post('/payments', body),
  approvePaymentDraft: (draftId) => api.post(`/payments/drafts/${draftId}/approve`, {}),
  rejectPaymentDraft: (draftId) => api.post(`/payments/drafts/${draftId}/reject`, {}),

  // Expenses (categorization)
  getUncategorizedExpenses: () => api.get('/expenses/uncategorized'),
  getExpenseDrafts: () => api.get('/expenses/drafts'),
  categorizeExpense: (expenseId, suggestedAccountId) => api.post('/expenses/categorize', { expenseId, suggestedAccountId }),
  approveExpenseDraft: (draftId) => api.post(`/expenses/drafts/${draftId}/approve`, {}),
  rejectExpenseDraft: (draftId) => api.post(`/expenses/drafts/${draftId}/reject`, {}),
  getExpenseHistory: () => api.get('/expenses'),
  getAccounts: () => api.get('/accounts'),

  sendAiChat: (message) => api.post('/ai/chat', { message }),

  // Google Sheets
  testSheetConnection: () => api.get('/sheets/test-connection'),
  previewSheetData: () => api.get('/sheets/preview'),
  importFromSheets: () => api.post('/sheets/import', {}),

  // QBO Auth
  getAuthStatus: () => api.get('/auth/status'),
  connectQBO: () => api.get('/auth/connect'),
  disconnectAuth: () => api.post('/auth/disconnect', {}),
  disconnectQBO: () => api.post('/auth/disconnect', {}),
  refreshToken: () => api.post('/auth/refresh', {}),
  getQboCompanyInfo: () => api.get('/qbo/company-info'),

  // AI
  testAiConnection: (provider = 'auto') => api.post('/ai/chat', {
    message: 'Health check: respond with OK.',
    context: { test: true, provider },
  }),

  // Vendor Mappings
  syncVendorMappings: () => api.post('/vendor/mappings/sync', {}),

  // Health
  getHealth: () => api.get('/health'),

  // Orders (Google Sheets)
  getOrders: () => api.get('/sheets/orders'),
  getOrderStatuses: () => api.get('/order-statuses'),
  setOrderStatus: (orderNumber, lineItem, status) =>
    api.put(`/order-statuses/${encodeURIComponent(orderNumber)}${lineItem ? `/${encodeURIComponent(lineItem)}` : ''}`, { status }),
  bulkSetOrderStatuses: (updates) => api.put('/order-statuses/bulk', { updates }),

  // Order Fulfillment Tracking
  getOrderFulfillment: () => api.get('/order-fulfillment'),
  setOrderFulfillment: (orderNumber, lineItem, data) =>
    api.put(`/order-fulfillment/${encodeURIComponent(orderNumber)}${lineItem ? `/${encodeURIComponent(lineItem)}` : ''}`, data),

  // Activity Log
  getActivityLogs: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    if (params.search) qs.set('search', params.search);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return api.get(`/activity-log${query ? `?${query}` : ''}`);
  },
  postActivityLog: (body) => api.post('/activity-log', body),

  // Business Rules
  getRules: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.vendor) qs.set('vendor', params.vendor);
    if (params.type) qs.set('type', params.type);
    if (params.active != null) qs.set('active', String(params.active));
    const query = qs.toString();
    return api.get(`/rules${query ? `?${query}` : ''}`);
  },
  createRule: (body) => api.post('/rules', body),
  updateRule: (id, body) => api.put(`/rules/${id}`, body),
  deleteRule: (id) => api.del(`/rules/${id}`),
};
