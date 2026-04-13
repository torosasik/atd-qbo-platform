import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Clipboard as ClipboardIcon,
  Check,
  ChevronUp,
  ChevronDown,
  Eye,
  X,
  Save,
  Package,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Toast from '../components/shared/Toast';
import Toggle from '../components/shared/Toggle';
import FuzzySearch from '../components/FuzzySearch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_STATUSES = ['Pending', 'Ordered', 'Received', 'Fulfilled'];

const STATUS_STYLES = {
  Pending:   'bg-gray-100 text-gray-600',
  Ordered:   'bg-blue-100 text-blue-700',
  Received:  'bg-orange-100 text-orange-700',
  Fulfilled: 'bg-green-100 text-green-700',
};

const SHIPPING_METHODS = [
  { value: '', label: 'Select...' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'drop_ship', label: 'Drop Ship' },
  { value: 'vendor_dropoff', label: 'Vendor Drop-off' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'other', label: 'Other' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'vendor_purchase', label: 'Vendor Purchase' },
];

const MANDATORY_COLUMNS = ['Order #', 'Item Name', 'Qty', 'SKU'];
const COL_PREFS_KEY = 'atd.orders.column_prefs.v1';
const ORDERS_CACHE_KEY = 'atd.orders.last_payload.v1';
const ORDERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PRIORITY_COPY_HEADERS = new Set([
  'sku',
  'item name',
  'item description',
  'vendor',
  'vendor name',
  'supplier',
  'order #',
  'order number',
  'line item #',
  'line item',
  'variant id',
  'continuation',
]);

const FIXED_COL_WIDTHS = {
  select: '44px',
  expand: '34px',
  status: '170px',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStatusKey(orderNumber, lineItem) {
  const base = String(orderNumber || '').trim();
  const line = String(lineItem || '').trim();
  return line ? `${base}_${line}` : base;
}

function findHeaderKey(headers = [], candidates = []) {
  const lower = headers.map((h) => ({ original: h, lower: h.toLowerCase().trim() }));
  for (const candidate of candidates) {
    const target = candidate.toLowerCase().trim();
    const match = lower.find((h) => h.lower === target);
    if (match) return match.original;
  }
  return null;
}

function isPriorityCopyHeader(header = '') {
  return PRIORITY_COPY_HEADERS.has(String(header).trim().toLowerCase());
}

function formatTimestamp(value) {
  if (!value) return null;
  try {
    const normalized = value?.toDate ? value.toDate() : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || 'Pending'}
    </span>
  );
}

function FulfillmentBadges({ fulfillment }) {
  if (!fulfillment) return null;
  const badges = [];
  if (fulfillment.source === 'in_stock') {
    badges.push(<span key="stock" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">In Stock</span>);
  } else if (fulfillment.source === 'vendor_purchase') {
    badges.push(<span key="vendor" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{fulfillment.vendorName || 'Vendor'}</span>);
  }
  if (fulfillment.received) {
    badges.push(<span key="recv" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Received</span>);
  }
  if (fulfillment.paid) {
    badges.push(<span key="paid" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Paid</span>);
  }
  if (fulfillment.trackingNumber) {
    badges.push(<span key="track" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Tracking</span>);
  }
  if (badges.length === 0) return null;
  return <div className="flex flex-wrap gap-1 mt-1">{badges}</div>;
}

function CopyCell({ value, enabled = false }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e) {
    e.stopPropagation();
    const text = String(value || '');
    const showFeedback = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    navigator.clipboard.writeText(text)
      .then(() => showFeedback())
      .catch(() => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          ta.style.top = '-9999px';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showFeedback();
        } catch (fallbackErr) {
          console.error('CopyCell: both clipboard APIs failed', fallbackErr);
        }
      });
  }
  return (
    <span className="group relative inline-flex items-center gap-1 max-w-full">
      <span className="truncate" title={value || ''}>{value}</span>
      {enabled && (
      <button
        onClick={handleCopy}
        className={`transition-opacity text-gray-400 hover:text-atd-blue flex-shrink-0 ${copied ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
        title={copied ? 'Copied' : 'Copy'}
        aria-label={copied ? 'Copied' : 'Copy value'}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <ClipboardIcon className="h-3 w-3" />}
      </button>
      )}
    </span>
  );
}

function ColumnVisibilityDropdown({ headers, visible, mandatory, onToggle, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-64 max-h-80 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-atd-dark">Columns</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-2 space-y-1">
        {headers.map((header) => {
          const isMandatory = mandatory.includes(header);
          const isVisible = visible.includes(header);
          return (
            <label key={header} className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 ${isMandatory ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <Toggle id={`col-${header}`} checked={isVisible} onChange={() => !isMandatory && onToggle(header)} disabled={isMandatory} />
              <span className="text-sm text-gray-700 truncate">{header}</span>
              {isMandatory && <span className="ml-auto text-xs text-gray-400">Required</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fulfillment Detail Panel
// ---------------------------------------------------------------------------

function FulfillmentPanel({ orderNumber, lineItem, fulfillment, onSave, saving }) {
  const [form, setForm] = useState({
    source: '',
    vendorName: '',
    orderDate: '',
    cost: '',
    shippingMethod: '',
    trackingNumber: '',
    received: false,
    receivedDate: '',
    poNumber: '',
    vendorInvoiceNumber: '',
    paid: false,
    paidDate: '',
    notes: '',
    ...fulfillment,
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, ...fulfillment }));
  }, [fulfillment]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(orderNumber, lineItem, form);
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-atd-blue focus:border-transparent';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border-t border-gray-200 px-6 py-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-4 w-4 text-atd-blue" />
        <h3 className="text-sm font-semibold text-atd-dark">Fulfillment Details</h3>
        <span className="text-xs text-gray-400">Order {orderNumber}{lineItem ? ` / Line ${lineItem}` : ''}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Source */}
        <div>
          <label className={labelCls}>Source</label>
          <select value={form.source} onChange={(e) => handleChange('source', e.target.value)} className={inputCls}>
            {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Vendor */}
        <div>
          <label className={labelCls}>Vendor Ordered From</label>
          <input type="text" value={form.vendorName} onChange={(e) => handleChange('vendorName', e.target.value)} placeholder="Vendor name" className={inputCls} />
        </div>

        {/* Order Date */}
        <div>
          <label className={labelCls}>Order Date</label>
          <input type="date" value={form.orderDate} onChange={(e) => handleChange('orderDate', e.target.value)} className={inputCls} />
        </div>

        {/* Cost */}
        <div>
          <label className={labelCls}>Cost</label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input type="number" step="0.01" value={form.cost} onChange={(e) => handleChange('cost', e.target.value)} placeholder="0.00" className={`${inputCls} pl-7`} />
          </div>
        </div>

        {/* Shipping Method */}
        <div>
          <label className={labelCls}>Shipping Method</label>
          <select value={form.shippingMethod} onChange={(e) => handleChange('shippingMethod', e.target.value)} className={inputCls}>
            {SHIPPING_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Tracking Number */}
        <div>
          <label className={labelCls}>Tracking Number</label>
          <input type="text" value={form.trackingNumber} onChange={(e) => handleChange('trackingNumber', e.target.value)} placeholder="Tracking #" className={inputCls} />
        </div>

        {/* PO Number */}
        <div>
          <label className={labelCls}>PO Number</label>
          <input type="text" value={form.poNumber} onChange={(e) => handleChange('poNumber', e.target.value)} placeholder="Our PO #" className={inputCls} />
        </div>

        {/* Vendor Invoice # */}
        <div>
          <label className={labelCls}>Vendor Invoice #</label>
          <input type="text" value={form.vendorInvoiceNumber} onChange={(e) => handleChange('vendorInvoiceNumber', e.target.value)} placeholder="Vendor invoice #" className={inputCls} />
        </div>

        {/* Received */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={labelCls}>Received</label>
            <Toggle id={`recv-${orderNumber}-${lineItem}`} checked={form.received} onChange={(v) => handleChange('received', v)} />
          </div>
          {form.received && (
            <div className="flex-1">
              <label className={labelCls}>Received Date</label>
              <input type="date" value={form.receivedDate} onChange={(e) => handleChange('receivedDate', e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        {/* Paid */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={labelCls}>Paid</label>
            <Toggle id={`paid-${orderNumber}-${lineItem}`} checked={form.paid} onChange={(v) => handleChange('paid', v)} />
          </div>
          {form.paid && (
            <div className="flex-1">
              <label className={labelCls}>Paid Date</label>
              <input type="date" value={form.paidDate} onChange={(e) => handleChange('paidDate', e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Additional notes..." rows={2} className={inputCls} />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-atd-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Fulfillment'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Orders() {
  const navigate = useNavigate();

  // Data
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [fulfillment, setFulfillment] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [savingFulfillment, setSavingFulfillment] = useState(false);

  // UI state
  const [showFulfilled, setShowFulfilled] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [expandedRow, setExpandedRow] = useState(null);
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const [poDropdownOpen, setPoDropdownOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState(null);
  const [searchState, setSearchState] = useState({
    indexes: null, resultCount: 0, hasClosestMatches: false, hasNoResults: false, query: '',
  });
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [ordersDataSource, setOrdersDataSource] = useState(null);

  // Derived header keys
  const orderNumHeader = useMemo(() => findHeaderKey(headers, ['Order #', 'Order Number']), [headers]);
  const lineItemHeader = useMemo(() => findHeaderKey(headers, ['Line Item #', 'Line Item']), [headers]);
  const itemNameHeader = useMemo(() => findHeaderKey(headers, ['Item Name', 'Item Description']), [headers]);
  const qtyHeader = useMemo(() => findHeaderKey(headers, ['Qty', 'Quantity']), [headers]);
  const skuHeader = useMemo(() => findHeaderKey(headers, ['SKU']), [headers]);
  const vendorHeader = useMemo(() => findHeaderKey(headers, ['Vendor', 'Vendor Name', 'Supplier']), [headers]);

  const mandatoryResolved = useMemo(() => {
    return [orderNumHeader, itemNameHeader, qtyHeader, skuHeader].filter(Boolean);
  }, [orderNumHeader, itemNameHeader, qtyHeader, skuHeader]);

  // Column prefs
  useEffect(() => {
    if (headers.length === 0) return;
    try {
      const saved = JSON.parse(localStorage.getItem(COL_PREFS_KEY) || 'null');
      if (Array.isArray(saved)) {
        const merged = [...new Set([...mandatoryResolved, ...saved.filter((h) => headers.includes(h))])];
        setVisibleCols(merged);
      } else {
        setVisibleCols(headers);
      }
    } catch { setVisibleCols(headers); }
  }, [headers, mandatoryResolved]);

  useEffect(() => {
    if (visibleCols !== null) localStorage.setItem(COL_PREFS_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, statusesRes, fulfillmentRes] = await Promise.all([
        api.getOrders(),
        api.getOrderStatuses(),
        api.getOrderFulfillment(),
      ]);
      const ordersData = ordersRes?.data || ordersRes || {};
      const nextHeaders = ordersData.headers || [];
      const nextRows = ordersData.rows || [];
      setHeaders(nextHeaders);
      setRows(nextRows);
      setStatuses(statusesRes?.data?.statuses || {});
      setFulfillment(fulfillmentRes?.data?.fulfillment || {});
      setLastSyncedAt(ordersData.lastSyncedAt || null);
      setOrdersDataSource(ordersData.source || null);
      localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify({
        headers: nextHeaders,
        rows: nextRows,
        lastSyncedAt: ordersData.lastSyncedAt || null,
        source: ordersData.source || 'live',
        cachedAt: new Date().toISOString(),
      }));
      if (ordersData.warning) {
        setToast({ message: ordersData.warning, type: 'error' });
      }
    } catch (err) {
      const cached = localStorage.getItem(ORDERS_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setHeaders(parsed.headers || []);
          setRows(parsed.rows || []);
          setLastSyncedAt(parsed.lastSyncedAt || null);
          setOrdersDataSource('stale-local-cache');
          let errMsg = 'Live pull failed. Showing last successful synced snapshot.';
          if (parsed.cachedAt) {
            const ageMs = Date.now() - new Date(parsed.cachedAt).getTime();
            if (ageMs > ORDERS_CACHE_TTL_MS) {
              errMsg += ' (cache is old — sync may have failed)';
            }
          }
          setError(errMsg);
        } catch {
          setError(err.message || 'Failed to load orders');
        }
      } else {
        setError(err.message || 'Failed to load orders');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered + sorted rows
  const baseRows = useMemo(() => {
    let result = rows;
    if (!showFulfilled) {
      result = result.filter((row) => {
        const key = buildStatusKey(orderNumHeader ? row[orderNumHeader] : '', lineItemHeader ? row[lineItemHeader] : '');
        return (statuses[key] || 'Pending') !== 'Fulfilled';
      });
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = String(a[sortKey] || '').toLowerCase();
        const bv = String(b[sortKey] || '').toLowerCase();
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [rows, statuses, showFulfilled, sortKey, sortDir, orderNumHeader, lineItemHeader]);

  const searchableRows = useMemo(() => {
    return baseRows.map((row, __index) => ({
      __index,
      row,
      productName: String(itemNameHeader ? row[itemNameHeader] ?? '' : ''),
      itemName: String(itemNameHeader ? row[itemNameHeader] ?? '' : ''),
      sku: String(skuHeader ? row[skuHeader] ?? '' : ''),
      orderNumber: String(orderNumHeader ? row[orderNumHeader] ?? '' : ''),
      lineItem: String(lineItemHeader ? row[lineItemHeader] ?? '' : ''),
      vendorName: String(vendorHeader ? row[vendorHeader] ?? '' : ''),
    }));
  }, [baseRows, itemNameHeader, skuHeader, orderNumHeader, lineItemHeader, vendorHeader]);

  const displayRows = useMemo(() => {
    if (!searchState.indexes) return baseRows;
    return searchState.indexes.map((idx) => searchableRows[idx]?.row).filter(Boolean);
  }, [baseRows, searchableRows, searchState]);

  // Reset selection/expansion when displayed row set changes (search/filter/sort)
  const prevDisplayRowsLengthRef = useRef();
  useEffect(() => {
    if (prevDisplayRowsLengthRef.current !== undefined && prevDisplayRowsLengthRef.current !== displayRows.length) {
      setSelected(new Set());
      setExpandedRow(null);
    }
    prevDisplayRowsLengthRef.current = displayRows.length;
  }, [displayRows.length]);

  const colsToShow = visibleCols || headers;

  const colWidths = useMemo(() => {
    const widths = {};
    colsToShow.forEach((header) => {
      const key = String(header || '').toLowerCase();
      if (key.includes('item')) widths[header] = '260px';
      else if (key.includes('vendor')) widths[header] = '180px';
      else if (key.includes('order')) widths[header] = '140px';
      else if (key.includes('sku') || key.includes('line item')) widths[header] = '130px';
      else if (key.includes('qty') || key.includes('quantity')) widths[header] = '90px';
      else widths[header] = '130px';
    });
    return widths;
  }, [colsToShow]);

  function handleSort(header) {
    if (sortKey === header) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(header); setSortDir('asc'); }
  }

  function handleSelectAll(e) {
    if (e.target.checked) setSelected(new Set(displayRows.map((_, i) => i)));
    else setSelected(new Set());
  }

  function handleSelectRow(idx) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function handleBulkStatus(status) {
    const updates = [...selected].map((idx) => {
      const row = displayRows[idx];
      return { orderNumber: orderNumHeader ? row[orderNumHeader] : '', lineItem: lineItemHeader ? row[lineItemHeader] : '', status };
    });
    try {
      await api.bulkSetOrderStatuses(updates);
      const next = { ...statuses };
      updates.forEach(({ orderNumber, lineItem, status: s }) => { next[buildStatusKey(orderNumber, lineItem)] = s; });
      setStatuses(next);
      setSelected(new Set());
      setToast({ message: `Marked ${updates.length} rows as ${status}`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to update statuses', type: 'error' });
    }
  }

  function handleCreatePOManual() {
    const selectedRows = [...selected].map((idx) => displayRows[idx]);
    navigate('/purchase-orders', { state: { prefillRows: selectedRows, headers } });
  }

  async function handleCreatePOAuto() {
    const selectedRows = [...selected].map((idx) => displayRows[idx]);
    try {
      await api.post('/purchase-orders/auto-create', { rows: selectedRows });
      setToast({ message: 'Auto-create PO submitted', type: 'success' });
      setSelected(new Set());
    } catch (err) {
      setToast({ message: err.message || 'Auto-create failed', type: 'error' });
    }
  }

  async function handleSaveFulfillment(orderNumber, lineItem, data) {
    setSavingFulfillment(true);
    try {
      await api.setOrderFulfillment(orderNumber, lineItem, data);
      const key = buildStatusKey(orderNumber, lineItem);
      setFulfillment((prev) => ({ ...prev, [key]: { ...prev[key], ...data } }));
      setToast({ message: 'Fulfillment saved', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to save fulfillment', type: 'error' });
    } finally {
      setSavingFulfillment(false);
    }
  }

  function toggleColumn(header) {
    setVisibleCols((prev) => {
      if (!prev) return prev;
      if (prev.includes(header)) return prev.filter((h) => h !== header);
      const idx = headers.indexOf(header);
      const next = [...prev];
      let insertAt = next.length;
      for (let i = idx - 1; i >= 0; i--) {
        const pos = next.indexOf(headers[i]);
        if (pos !== -1) { insertAt = pos + 1; break; }
      }
      next.splice(insertAt, 0, header);
      return next;
    });
  }

  const allSelected = displayRows.length > 0 && selected.size === displayRows.length;
  const someSelected = selected.size > 0;

  // Role-friendly cue: status summary counts
  const statusCounts = useMemo(() => {
    const counts = { Pending: 0, Ordered: 0, Received: 0, Fulfilled: 0 };
    rows.forEach((row) => {
      const key = buildStatusKey(
        orderNumHeader ? row[orderNumHeader] : '',
        lineItemHeader ? row[lineItemHeader] : ''
      );
      const s = statuses[key] || 'Pending';
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [rows, statuses, orderNumHeader, lineItemHeader]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-6 gap-3">
        <LoadingSpinner size="lg" color="atd-blue" />
        <p className="text-sm text-gray-400">Loading orders from Google Sheets…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header with role-friendly status summary */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-atd-dark">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {displayRows.length} row{displayRows.length !== 1 ? 's' : ''} from Google Sheets
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Last synced: {formatTimestamp(lastSyncedAt) || 'Not yet synced'}{ordersDataSource ? ` • Source: ${ordersDataSource}` : ''}
          </p>
          {/* Status summary badges */}
          {rows.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {statusCounts.Pending > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  {statusCounts.Pending} Pending
                </span>
              )}
              {statusCounts.Ordered > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {statusCounts.Ordered} Ordered
                </span>
              )}
              {statusCounts.Received > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  {statusCounts.Received} Received
                </span>
              )}
              {statusCounts.Fulfilled > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  {statusCounts.Fulfilled} Fulfilled
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={loadData} className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Error with actionable message */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm">
          <span className="flex-1">
            {/sheet/i.test(error)
              ? 'Could not load orders from Google Sheets. Check your sheet configuration in Settings.'
              : error}
          </span>
          <button onClick={loadData} className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-md transition-colors flex-shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Stale cache warning banner */}
      {ordersDataSource && ordersDataSource.includes('stale') && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-4 text-sm" role="alert">
          <p className="font-medium">⚠ Showing outdated cached data</p>
          <p className="text-xs mt-1">
            The latest data could not be loaded. Information may be up to {formatTimestamp(lastSyncedAt) || 'an unknown time'} old. Try refreshing later.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-start gap-3">
        <FuzzySearch items={searchableRows} totalCount={baseRows.length} onResultsChange={setSearchState} />
        <Toggle id="show-fulfilled" checked={showFulfilled} onChange={setShowFulfilled} label="Show Fulfilled" />

        {/* Column visibility */}
        <div className="relative">
          <button onClick={() => setColDropdownOpen((o) => !o)} className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <Eye className="h-4 w-4" /> Columns <ChevronDown className="h-3 w-3" />
          </button>
          {colDropdownOpen && (
            <ColumnVisibilityDropdown headers={headers} visible={colsToShow} mandatory={mandatoryResolved} onToggle={toggleColumn} onClose={() => setColDropdownOpen(false)} />
          )}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center gap-2 bg-atd-blue/10 border border-atd-blue/30 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-atd-blue">{selected.size} selected</span>
            <div className="relative">
              <button onClick={() => setPoDropdownOpen((o) => !o)} className="flex items-center gap-1 bg-atd-blue text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Create PO <ChevronDown className="h-3 w-3" />
              </button>
              {poDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-40">
                  <button onClick={() => { setPoDropdownOpen(false); handleCreatePOManual(); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors">Manual</button>
                  <button onClick={() => { setPoDropdownOpen(false); handleCreatePOAuto(); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors">Automatic</button>
                </div>
              )}
            </div>
            <button onClick={() => handleBulkStatus('Received')} className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">Mark Received</button>
            <button onClick={() => handleBulkStatus('Fulfilled')} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Mark Fulfilled</button>
            <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-700 transition-colors"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm table-fixed">
            <colgroup>
              <col style={{ width: FIXED_COL_WIDTHS.select }} />
              <col style={{ width: FIXED_COL_WIDTHS.expand }} />
              <col style={{ width: FIXED_COL_WIDTHS.status }} />
              {colsToShow.map((header) => (
                <col key={`col-${header}`} style={{ width: colWidths[header] }} />
              ))}
            </colgroup>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="w-10 px-3 py-3 text-left">
                  <input type="checkbox" checked={allSelected} onChange={handleSelectAll} className="rounded border-gray-300 text-atd-blue focus:ring-atd-blue" />
                </th>
                <th className="w-8 px-1 py-3"></th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Status</th>
                {colsToShow.map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort(header)}>
                    <span className="flex items-center gap-1">
                      {header}
                      {sortKey === header ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={colsToShow.length + 3} className="px-6 py-16 text-center">
                    {searchState.query ? (
                      <div className="space-y-2">
                        <p className="text-gray-500 font-medium">No matching orders</p>
                        <p className="text-sm text-gray-400">Try SKU, item name, vendor, order number, or line item.</p>
                      </div>
                    ) : rows.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-gray-500 font-medium">No orders found</p>
                        <p className="text-sm text-gray-400">
                          Orders are imported from Google Sheets. Make sure your sheet is configured in{' '}
                          <a href="/settings" className="text-atd-blue hover:underline font-medium">Settings</a>.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-gray-500 font-medium">All orders are fulfilled</p>
                        <p className="text-sm text-gray-400">
                          Toggle <strong>"Show Fulfilled"</strong> above to see completed orders.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => {
                  const orderNum = orderNumHeader ? row[orderNumHeader] : '';
                  const lineItem = lineItemHeader ? row[lineItemHeader] : '';
                  const statusKey = buildStatusKey(orderNum, lineItem);
                  const rowStatus = statuses[statusKey] || 'Pending';
                  const rowFulfillment = fulfillment[statusKey] || null;
                  const isSelected = selected.has(idx);
                  const isExpanded = expandedRow === idx;

                  return (
                    <>
                      <tr
                        key={`${orderNumHeader ? row[orderNumHeader] || idx : idx}-${lineItemHeader ? row[lineItemHeader] || idx : idx}`}
                        className={`group cursor-pointer ${
                          isSelected ? 'bg-blue-50' : isExpanded ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/50'
                        }`}
                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                      >
                        <td className="px-3 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(idx)} className="rounded border-gray-300 text-atd-blue focus:ring-atd-blue" />
                        </td>
                        <td className="px-1 py-2.5 align-top text-gray-400">
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </td>
                        <td className="px-3 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <select
                              value={rowStatus}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                try {
                                  await api.setOrderStatus(orderNum, lineItem, newStatus);
                                  setStatuses((prev) => ({ ...prev, [statusKey]: newStatus }));
                                } catch (err) {
                                  setToast({ message: err.message || 'Failed to update status', type: 'error' });
                                }
                              }}
                              className="text-xs border border-gray-200 rounded bg-white p-1 cursor-pointer"
                            >
                              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <StatusBadge status={rowStatus} />
                            <FulfillmentBadges fulfillment={rowFulfillment} />
                          </div>
                        </td>
                        {colsToShow.map((header) => (
                          <td key={`${idx}-${header}`} className="px-3 py-2.5 text-gray-700 align-top">
                            <CopyCell value={row[header] ?? ''} enabled={isPriorityCopyHeader(header)} />
                          </td>
                        ))}
                      </tr>

                      {isExpanded && (
                        <tr key={`expanded-${orderNumHeader ? row[orderNumHeader] || idx : idx}-${lineItemHeader ? row[lineItemHeader] || idx : idx}`}>
                          <td colSpan={colsToShow.length + 3} className="p-0">
                            <FulfillmentPanel
                              orderNumber={orderNum}
                              lineItem={lineItem}
                              fulfillment={rowFulfillment || {}}
                              onSave={handleSaveFulfillment}
                              saving={savingFulfillment}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}