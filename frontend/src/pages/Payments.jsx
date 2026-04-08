import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  X,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  DollarSign,
} from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency, formatDateTime, generateId, getTodayDate } from '../utils/helpers';
import Toggle from '../components/shared/Toggle';
import LoadingSpinner from '../components/shared/LoadingSpinner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  const map = {
    success: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    draft: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700',
    flagged: 'bg-yellow-100 text-yellow-700',
    clean: 'bg-green-100 text-green-700',
    skipped: 'bg-gray-100 text-gray-500',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  const cls = map[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

const PAYMENT_METHODS = ['Cash', 'Check', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Wire Transfer', 'Other'];

// ---------------------------------------------------------------------------
// Pagination Controls Component
// ---------------------------------------------------------------------------
const PAGE_SIZE_OPTIONS = [10, 20, 50];

function PaginationControls({ page, pageSize, totalItems, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-100 text-sm">
      {/* Left: item count & page size selector */}
      <div className="flex items-center gap-3 text-gray-500">
        <span>
          {totalItems === 0
            ? '0 items'
            : `${startItem}–${endItem} of ${totalItems}`}
        </span>
        <span className="text-gray-300">|</span>
        <label className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-atd-blue"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer Combobox
// ---------------------------------------------------------------------------

function CustomerCombobox({ customers, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const s = search.toLowerCase();
    return customers.filter(
      (c) =>
        (c.DisplayName || '').toLowerCase().includes(s) ||
        (c.CompanyName || '').toLowerCase().includes(s)
    );
  }, [customers, search]);

  const selected = customers.find((c) => String(c.Id) === String(value));
  const displayLabel = selected ? selected.DisplayName || selected.CompanyName : '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-atd-blue focus:outline-none focus:ring-2 focus:ring-atd-blue disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={displayLabel ? 'text-gray-900' : 'text-gray-400'}>
          {displayLabel || 'Select customer…'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-atd-blue"
              />
            </div>
          </div>
          <ul className="overflow-y-auto max-h-48">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400 italic">No customers found</li>
            )}
            {filtered.map((c) => (
              <li
                key={c.Id}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                  String(c.Id) === String(value) ? 'bg-blue-50 font-medium text-atd-blue' : 'text-gray-700'
                }`}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setSearch('');
                }}
              >
                {c.DisplayName || c.CompanyName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Payments Component
// ---------------------------------------------------------------------------

export default function Payments() {
  const [tab, setTab] = useState('create');

  // Reference data
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  // Create form state
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [txnDate, setTxnDate] = useState(getTodayDate());
  const [memo, setMemo] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);

  // Open invoices for selected customer
  const [openInvoices, setOpenInvoices] = useState([]);
  const [openInvoicesLoading, setOpenInvoicesLoading] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState({}); // { invoiceId: { checked: bool, amount: number } }

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // Drafts
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftPage, setDraftPage] = useState(1);
  const [draftPageSize, setDraftPageSize] = useState(10);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);

  // ---------------------------------------------------------------------------
  // Load reference data
  // ---------------------------------------------------------------------------

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const data = await api.getCustomers();
      setCustomers(data.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // ---------------------------------------------------------------------------
  // Load open invoices when customer changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!customerId) {
      setOpenInvoices([]);
      setSelectedInvoices({});
      return;
    }

    let cancelled = false;
    const load = async () => {
      setOpenInvoicesLoading(true);
      try {
        const data = await api.getOpenInvoices(customerId);
        if (!cancelled) {
          setOpenInvoices(data.invoices || []);
          setSelectedInvoices({});
        }
      } catch (err) {
        console.error('Failed to load open invoices:', err);
        if (!cancelled) {
          setOpenInvoices([]);
        }
      } finally {
        if (!cancelled) setOpenInvoicesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [customerId]);

  // ---------------------------------------------------------------------------
  // Load drafts and history
  // ---------------------------------------------------------------------------

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const data = await api.getPaymentDrafts();
      setDrafts(data.drafts || []);
    } catch (err) {
      console.error('Failed to load payment drafts:', err);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getPaymentHistory();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to load payment history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'drafts') loadDrafts();
    if (tab === 'history') loadHistory();
  }, [tab, loadDrafts, loadHistory]);

  // ---------------------------------------------------------------------------
  // Invoice selection helpers
  // ---------------------------------------------------------------------------

  const handleInvoiceCheck = (invoiceId, checked) => {
    setSelectedInvoices((prev) => {
      const inv = openInvoices.find((i) => String(i.Id) === String(invoiceId));
      return {
        ...prev,
        [invoiceId]: {
          checked,
          amount: checked ? (prev[invoiceId]?.amount || inv?.Balance || 0) : 0,
        },
      };
    });
  };

  const handleInvoiceAmountChange = (invoiceId, amount) => {
    setSelectedInvoices((prev) => ({
      ...prev,
      [invoiceId]: {
        checked: true,
        amount: parseFloat(amount) || 0,
      },
    }));
  };

  const appliedTotal = useMemo(() => {
    return Object.values(selectedInvoices)
      .filter((v) => v.checked)
      .reduce((sum, v) => sum + (v.amount || 0), 0);
  }, [selectedInvoices]);

  const parsedTotalAmount = parseFloat(totalAmount) || 0;
  const unappliedAmount = Math.round((parsedTotalAmount - appliedTotal) * 100) / 100;

  // ---------------------------------------------------------------------------
  // Submit payment
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);

    const lines = Object.entries(selectedInvoices)
      .filter(([, v]) => v.checked && v.amount > 0)
      .map(([invoiceId, v]) => ({
        invoiceId,
        amount: Math.round(v.amount * 100) / 100,
      }));

    if (lines.length === 0) {
      setSubmitResult({ type: 'error', message: 'Please select at least one invoice to apply payment to.' });
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        customerId,
        customerName,
        totalAmount: parsedTotalAmount,
        lines,
        txnDate,
        memo,
        paymentMethod,
        referenceNumber,
        aiEnabled,
        autoApprove,
      };

      const result = await api.createPayment(payload);

      if (result.success) {
        const msg = result.draftId
          ? `Payment draft saved (ID: ${result.draftId}). Awaiting approval.`
          : `Payment created successfully in QuickBooks!${result.data?.Id ? ` (ID: ${result.data.Id})` : ''}`;

        setSubmitResult({ type: 'success', message: msg, data: result });

        // Reset form on success
        setCustomerId('');
        setCustomerName('');
        setTotalAmount('');
        setPaymentMethod('');
        setReferenceNumber('');
        setMemo('');
        setTxnDate(getTodayDate());
        setSelectedInvoices({});
        setOpenInvoices([]);
      } else {
        setSubmitResult({
          type: 'error',
          message: result.errors?.join(', ') || result.error || 'Failed to create payment.',
          data: result,
        });
      }
    } catch (err) {
      setSubmitResult({ type: 'error', message: err.message || 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Draft actions
  // ---------------------------------------------------------------------------

  const handleApproveDraft = async (draftId) => {
    setApprovingId(draftId);
    try {
      await api.approvePaymentDraft(draftId);
      loadDrafts();
    } catch (err) {
      setActionResult({ type: 'error', message: err.message || 'Approval failed.' });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectDraft = async (draftId) => {
    if (!confirm('Reject this payment draft?')) return;
    setRejectingId(draftId);
    setActionResult(null);
    try {
      await api.rejectPaymentDraft(draftId);
      setActionResult({ type: 'success', message: 'Draft rejected and removed.' });
      loadDrafts();
    } catch (err) {
      setActionResult({ type: 'error', message: err.message || 'Reject failed.' });
    } finally {
      setRejectingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Paginated data
  // ---------------------------------------------------------------------------

  const paginatedDrafts = useMemo(() => {
    const start = (draftPage - 1) * draftPageSize;
    return drafts.slice(start, start + draftPageSize);
  }, [drafts, draftPage, draftPageSize]);

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return history.slice(start, start + historyPageSize);
  }, [history, historyPage, historyPageSize]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tabs = [
    { id: 'create', label: 'Create New', icon: Plus },
    { id: 'drafts', label: 'Drafts', icon: AlertTriangle, count: drafts.length },
    { id: 'history', label: 'History', icon: CheckCircle },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Apply payments to open customer invoices</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white text-atd-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {count != null && count > 0 && (
              <span className="ml-1 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* CREATE TAB */}
      {/* ================================================================= */}
      {tab === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Result Banner */}
          {submitResult && (
            <div
              className={`p-4 rounded-lg border ${
                submitResult.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {submitResult.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{submitResult.message}</p>
                  {/* AI review warnings */}
                  {submitResult.data?.aiReview?.suggestions?.length > 0 && (
                    <ul className="mt-2 text-sm space-y-1">
                      {submitResult.data.aiReview.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-yellow-500 mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  {submitResult.data?.warnings?.length > 0 && (
                    <ul className="mt-2 text-sm space-y-1">
                      {submitResult.data.warnings.map((w, i) => (
                        <li key={i} className="text-yellow-700">⚠ {w}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" onClick={() => setSubmitResult(null)} className="ml-auto">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Top fields card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <CustomerCombobox
                  customers={customers}
                  value={customerId}
                  disabled={customersLoading}
                  onChange={(c) => {
                    setCustomerId(String(c.Id));
                    setCustomerName(c.DisplayName || c.CompanyName || '');
                  }}
                />
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                >
                  <option value="">Select method…</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Reference # */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference # (check #, etc.)</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g., Check #1234"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                />
              </div>

              {/* Memo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Memo</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Internal notes"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                />
              </div>
            </div>
          </div>

          {/* Open Invoices Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Open Invoices</h2>
              {customerId && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenInvoicesLoading(true);
                    api.getOpenInvoices(customerId)
                      .then((data) => {
                        setOpenInvoices(data.invoices || []);
                        setSelectedInvoices({});
                      })
                      .catch((err) => console.error(err))
                      .finally(() => setOpenInvoicesLoading(false));
                  }}
                  className="flex items-center gap-1 text-sm text-atd-blue hover:underline"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${openInvoicesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>

            {!customerId && (
              <div className="px-6 py-12 text-center text-gray-400">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a customer to view their open invoices</p>
              </div>
            )}

            {customerId && openInvoicesLoading && (
              <div className="px-6 py-12 flex justify-center">
                <LoadingSpinner size="md" color="atd-blue" />
              </div>
            )}

            {customerId && !openInvoicesLoading && openInvoices.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No open invoices for this customer</p>
              </div>
            )}

            {customerId && !openInvoicesLoading && openInvoices.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={
                              openInvoices.length > 0 &&
                              openInvoices.every((inv) => selectedInvoices[inv.Id]?.checked)
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const newSelected = {};
                              openInvoices.forEach((inv) => {
                                newSelected[inv.Id] = {
                                  checked,
                                  amount: checked ? inv.Balance : 0,
                                };
                              });
                              setSelectedInvoices(newSelected);
                            }}
                            className="rounded border-gray-300 text-atd-blue focus:ring-atd-blue"
                          />
                        </th>
                        <th className="px-6 py-3">Invoice #</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Due Date</th>
                        <th className="px-6 py-3 text-right">Total</th>
                        <th className="px-6 py-3 text-right">Balance</th>
                        <th className="px-6 py-3 text-right">Apply Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {openInvoices.map((inv) => {
                        const sel = selectedInvoices[inv.Id] || { checked: false, amount: 0 };
                        return (
                          <tr
                            key={inv.Id}
                            className={`${sel.checked ? 'bg-blue-50/40' : 'hover:bg-gray-50'} transition-colors`}
                          >
                            <td className="px-6 py-3">
                              <input
                                type="checkbox"
                                checked={sel.checked}
                                onChange={(e) => handleInvoiceCheck(inv.Id, e.target.checked)}
                                className="rounded border-gray-300 text-atd-blue focus:ring-atd-blue"
                              />
                            </td>
                            <td className="px-6 py-3 font-medium text-gray-900">
                              {inv.DocNumber || `#${inv.Id}`}
                            </td>
                            <td className="px-6 py-3 text-gray-500">{inv.TxnDate || '-'}</td>
                            <td className="px-6 py-3 text-gray-500">{inv.DueDate || '-'}</td>
                            <td className="px-6 py-3 text-right text-gray-700">
                              {formatCurrency(inv.TotalAmt)}
                            </td>
                            <td className="px-6 py-3 text-right font-medium text-gray-900">
                              {formatCurrency(inv.Balance)}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <div className="relative inline-block">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={inv.Balance}
                                  value={sel.checked ? sel.amount : ''}
                                  disabled={!sel.checked}
                                  onChange={(e) => handleInvoiceAmountChange(inv.Id, e.target.value)}
                                  className="w-28 pl-5 pr-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-atd-blue disabled:opacity-40 disabled:bg-gray-100"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Applied / Unapplied Summary */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">Payment Amount:</span>{' '}
                      <span className="font-semibold text-gray-900">{formatCurrency(parsedTotalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Applied:</span>{' '}
                      <span className="font-semibold text-green-700">{formatCurrency(appliedTotal)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Unapplied:</span>{' '}
                      <span className={`font-semibold ${unappliedAmount < 0 ? 'text-red-600' : unappliedAmount > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {formatCurrency(unappliedAmount)}
                      </span>
                      {unappliedAmount < 0 && (
                        <span className="ml-2 text-xs text-red-500">⚠ Over-applied</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Options & Submit */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-wrap items-center gap-6 mb-6">
              <Toggle
                label="AI Review"
                enabled={aiEnabled}
                onChange={setAiEnabled}
                description="Let AI review the payment before processing"
              />
              <Toggle
                label="Auto Approve"
                enabled={autoApprove}
                onChange={setAutoApprove}
                description="Skip draft step and push directly to QBO"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !customerId || !totalAmount}
              className="w-full sm:w-auto px-6 py-3 bg-atd-blue text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  Processing…
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4" />
                  {autoApprove ? 'Create Payment' : 'Submit for Review'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ================================================================= */}
      {/* DRAFTS TAB */}
      {/* ================================================================= */}
      {tab === 'drafts' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Pending Payment Drafts</h2>
            <button
              onClick={loadDrafts}
              disabled={draftsLoading}
              className="flex items-center gap-1.5 text-sm text-atd-blue hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${draftsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {draftsLoading ? (
            <div className="px-6 py-12 flex justify-center">
              <LoadingSpinner size="md" color="atd-blue" />
            </div>
          ) : paginatedDrafts.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending drafts</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3">Method</th>
                      <th className="px-6 py-3">Invoices</th>
                      <th className="px-6 py-3">AI Review</th>
                      <th className="px-6 py-3">Created</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedDrafts.map((draft) => {
                      const flagged = draft.aiReview?.flagged;
                      const lineCount = Array.isArray(draft.lines) ? draft.lines.length : 0;
                      const createdAt = draft.createdAt?._seconds
                        ? new Date(draft.createdAt._seconds * 1000).toISOString()
                        : draft.createdAt;
                      return (
                        <tr key={draft.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {draft.customerName || draft.customerId || '-'}
                          </td>
                          <td className="px-6 py-3 text-right text-gray-900 font-medium">
                            {formatCurrency(draft.totalAmount)}
                          </td>
                          <td className="px-6 py-3 text-gray-500">{draft.paymentMethod || '-'}</td>
                          <td className="px-6 py-3 text-gray-500">{lineCount} invoice{lineCount !== 1 ? 's' : ''}</td>
                          <td className="px-6 py-3">
                            <StatusBadge status={flagged ? 'flagged' : draft.aiReview ? 'clean' : 'skipped'} />
                          </td>
                          <td className="px-6 py-3 text-gray-500 text-xs">{formatDateTime(createdAt)}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveDraft(draft.id)}
                                disabled={approvingId === draft.id}
                                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                {approvingId === draft.id ? 'Approving…' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleRejectDraft(draft.id)}
                                disabled={rejectingId === draft.id}
                                className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                              >
                                {rejectingId === draft.id ? 'Rejecting…' : 'Reject'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={draftPage}
                pageSize={draftPageSize}
                totalItems={drafts.length}
                onPageChange={setDraftPage}
                onPageSizeChange={(size) => { setDraftPageSize(size); setDraftPage(1); }}
              />
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* HISTORY TAB */}
      {/* ================================================================= */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 text-sm text-atd-blue hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="px-6 py-12 flex justify-center">
              <LoadingSpinner size="md" color="atd-blue" />
            </div>
          ) : paginatedHistory.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No payment history yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3">QBO ID</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {entry.customerName || '-'}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-900 font-medium">
                          {entry.total != null ? formatCurrency(entry.total) : '-'}
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs font-mono">
                          {entry.qboEntityId || '-'}
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs">
                          {formatDateTime(entry.timestamp)}
                        </td>
                        <td className="px-6 py-3 text-red-500 text-xs max-w-xs truncate">
                          {entry.errorMessage || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={historyPage}
                pageSize={historyPageSize}
                totalItems={history.length}
                onPageChange={setHistoryPage}
                onPageSizeChange={(size) => { setHistoryPageSize(size); setHistoryPage(1); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
