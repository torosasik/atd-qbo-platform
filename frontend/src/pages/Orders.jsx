import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Clipboard,
  Check,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  ChevronDown as ChevronDownIcon,
  X,
} from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Toast from '../components/shared/Toast';
import Toggle from '../components/shared/Toggle';

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

// Columns that are always visible and cannot be toggled off
const MANDATORY_COLUMNS = ['Order #', 'Item Name', 'Qty', 'SKU'];

const COL_PREFS_KEY = 'atd.orders.column_prefs.v1';

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

function CopyCell({ value }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(String(value || '')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <span className="group relative inline-flex items-center gap-1 max-w-[200px]">
      <span className="truncate">{value}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-atd-blue flex-shrink-0"
        title="Copy"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Clipboard className="h-3 w-3" />}
      </button>
    </span>
  );
}

function ColumnVisibilityDropdown({ headers, visible, mandatory, onToggle, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-64 max-h-80 overflow-y-auto"
    >
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-atd-dark">Columns</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-2 space-y-1">
        {headers.map((header) => {
          const isMandatory = mandatory.includes(header);
          const isVisible = visible.includes(header);
          return (
            <label
              key={header}
              className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 ${
                isMandatory ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <Toggle
                id={`col-${header}`}
                checked={isVisible}
                onChange={() => !isMandatory && onToggle(header)}
                disabled={isMandatory}
              />
              <span className="text-sm text-gray-700 truncate">{header}</span>
              {isMandatory && (
                <span className="ml-auto text-xs text-gray-400">Required</span>
              )}
            </label>
          );
        })}
      </div>
    </div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // UI state
  const [showFulfilled, setShowFulfilled] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const [poDropdownOpen, setPoDropdownOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState(null); // null = not yet loaded

  // Derived header keys for special columns
  const orderNumHeader = useMemo(() => findHeaderKey(headers, ['Order #', 'Order Number']), [headers]);
  const lineItemHeader = useMemo(() => findHeaderKey(headers, ['Line Item #', 'Line Item']), [headers]);
  const itemNameHeader = useMemo(() => findHeaderKey(headers, ['Item Name', 'Item Description']), [headers]);
  const qtyHeader = useMemo(() => findHeaderKey(headers, ['Qty', 'Quantity']), [headers]);
  const skuHeader = useMemo(() => findHeaderKey(headers, ['SKU']), [headers]);

  // Mandatory columns resolved to actual header names
  const mandatoryResolved = useMemo(() => {
    const candidates = [
      orderNumHeader,
      itemNameHeader,
      qtyHeader,
      skuHeader,
    ].filter(Boolean);
    return candidates;
  }, [orderNumHeader, itemNameHeader, qtyHeader, skuHeader]);

  // Load column prefs from localStorage once headers are known
  useEffect(() => {
    if (headers.length === 0) return;
    try {
      const saved = JSON.parse(localStorage.getItem(COL_PREFS_KEY) || 'null');
      if (Array.isArray(saved)) {
        // Ensure mandatory columns are always included
        const merged = [...new Set([...mandatoryResolved, ...saved.filter((h) => headers.includes(h))])];
        setVisibleCols(merged);
      } else {
        setVisibleCols(headers);
      }
    } catch {
      setVisibleCols(headers);
    }
  }, [headers, mandatoryResolved]);

  // Save column prefs
  useEffect(() => {
    if (visibleCols !== null) {
      localStorage.setItem(COL_PREFS_KEY, JSON.stringify(visibleCols));
    }
  }, [visibleCols]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, statusesRes] = await Promise.all([
        api.getOrders(),
        api.getOrderStatuses(),
      ]);
      const h = ordersRes?.data?.headers || [];
      const r = ordersRes?.data?.rows || [];
      const s = statusesRes?.data?.statuses || {};
      setHeaders(h);
      setRows(r);
      setStatuses(s);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered + sorted rows
  const displayRows = useMemo(() => {
    let result = rows;

    if (!showFulfilled) {
      result = result.filter((row) => {
        const key = buildStatusKey(
          orderNumHeader ? row[orderNumHeader] : '',
          lineItemHeader ? row[lineItemHeader] : ''
        );
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

  function handleSort(header) {
    if (sortKey === header) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(header);
      setSortDir('asc');
    }
  }

  function handleSelectAll(e) {
    if (e.target.checked) {
      setSelected(new Set(displayRows.map((_, i) => i)));
    } else {
      setSelected(new Set());
    }
  }

  function handleSelectRow(idx) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleBulkStatus(status) {
    const updates = [...selected].map((idx) => {
      const row = displayRows[idx];
      return {
        orderNumber: orderNumHeader ? row[orderNumHeader] : '',
        lineItem: lineItemHeader ? row[lineItemHeader] : '',
        status,
      };
    });
    try {
      await api.bulkSetOrderStatuses(updates);
      const next = { ...statuses };
      updates.forEach(({ orderNumber, lineItem, status: s }) => {
        next[buildStatusKey(orderNumber, lineItem)] = s;
      });
      setStatuses(next);
      setSelected(new Set());
      setToast({ message: `Marked ${updates.length} rows as ${status}`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to update statuses', type: 'error' });
    }
  }

  function handleCreatePOManual() {
    const selectedRows = [...selected].map((idx) => displayRows[idx]);
    navigate('/purchase-orders', { state: { prefillRows: selectedRows } });
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

  function toggleColumn(header) {
    setVisibleCols((prev) => {
      if (!prev) return prev;
      if (prev.includes(header)) {
        return prev.filter((h) => h !== header);
      }
      // Insert at original position
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

  const colsToShow = visibleCols || headers;
  const allSelected = displayRows.length > 0 && selected.size === displayRows.length;
  const someSelected = selected.size > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-6">
        <LoadingSpinner size="lg" color="atd-blue" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atd-dark">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {displayRows.length} row{displayRows.length !== 1 ? 's' : ''} from Google Sheets
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Show Fulfilled toggle */}
        <Toggle
          id="show-fulfilled"
          checked={showFulfilled}
          onChange={setShowFulfilled}
          label="Show Fulfilled"
        />

        {/* Column visibility */}
        <div className="relative">
          <button
            onClick={() => setColDropdownOpen((o) => !o)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Eye className="h-4 w-4" />
            Columns
            <ChevronDownIcon className="h-3 w-3" />
          </button>
          {colDropdownOpen && (
            <ColumnVisibilityDropdown
              headers={headers}
              visible={colsToShow}
              mandatory={mandatoryResolved}
              onToggle={toggleColumn}
              onClose={() => setColDropdownOpen(false)}
            />
          )}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center gap-2 bg-atd-blue/10 border border-atd-blue/30 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-atd-blue">{selected.size} selected</span>

            {/* Create PO dropdown */}
            <div className="relative">
              <button
                onClick={() => setPoDropdownOpen((o) => !o)}
                className="flex items-center gap-1 bg-atd-blue text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Create PO
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              {poDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-40">
                  <button
                    onClick={() => { setPoDropdownOpen(false); handleCreatePOManual(); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                  >
                    Manual
                  </button>
                  <button
                    onClick={() => { setPoDropdownOpen(false); handleCreatePOAuto(); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                  >
                    Automatic
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleBulkStatus('Received')}
              className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              Mark Received
            </button>
            <button
              onClick={() => handleBulkStatus('Fulfilled')}
              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Mark Fulfilled
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {/* Checkbox */}
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-atd-blue focus:ring-atd-blue"
                  />
                </th>
                {/* Status column */}
                <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">
                  Status
                </th>
                {/* Sheet columns */}
                {colsToShow.map((header) => (
                  <th
                    key={header}
                    className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort(header)}
                  >
                    <span className="flex items-center gap-1">
                      {header}
                      {sortKey === header ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={colsToShow.length + 2}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {rows.length === 0
                      ? 'No orders found. Configure your Google Sheet in Settings.'
                      : 'All orders are fulfilled. Toggle "Show Fulfilled" to see them.'}
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => {
                  const orderNum = orderNumHeader ? row[orderNumHeader] : '';
                  const lineItem = lineItemHeader ? row[lineItemHeader] : '';
                  const statusKey = buildStatusKey(orderNum, lineItem);
                  const rowStatus = statuses[statusKey] || 'Pending';
                  const isSelected = selected.has(idx);

                  return (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50'
                          : idx % 2 === 0
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-gray-50/50 hover:bg-gray-100/50'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(idx)}
                          className="rounded border-gray-300 text-atd-blue focus:ring-atd-blue"
                        />
                      </td>
                      <td className="px-3 py-2.5">
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
                          className="text-xs border-0 bg-transparent focus:ring-0 p-0 cursor-pointer"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <StatusBadge status={rowStatus} />
                      </td>
                      {colsToShow.map((header) => (
                        <td key={header} className="px-3 py-2.5 text-gray-700">
                          <CopyCell value={row[header] ?? ''} />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
