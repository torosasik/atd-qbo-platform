import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, AlertCircle, CheckCircle, X, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { api } from '../utils/api';
import { invalidateFeatureCache } from '../utils/useFeatures';
import Toggle from '../components/shared/Toggle';
import Toast from '../components/shared/Toast';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import InfoTooltip from '../components/shared/InfoTooltip';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const COLUMNS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'AA','AB','AC','AD','AE','AF','AG','AH','AI',
];

const COLUMN_MAPPING_FIELDS = [
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'lastOrderedOn', label: 'Last Ordered On' },
  { key: 'lastOrderNumber', label: 'Last Order #' },
  { key: 'continuation', label: 'Continuation' },
  { key: 'orderNumber', label: 'Order #' },
  { key: 'lineItem', label: 'Line Item #' },
  { key: 'customerName', label: 'Customer' },
  { key: 'customerEmail', label: 'Email' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'sku', label: 'SKU' },
  { key: 'variantId', label: 'Variant ID' },
  { key: 'itemDescription', label: 'Item Name' },
  { key: 'aka', label: 'AKA' },
  { key: 'requiredSize', label: 'Required Size' },
  { key: 'quantity', label: 'Qty' },
  { key: 'currentQty', label: 'Current Qty' },
  { key: 'unit', label: 'Unit' },
  { key: 'sqFt', label: 'Sq. Ft.' },
  { key: 'pieces', label: 'Pieces' },
  { key: 'overage', label: 'Overage' },
  { key: 'unitPrice', label: 'Price' },
  { key: 'cost', label: 'Cost' },
  { key: 'subtotal', label: 'Subtotal' },
  { key: 'stateZipcode', label: 'State/Zipcode' },
  { key: 'shippingType', label: 'Shipping Type' },
  { key: 'shippingCost', label: 'Shipping Cost' },
  { key: 'orderTotal', label: 'Order Total' },
  { key: 'orderTags', label: 'Order Tags' },
  { key: 'inventoryQty', label: 'Inventory Qty' },
  { key: 'measuringUnit', label: 'Measuring Unit' },
  { key: 'tilesPerBox', label: 'Tiles Per Box' },
  { key: 'tileSizeCoverage', label: 'Tile Size / Coverage' },
  { key: 'boxAreaCoverage', label: 'Box Area / Coverage' },
];

const MODULE_ROWS = [
  { key: 'purchase_order', label: 'Purchase Orders', available: true },
  { key: 'invoice', label: 'Invoices', available: false },
  { key: 'bill', label: 'Bills', available: false },
  { key: 'payment', label: 'Payments', available: false },
];

// Feature toggles with labels and descriptions
const FEATURE_TOGGLES = [
  { key: 'sheets_import',       label: 'Google Sheets Import',    description: 'Import orders from the Google Sheets master list into the platform', category: 'Data Sources' },
  { key: 'ai_review',           label: 'AI Transaction Review',   description: 'Run AI validation on transactions before they are submitted to QuickBooks', category: 'AI & Automation' },
  { key: 'ai_chat',             label: 'AI Chat Assistant',       description: 'Enable the interactive AI chat for support and data queries', category: 'AI & Automation' },
  { key: 'auto_approve',        label: 'Auto-Approve',            description: 'Automatically push approved transactions to QuickBooks without manual review', category: 'AI & Automation' },
  { key: 'purchase_orders',     label: 'Purchase Orders',         description: 'Create and manage purchase orders from sheets or web forms', category: 'Modules' },
  { key: 'invoices',            label: 'Invoices',                description: 'Create and manage customer invoices', category: 'Modules' },
  { key: 'bills',               label: 'Bills',                   description: 'Create and manage vendor bills', category: 'Modules' },
  { key: 'payments',            label: 'Payments',                description: 'Create and manage bill payments', category: 'Modules' },
  { key: 'expenses',            label: 'Expense Tracking',        description: 'Track and categorize expenses from QuickBooks', category: 'Modules' },
  { key: 'vendor_management',   label: 'Vendor Management',       description: 'Vendor lookup, search, and cache management', category: 'Modules' },
  { key: 'dashboard_analytics', label: 'Dashboard Analytics',     description: 'Show KPI cards and analytics charts on the dashboard', category: 'Interface' },
  { key: 'notifications',       label: 'Notifications',           description: 'In-app notifications for important events (coming soon)', category: 'Interface', comingSoon: true },
];

// ---------------------------------------------------------------------------
// Backend defaults - must match functions/core/settings.js DEFAULT_SETTINGS
// ---------------------------------------------------------------------------
const BACKEND_DEFAULTS = {
  google_sheets: {
    po_sheet_id: '1TJDsUcabGjC4kYmQAdVAH2CJACN5D9jrjnsUVlp1W9U',
    po_sheet_tab: 'Sheet1',
    header_row: 1,
    data_start_row: 2,
    po_column_mapping: {
      status: 'A', date: 'B', time: 'C', lastOrderedOn: 'D', lastOrderNumber: 'E',
      continuation: 'F', orderNumber: 'G', lineItem: 'H', customerName: 'I',
      customerEmail: 'J', vendorName: 'K', sku: 'L', variantId: 'M',
      itemDescription: 'N', aka: 'O', requiredSize: 'P', quantity: 'Q',
      currentQty: 'R', unit: 'S', sqFt: 'T', pieces: 'U', overage: 'V',
      unitPrice: 'W', cost: 'X', subtotal: 'Y', stateZipcode: 'Z',
      shippingType: 'AA', shippingCost: 'AB', orderTotal: 'AC', orderTags: 'AD',
      inventoryQty: 'AE', measuringUnit: 'AF', tilesPerBox: 'AG',
      tileSizeCoverage: 'AH', boxAreaCoverage: 'AI',
    },
    invoice_sheet_id: '',
    invoice_sheet_tab: 'Sheet1',
    invoice_column_mapping: {
      customerName: 'A', itemDescription: 'B', quantity: 'C',
      unitPrice: 'D', date: 'E', memo: 'F', invoiceGroupKey: 'G',
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
    ollama_enabled: true,
    preferred_provider: 'auto',
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
  features: {
    sheets_import: true,
    ai_review: true,
    ai_chat: true,
    auto_approve: false,
    purchase_orders: true,
    invoices: true,
    bills: true,
    payments: true,
    expenses: true,
    vendor_management: true,
    dashboard_analytics: true,
    notifications: false,
  },
  oauth: {
    redirect_uri: 'https://atd-qbo-platform.web.app/api/auth/callback',
  },
};

// Use BACKEND_DEFAULTS as the single source of truth for UI defaults.
// This prevents stale local defaults from overriding backend values.
const DEFAULT_SETTINGS = BACKEND_DEFAULTS;
const SETTINGS_CACHE_KEY = 'atd.settings.cache.v1';

function deepMerge(base, override) {
  if (!override) return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key])
    ) {
      result[key] = deepMerge(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionCard({ title, children, onSave, saving }) {
  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-atd-dark">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-5">
        {children}
        {onSave && (
          <div className="pt-2 border-t border-gray-100 flex">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-2 bg-atd-blue hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <LoadingSpinner size="sm" color="white" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, tooltip, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
      <label className="text-sm font-medium text-gray-700 sm:w-44 flex-shrink-0 flex items-center">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, readOnly, className = '' }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue ${
        readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : ''
      } ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null); // { message, type }
  const [saving, setSaving] = useState({});
  const [cacheStatus, setCacheStatus] = useState({ vendors: null, items: null });
  const [sheetTest, setSheetTest] = useState({ status: null, loading: false, message: '' });
  const [sheetPreview, setSheetPreview] = useState({ data: null, open: false, loading: false, error: null });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [aiTest, setAiTest] = useState({ status: null, loading: false, message: '' });

  const isDirty = savedSettings !== null && JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const showToast = (message, type = 'success') => setToast({ message, type });
  const dismissToast = useCallback(() => setToast(null), []);

  // Warn on tab close / refresh when there are unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    async function load() {
      setPageLoading(true);
      try {
        const res = await api.getSettings();
        const data = res.settings ?? res.data?.settings ?? res.data ?? res;
        const merged = deepMerge(DEFAULT_SETTINGS, data);
        setSettings(merged);
        setSavedSettings(JSON.parse(JSON.stringify(merged)));
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged));
      } catch (err) {
        let fallbackSettings = DEFAULT_SETTINGS;
        let usedCache = false;
        try {
          const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            fallbackSettings = deepMerge(DEFAULT_SETTINGS, parsed);
            usedCache = true;
          }
        } catch {
          fallbackSettings = DEFAULT_SETTINGS;
        }

        setSettings(fallbackSettings);
        setSavedSettings(JSON.parse(JSON.stringify(fallbackSettings)));
        setLoadError(
          usedCache
            ? 'Could not load saved settings from server. Showing locally cached values.'
            : (err.message || 'Could not load saved settings from server. Showing defaults.')
        );
      } finally {
        setPageLoading(false);
      }
    }
    load();
  }, []);

  function setNested(path, value) {
    setSettings((prev) => {
      const keys = path.split('.');
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  }

  async function saveSection(sectionKey, payload) {
    setSaving((s) => ({ ...s, [sectionKey]: true }));
    try {
      await api.updateSettings(payload);
      // Snapshot current settings as "saved" baseline
      setSavedSettings(JSON.parse(JSON.stringify(settings)));
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
      showToast('Settings saved.', 'success');
      // If features were saved, invalidate the cache so sidebar updates instantly
      if (sectionKey === 'features') {
        invalidateFeatureCache();
      }
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving((s) => ({ ...s, [sectionKey]: false }));
    }
  }

  async function handleResetToDefaults() {
    setResetting(true);
    try {
      await api.updateSettings(BACKEND_DEFAULTS);
      const resetMerged = deepMerge(DEFAULT_SETTINGS, BACKEND_DEFAULTS);
      setSettings(resetMerged);
      setSavedSettings(JSON.parse(JSON.stringify(resetMerged)));
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(resetMerged));
      setResetConfirm(false);
      showToast('Settings reset to defaults.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to reset settings.', 'error');
    } finally {
      setResetting(false);
    }
  }

  async function handleTestSheetConnection() {
    setSheetTest({ status: null, loading: true, message: '' });
    try {
      await api.testSheetConnection();
      setSheetTest({ status: 'ok', loading: false, message: 'Connection successful.' });
    } catch (err) {
      setSheetTest({ status: 'error', loading: false, message: err.message || 'Connection failed.' });
    }
  }

  async function handleTestAiConnection() {
    setAiTest({ status: null, loading: true, message: '' });
    try {
      await api.testAiConnection(ai?.preferred_provider || 'auto');
      setAiTest({ status: 'ok', loading: false, message: 'AI connection successful.' });
    } catch (err) {
      setAiTest({ status: 'error', loading: false, message: err.message || 'AI connection failed.' });
    }
  }

  async function handlePreviewSheetData() {
    setSheetPreview((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await api.previewSheetData();
      const rows = Array.isArray(res.data ?? res) ? (res.data ?? res) : [];
      setSheetPreview({ data: rows, open: true, loading: false, error: null });
    } catch (err) {
      setSheetPreview({ data: null, open: false, loading: false, error: err.message || 'Preview failed.' });
    }
  }

  async function handleRefreshVendors() {
    setCacheStatus((s) => ({ ...s, vendors: 'loading' }));
    try {
      const res = await api.getVendors();
      const arr = Array.isArray(res.data ?? res) ? (res.data ?? res) : [];
      setCacheStatus((s) => ({ ...s, vendors: `${arr.length} vendors refreshed.` }));
    } catch (err) {
      setCacheStatus((s) => ({ ...s, vendors: `Error: ${err.message}` }));
    }
  }

  async function handleRefreshItems() {
    setCacheStatus((s) => ({ ...s, items: 'loading' }));
    try {
      const res = await api.getItems();
      const arr = Array.isArray(res.data ?? res) ? (res.data ?? res) : [];
      setCacheStatus((s) => ({ ...s, items: `${arr.length} items refreshed.` }));
    } catch (err) {
      setCacheStatus((s) => ({ ...s, items: `Error: ${err.message}` }));
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-6">
        <LoadingSpinner size="lg" color="atd-blue" />
      </div>
    );
  }

  const gs = settings.google_sheets;
  const ai = settings.ai;
  const qbo = settings.qbo;
  const mods = settings.modules;
  const feats = settings.features || {};

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-atd-dark">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure the ATD QBO Platform</p>
      </div>

      {/* Unsaved changes indicator */}
      {isDirty && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-2.5 text-sm font-medium">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
          You have unsaved changes
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {loadError}
        </div>
      )}

      {/* Section 0: Feature Toggles */}
      <SectionCard
        title="Feature Toggles"
        onSave={() => saveSection('features', { features: feats })}
        saving={saving.features}
      >
        <p className="text-sm text-gray-500 -mt-2 mb-4">
          Enable or disable individual features. Changes apply immediately after saving — no restart required.
        </p>
        {['Data Sources', 'AI & Automation', 'Modules', 'Interface'].map((category) => {
          const items = FEATURE_TOGGLES.filter((f) => f.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-5 last:mb-0">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{category}</h3>
              <div className="space-y-3">
                {items.map(({ key, label, description, comingSoon }) => {
                  const enabled = feats[key] !== false;
                  return (
                    <div
                      key={key}
                      className={`flex items-start gap-4 p-3 rounded-lg border transition-colors ${
                        enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                      } ${comingSoon ? 'opacity-50' : ''}`}
                    >
                      <div className="pt-0.5">
                        <Toggle
                          id={`feat-${key}`}
                          checked={enabled}
                          onChange={(v) => setNested(`features.${key}`, v)}
                          disabled={!!comingSoon}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${enabled ? 'text-atd-dark' : 'text-gray-400'}`}>
                            {label}
                          </span>
                          {enabled ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              ON
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              OFF
                            </span>
                          )}
                          {comingSoon && (
                            <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 ${enabled ? 'text-gray-500' : 'text-gray-400'}`}>
                          {description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </SectionCard>

      {/* Section 1: Google Sheets */}
      <SectionCard
        title="Google Sheets Connection"
        onSave={() =>
          saveSection('sheets', {
            google_sheets: {
              po_sheet_id: gs.po_sheet_id,
              po_sheet_tab: gs.po_sheet_tab,
              header_row: gs.header_row,
              data_start_row: gs.data_start_row,
              po_column_mapping: gs.po_column_mapping,
            },
          })
        }
        saving={saving.sheets}
      >
        <FieldRow
          label="Sheet ID"
          tooltip="The Google Sheets spreadsheet ID found in the sheet URL between /d/ and /edit."
        >
          <TextInput
            value={gs.po_sheet_id}
            onChange={(v) => setNested('google_sheets.po_sheet_id', v)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          />
        </FieldRow>
        {qbo.environment === 'production' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            WARNING: Production mode affects real QuickBooks data. Switch to Sandbox for testing.
          </div>
        )}
        <FieldRow
          label="Tab Name"
          tooltip="The name of the tab within the spreadsheet that contains PO data. Defaults to Sheet1."
        >
          <TextInput
            value={gs.po_sheet_tab}
            onChange={(v) => setNested('google_sheets.po_sheet_tab', v)}
            placeholder="Sheet1"
          />
        </FieldRow>
        <FieldRow
          label="Header Row"
          tooltip="The row number that contains column headers. Defaults to 1."
        >
          <input
            type="number"
            min="1"
            value={gs.header_row ?? 1}
            onChange={(e) => setNested('google_sheets.header_row', parseInt(e.target.value, 10) || 1)}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
        </FieldRow>
        <FieldRow
          label="Data Start Row"
          tooltip="The row number where actual data begins. Defaults to 2."
        >
          <input
            type="number"
            min="1"
            value={gs.data_start_row ?? 2}
            onChange={(e) => setNested('google_sheets.data_start_row', parseInt(e.target.value, 10) || 1)}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
        </FieldRow>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            Column Mapping
            <InfoTooltip text="Map each PO field to the corresponding column letter in your Google Sheet." />
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-10 text-left">Field Name</th>
                  <th className="pb-2 text-left">Column Letter</th>
                </tr>
              </thead>
              <tbody>
                {COLUMN_MAPPING_FIELDS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="pr-10 py-1 text-gray-600">{label}</td>
                    <td className="py-1">
                      <select
                        value={gs.po_column_mapping?.[key] || 'A'}
                        onChange={(e) =>
                          setNested(`google_sheets.po_column_mapping.${key}`, e.target.value)
                        }
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTestSheetConnection}
              disabled={sheetTest.loading}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {sheetTest.loading ? <LoadingSpinner size="sm" color="gray" /> : null}
              Test Connection
            </button>
            {sheetTest.status === 'ok' && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" /> {sheetTest.message}
              </span>
            )}
            {sheetTest.status === 'error' && (
              <span className="flex items-center gap-1.5 text-red-600 text-sm">
                <X className="h-4 w-4" /> {sheetTest.message}
              </span>
            )}
            <button
              onClick={handlePreviewSheetData}
              disabled={sheetPreview.loading}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {sheetPreview.loading ? <LoadingSpinner size="sm" color="gray" /> : null}
              Preview Data
            </button>
          </div>
          {sheetPreview.error && (
            <p className="text-sm text-red-600">{sheetPreview.error}</p>
          )}
          {sheetPreview.data && (
            <div>
              <button
                onClick={() => setSheetPreview((s) => ({ ...s, open: !s.open }))}
                className="flex items-center gap-1.5 text-sm text-atd-blue hover:text-atd-blue-light font-medium"
              >
                {sheetPreview.open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {sheetPreview.open ? 'Hide' : 'Show'} Preview ({sheetPreview.data.length} rows)
              </button>
              {sheetPreview.open && sheetPreview.data.length > 0 && (
                <div className="mt-2 overflow-x-auto max-h-64 border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {Object.keys(sheetPreview.data[0]).map((col) => (
                          <th key={col} className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sheetPreview.data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                              {val ?? '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {sheetPreview.open && sheetPreview.data.length === 0 && (
                <p className="mt-2 text-sm text-gray-400">No data rows found in sheet.</p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Section 2: AI Configuration */}
      <SectionCard
        title="AI Configuration"
        onSave={() =>
          saveSection('ai', {
            ai: {
              enabled: ai.enabled,
              auto_review: ai.auto_review,
              min_confidence: ai.min_confidence,
              max_tokens: ai.max_tokens,
              review_prompt: ai.review_prompt,
              ollama_url: ai.ollama_url,
              ollama_model: ai.ollama_model,
              claude_model: ai.claude_model,
              ollama_enabled: ai.ollama_enabled,
              preferred_provider: ai.preferred_provider,
            },
          })
        }
        saving={saving.ai}
      >
        <FieldRow
          label="AI Enabled"
          tooltip="When enabled, AI will review transactions before they are submitted to QuickBooks."
        >
          <Toggle
            id="ai-enabled"
            checked={!!ai.enabled}
            onChange={(v) => setNested('ai.enabled', v)}
          />
        </FieldRow>
        <FieldRow
          label="Auto Review"
          tooltip="Automatically run AI review on every new transaction. Requires AI to be enabled."
        >
          <Toggle
            id="ai-auto-review"
            checked={!!ai.auto_review}
            onChange={(v) => setNested('ai.auto_review', v)}
            disabled={!ai.enabled}
          />
        </FieldRow>
        <FieldRow
          label="Ollama Enabled"
          tooltip="Enable local Ollama AI provider. When disabled, Ollama will be skipped even in Auto mode."
        >
          <Toggle
            id="ai-ollama-enabled"
            checked={ai.ollama_enabled !== false}
            onChange={(v) => setNested('ai.ollama_enabled', v)}
            disabled={!ai.enabled}
          />
        </FieldRow>
        <FieldRow
          label="Preferred AI Provider"
          tooltip="Auto: try Ollama first, fall back to Claude. Ollama Only: never use Claude. Claude Only: skip Ollama entirely."
        >
          <select
            value={ai.preferred_provider || 'auto'}
            onChange={(e) => setNested('ai.preferred_provider', e.target.value)}
            disabled={!ai.enabled}
            className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="auto">Auto (Ollama → Claude)</option>
            <option value="ollama-only">Ollama Only</option>
            <option value="claude-only">Claude Only</option>
          </select>
        </FieldRow>
        <FieldRow
          label="Min Confidence (%)"
          tooltip="Minimum confidence score (0-100) for Ollama responses. Below this threshold, the request escalates to Claude API."
        >
          <input
            type="number"
            min="0"
            max="100"
            value={ai.min_confidence ?? 90}
            onChange={(e) => setNested('ai.min_confidence', parseInt(e.target.value, 10) || 70)}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
        </FieldRow>
        <FieldRow
          label="Ollama URL"
          tooltip="URL of your local Ollama instance. Ollama is the free, local AI provider used as the primary option."
        >
          <div className="flex items-center gap-3">
            <TextInput
              value={ai.ollama_url}
              onChange={(v) => setNested('ai.ollama_url', v)}
              placeholder="http://localhost:11434"
            />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
              <span className="text-xs text-gray-400">Status unknown</span>
            </div>
          </div>
        </FieldRow>
        <FieldRow
          label="Ollama Model"
          tooltip="The Ollama model to use for AI reviews. llama3 is recommended for best results."
        >
          <TextInput
            value={ai.ollama_model}
            onChange={(v) => setNested('ai.ollama_model', v)}
            placeholder="llama3"
          />
        </FieldRow>
        <FieldRow
          label="Claude Model"
          tooltip="The Claude API model used as a fallback when Ollama is unavailable or confidence is below the threshold."
        >
          <TextInput
            value={ai.claude_model}
            onChange={(v) => setNested('ai.claude_model', v)}
            placeholder="claude-sonnet-4-20250514"
          />
        </FieldRow>
        <FieldRow
          label="Max Tokens"
          tooltip="Maximum number of tokens for AI responses. Higher values allow longer, more detailed reviews."
        >
          <input
            type="number"
            min="64"
            max="8192"
            value={ai.max_tokens ?? 2000}
            onChange={(e) => setNested('ai.max_tokens', parseInt(e.target.value, 10) || 2000)}
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
        </FieldRow>
        <FieldRow
          label="AI Review Prompt"
          tooltip="The system prompt sent to the AI when reviewing transactions. Customize to focus on specific checks."
        >
          <textarea
            rows={4}
            value={ai.review_prompt || ''}
            onChange={(e) => setNested('ai.review_prompt', e.target.value)}
            placeholder="Review this purchase order for accuracy..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue resize-y"
          />
        </FieldRow>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleTestAiConnection}
            disabled={aiTest.loading}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {aiTest.loading ? <LoadingSpinner size="sm" color="gray" /> : null}
            Test AI Connection
          </button>
          {aiTest.status === 'ok' && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" /> {aiTest.message}
            </span>
          )}
          {aiTest.status === 'error' && (
            <span className="flex items-center gap-1.5 text-red-600 text-sm">
              <X className="h-4 w-4" /> {aiTest.message}
            </span>
          )}
        </div>
      </SectionCard>

      {/* Section 3: QBO Connection */}
      <SectionCard
        title="QuickBooks Connection"
        onSave={() =>
          saveSection('qbo', {
            qbo: {
              environment: qbo.environment,
              default_memo_template: qbo.default_memo_template,
              default_po_terms: qbo.default_po_terms,
            },
          })
        }
        saving={saving.qbo}
      >
        <FieldRow
          label="Environment"
          tooltip="Sandbox uses test data only. Switch to Production only when ready to create real transactions in QuickBooks."
        >
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="sandbox"
                checked={qbo.environment === 'sandbox'}
                onChange={() => setNested('qbo.environment', 'sandbox')}
                className="text-atd-blue focus:ring-atd-blue"
              />
              <span className="text-sm text-gray-700">Sandbox</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="production"
                checked={qbo.environment === 'production'}
                onChange={() => setNested('qbo.environment', 'production')}
                className="text-atd-blue focus:ring-atd-blue"
              />
              <span className="text-sm text-gray-700">Production</span>
              {qbo.environment === 'production' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">
                  LIVE
                </span>
              )}
            </label>
          </div>
        </FieldRow>

        <FieldRow
          label="Realm ID"
          tooltip="Your QuickBooks company ID, assigned automatically when you connect via OAuth. Read-only."
        >
          <TextInput
            value={qbo.realmId || '(not connected)'}
            readOnly
          />
        </FieldRow>

        <FieldRow
          label="Default Memo Template"
          tooltip="Default memo text applied to new purchase orders. Can be overridden per PO."
        >
          <TextInput
            value={qbo.default_memo_template}
            onChange={(v) => setNested('qbo.default_memo_template', v)}
            placeholder="e.g., ATD PO - {{vendor}}"
          />
        </FieldRow>
        <FieldRow
          label="Default PO Terms"
          tooltip="Default payment terms applied to new purchase orders (e.g., Net 30, COD)."
        >
          <TextInput
            value={qbo.default_po_terms}
            onChange={(v) => setNested('qbo.default_po_terms', v)}
            placeholder="e.g., Net 30"
          />
        </FieldRow>

        <FieldRow label="Last Refreshed">
          <TextInput value={settings?.qbo?.lastRefreshed || 'Connect to QBO to see token info'} readOnly />
        </FieldRow>
        <FieldRow label="Token Expires At">
          <TextInput value={settings?.qbo?.tokenExpiresAt || 'Connect to QBO to see token info'} readOnly />
        </FieldRow>
        <p className="text-xs text-gray-400">
          Token status will display here after OAuth setup is complete.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <button
              onClick={handleRefreshVendors}
              disabled={cacheStatus.vendors === 'loading'}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${cacheStatus.vendors === 'loading' ? 'animate-spin' : ''}`} />
              Refresh Vendor Cache
            </button>
            {cacheStatus.vendors && cacheStatus.vendors !== 'loading' && (
              <span className="text-xs text-gray-500 pl-1">{cacheStatus.vendors}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={handleRefreshItems}
              disabled={cacheStatus.items === 'loading'}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${cacheStatus.items === 'loading' ? 'animate-spin' : ''}`} />
              Refresh Item Cache
            </button>
            {cacheStatus.items && cacheStatus.items !== 'loading' && (
              <span className="text-xs text-gray-500 pl-1">{cacheStatus.items}</span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Section 4: Module Toggles */}
      <SectionCard
        title="Module Settings"
        onSave={() =>
          saveSection('modules', {
            modules: mods,
          })
        }
        saving={saving.modules}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-3 pr-6">Module</th>
                <th className="pb-3 pr-6">
                  <span className="flex items-center">
                    Enabled
                    <InfoTooltip text="Toggle whether this module is active and available for use." />
                  </span>
                </th>
                <th className="pb-3 pr-6">
                  <span className="flex items-center">
                    Auto Approve
                    <InfoTooltip text="When enabled, approved transactions are automatically pushed to QuickBooks without manual review." />
                  </span>
                </th>
                <th className="pb-3 pr-6">
                  <span className="flex items-center">
                    Require AI Review
                    <InfoTooltip text="When enabled, transactions must pass AI review before approval." />
                  </span>
                </th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MODULE_ROWS.map(({ key, label, available }) => {
                const mod = mods[key] || {};
                const enabled = !!mod.enabled;
                const autoApprove = !!mod.auto_approve;
                const requireAiReview = !!mod.require_ai_review;
                return (
                  <tr key={key} className={`relative ${!available ? 'opacity-50' : ''}`}>
                    <td className="py-3 pr-6 font-medium text-atd-dark">
                      <div className="flex items-center gap-2">
                        {label}
                        {!available && (
                          <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-6">
                      <Toggle
                        id={`mod-enabled-${key}`}
                        checked={enabled}
                        onChange={(v) => setNested(`modules.${key}.enabled`, v)}
                        disabled={!available}
                      />
                    </td>
                    <td className="py-3 pr-6">
                      <Toggle
                        id={`mod-auto-${key}`}
                        checked={autoApprove}
                        onChange={(v) => setNested(`modules.${key}.auto_approve`, v)}
                        disabled={!available || !enabled}
                      />
                    </td>
                    <td className="py-3 pr-6">
                      <Toggle
                        id={`mod-ai-${key}`}
                        checked={requireAiReview}
                        onChange={(v) => setNested(`modules.${key}.require_ai_review`, v)}
                        disabled={!available || !enabled}
                      />
                    </td>
                    <td className="py-3">
                      {enabled ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Disabled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Reset to Defaults */}
      <div className="bg-white rounded-xl shadow-sm px-6 py-5">
        <h2 className="text-base font-semibold text-atd-dark mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Reset all settings back to their original defaults. This cannot be undone.
        </p>
        <button
          onClick={() => setResetConfirm(true)}
          className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </button>
      </div>

      {/* Reset Confirmation Dialog */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-atd-dark">Reset all settings?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will overwrite all current settings with the original defaults. Your Google Sheet ID, AI configuration, and module toggles will all be reset. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setResetConfirm(false)}
                disabled={resetting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleResetToDefaults}
                disabled={resetting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resetting ? <LoadingSpinner size="sm" color="white" /> : <RotateCcw className="h-4 w-4" />}
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />
      )}
    </div>
  );
}
