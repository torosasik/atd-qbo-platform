'use strict';

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const SETTINGS_DOC = 'settings/app_config';

const DEFAULT_SETTINGS = {
  google_sheets: {
    po_sheet_id: '1CLycDpMsrD1KK5fBohSmExfVPKnTy0qOneUYc161BVE',
    po_sheet_tab: 'Sheet1',
    header_row: 1,
    data_start_row: 2,
    po_column_mapping: {
      vendorName: 'A',
      itemDescription: 'B',
      quantity: 'C',
      unitPrice: 'D',
      date: 'E',
      memo: 'F',
      poGroupKey: 'G',
    },
    invoice_sheet_id: '',
    invoice_sheet_tab: 'Sheet1',
    invoice_column_mapping: {
      customerName: 'A',
      itemDescription: 'B',
      quantity: 'C',
      unitPrice: 'D',
      date: 'E',
      memo: 'F',
      invoiceGroupKey: 'G',
    },
  },
  ai: {
    enabled: true,
    auto_review: true,
    min_confidence: 90,
    max_tokens: 2000,
    review_prompt: 'Review this Purchase Order for errors, duplicates, or unusual quantities. Flag anything that needs attention.',
    ollama_model: 'qwen3.5-coder-35b:latest',
    ollama_url: 'http://localhost:11434',
    claude_model: 'claude-sonnet-4-20250514',
  },
  qbo: {
    environment: 'production',
    base_url: 'https://quickbooks.api.intuit.com',
    sandbox_base_url: 'https://sandbox-quickbooks.api.intuit.com',
    production_base_url: 'https://quickbooks.api.intuit.com',
    default_expense_account: '',
    default_memo_template: 'PO from ATD Platform - Order #{order_number}',
    default_po_terms: 'Net 30',
  },
  modules: {
    purchase_order: { enabled: true, auto_approve: false, require_ai_review: true, vendor_cache_hours: 24 },
    invoice: { enabled: false, auto_approve: false },
    bill: { enabled: false, auto_approve: false },
    payment: { enabled: false, auto_approve: false },
  },
  oauth: {
    redirect_uri: 'https://atd-qbo-platform.web.app/api/auth/callback',
  },
};

/**
 * Deep merge source into target. Mutates target. Arrays are replaced, not merged.
 */
function deepMerge(target, source) {
  const result = Array.isArray(target) ? [...target] : { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];
    if (srcVal !== null && typeof srcVal === 'object' && !Array.isArray(srcVal) &&
        tgtVal !== null && typeof tgtVal === 'object' && !Array.isArray(tgtVal)) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * Read settings from Firestore. If the document does not exist, write defaults and return them.
 *
 * @returns {Promise<Object>} The current settings object.
 */
async function getSettings() {
  const db = getFirestore();
  const docSnap = await db.doc(SETTINGS_DOC).get();

  if (!docSnap.exists) {
    await db.doc(SETTINGS_DOC).set({
      ...DEFAULT_SETTINGS,
      _createdAt: FieldValue.serverTimestamp(),
      _updatedAt: FieldValue.serverTimestamp(),
    });
    return { ...DEFAULT_SETTINGS };
  }

  // Merge stored values on top of defaults so new default keys appear automatically
  const stored = docSnap.data();
  const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), stored);
  // Strip internal Firestore metadata fields before returning
  delete merged._createdAt;
  delete merged._updatedAt;
  return merged;
}

/**
 * Deep-merge updates into the current settings document.
 *
 * @param {Object} updates - Partial settings object (may be nested).
 * @returns {Promise<Object>} The updated settings object.
 */
async function updateSettings(updates) {
  const db = getFirestore();
  // Read current settings first so the returned value is accurate
  const current = await getSettings();
  const updated = deepMerge(current, updates);

  await db.doc(SETTINGS_DOC).set({
    ...updated,
    _updatedAt: FieldValue.serverTimestamp(),
  });

  return updated;
}

/**
 * Get a single nested setting value by dot-notation path.
 * Falls back to the same path in DEFAULT_SETTINGS if not found.
 *
 * @param {string} path - Dot-notation key path, e.g. 'ai.min_confidence'
 * @returns {Promise<any>} The value at the given path, or undefined.
 */
async function getSettingValue(path) {
  const settings = await getSettings();
  return path.split('.').reduce((obj, key) => (obj != null ? obj[key] : undefined), settings);
}

module.exports = { getSettings, updateSettings, getSettingValue, DEFAULT_SETTINGS };
