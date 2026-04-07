const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
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
  getVendorMappings: () => api.get('/vendor-mappings'),
  getItems: () => api.get('/items'),
  createItem: (body) => api.post('/items/create', body),

  getPoDrafts: () => api.get('/po/drafts'),
  getPoHistory: () => api.get('/po/history'),
  createPo: (body) => api.post('/po/create', body),
  approveDraft: (draftId) => api.post(`/po/approve/${draftId}`, {}),

  sendAiChat: (message) => api.post('/ai/chat', { message }),

  // Google Sheets
  testSheetConnection: () => api.get('/sheets/test-connection'),
  previewSheetData: () => api.get('/sheets/preview'),
  importFromSheets: () => api.post('/sheets/import', {}),

  // QBO Auth
  getAuthStatus: () => api.get('/auth/status'),
  connectQBO: () => api.get('/auth/connect'),
  disconnectAuth: () => api.post('/auth/disconnect', {}),
  refreshToken: () => api.post('/auth/refresh', {}),

  // Vendor Mappings
  syncVendorMappings: () => api.post('/vendor-mappings/sync', {}),

  // Health
  getHealth: () => api.get('/health'),
};
