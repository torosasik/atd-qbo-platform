import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { api, getErrorMessage } from '../utils/api';
import { getCached, setCache } from '../utils/dataCache';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import LoadingSpinner from '../components/shared/LoadingSpinner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }) {
  const map = {
    success: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  const cls = map[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  let cls = 'bg-gray-100 text-gray-600';
  if (pct >= 80) cls = 'bg-green-100 text-green-700';
  else if (pct >= 50) cls = 'bg-yellow-100 text-yellow-700';
  else cls = 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {pct}%
    </span>
  );
}

const TABS = [
  { key: 'uncategorized', label: 'Uncategorized' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'history', label: 'History' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function PaginationControls({ page, pageSize, totalItems, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-100 text-sm">
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
// Main Component
// ---------------------------------------------------------------------------

export default function Expenses() {
  const [activeTab, setActiveTab] = useState('uncategorized');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Uncategorized expenses
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categorizingId, setCategorizingId] = useState(null);
  const [manualSelections, setManualSelections] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Drafts
  const [drafts, setDrafts] = useState([]);
  const [processingDraftId, setProcessingDraftId] = useState(null);

  // History
  const [history, setHistory] = useState([]);

  // Pagination per tab
  const [uncatPage, setUncatPage] = useState(1);
  const [uncatPageSize, setUncatPageSize] = useState(20);
  const [draftPage, setDraftPage] = useState(1);
  const [draftPageSize, setDraftPageSize] = useState(20);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(20);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use cached accounts if available to avoid duplicate fetches
      const cachedAccounts = getCached('accounts');
      const expPromise = api.getUncategorizedExpenses();
      const acctPromise = cachedAccounts ? Promise.resolve(null) : api.getAccounts();

      const [expRes, acctRes] = await Promise.all([expPromise, acctPromise]);
      setExpenses(expRes.expenses || []);

      if (acctRes) {
        const accountList = acctRes.accounts || [];
        setCache('accounts', accountList);
        setAccounts(accountList);
      } else {
        setAccounts(cachedAccounts);
      }
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExpenseDrafts();
      setDrafts(res.drafts || []);
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExpenseHistory();
      setHistory(res.history || []);
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'uncategorized') fetchExpenses();
    else if (activeTab === 'drafts') fetchDrafts();
    else if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchExpenses, fetchDrafts, fetchHistory]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleAICategorize = async (expenseId) => {
    setCategorizingId(expenseId);
    setError(null);
    try {
      const res = await api.categorizeExpense(expenseId);
      setSuccessMsg(`AI suggested "${res.draft?.suggestedAccountName}" (${Math.round((res.draft?.confidence || 0) * 100)}% confidence)`);
      // Remove from uncategorized list and refresh drafts
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setCategorizingId(null);
    }
  };

  const handleManualCategorize = async (expenseId) => {
    const accountId = manualSelections[expenseId];
    if (!accountId) {
      setError('Please select an account first');
      return;
    }
    setCategorizingId(expenseId);
    setError(null);
    try {
      await api.categorizeExpense(expenseId, accountId);
      const acct = accounts.find((a) => a.id === accountId);
      setSuccessMsg(`Categorized as "${acct?.name || accountId}"`);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      setManualSelections((prev) => {
        const copy = { ...prev };
        delete copy[expenseId];
        return copy;
      });
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setCategorizingId(null);
    }
  };

  const handleApproveDraft = async (draftId) => {
    setProcessingDraftId(draftId);
    setError(null);
    try {
      const res = await api.approveExpenseDraft(draftId);
      setSuccessMsg(res.message || 'Draft approved and sent to QBO');
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setProcessingDraftId(null);
    }
  };

  const handleRejectDraft = async (draftId) => {
    setProcessingDraftId(draftId);
    setError(null);
    try {
      await api.rejectExpenseDraft(draftId);
      setSuccessMsg('Draft rejected');
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setProcessingDraftId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Filtered & paginated data
  // ---------------------------------------------------------------------------

  const filteredExpenses = searchTerm
    ? expenses.filter((e) => {
        const term = searchTerm.toLowerCase();
        return (
          (e.vendorName || '').toLowerCase().includes(term) ||
          (e.memo || '').toLowerCase().includes(term) ||
          String(e.totalAmount).includes(term)
        );
      })
    : expenses;

  const paginatedExpenses = filteredExpenses.slice(
    (uncatPage - 1) * uncatPageSize,
    uncatPage * uncatPageSize
  );

  const paginatedDrafts = drafts.slice(
    (draftPage - 1) * draftPageSize,
    draftPage * draftPageSize
  );

  const paginatedHistory = history.slice(
    (histPage - 1) * histPageSize,
    histPage * histPageSize
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Categorization</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered categorization of uncategorized expenses from QuickBooks
          </p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'uncategorized') fetchExpenses();
            else if (activeTab === 'drafts') fetchDrafts();
            else fetchHistory();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'uncategorized') fetchExpenses();
              else if (activeTab === 'drafts') fetchDrafts();
              else fetchHistory();
            }}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-atd-blue text-atd-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.key === 'uncategorized' && expenses.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">
                  {expenses.length}
                </span>
              )}
              {tab.key === 'drafts' && drafts.length > 0 && (
                <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
                  {drafts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" color="atd-blue" />
        </div>
      )}

      {/* ================================================================= */}
      {/* UNCATEGORIZED TAB */}
      {/* ================================================================= */}
      {!loading && !error && activeTab === 'uncategorized' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Search */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setUncatPage(1); }}
                placeholder="Search by vendor, memo, amount..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue/20 focus:border-atd-blue"
              />
            </div>
            <span className="text-sm text-gray-500">
              {filteredExpenses.length} uncategorized expense{filteredExpenses.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
              <p className="text-lg font-medium text-gray-500">All caught up!</p>
              <p className="text-sm mt-1">No uncategorized expenses found in QuickBooks.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Vendor</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-gray-600">
                          {exp.txnDate || '—'}
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {exp.vendorName}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-900">
                          {formatCurrency(exp.totalAmount)}
                        </td>
                        <td className="px-6 py-3 text-gray-500 max-w-xs truncate">
                          {exp.memo || exp.lines?.[0]?.description || '—'}
                        </td>
                        <td className="px-6 py-3">
                          <select
                            value={manualSelections[exp.id] || ''}
                            onChange={(e) => setManualSelections((prev) => ({ ...prev, [exp.id]: e.target.value }))}
                            className="w-full min-w-[180px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue/20 focus:border-atd-blue"
                          >
                            <option value="">Select category...</option>
                            {accounts.map((acct) => (
                              <option key={acct.id} value={acct.id}>
                                {acct.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleAICategorize(exp.id)}
                              disabled={categorizingId === exp.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                              title="AI suggest category"
                            >
                              {categorizingId === exp.id ? (
                                <LoadingSpinner size="xs" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                              AI Suggest
                            </button>
                            {manualSelections[exp.id] && (
                              <button
                                onClick={() => handleManualCategorize(exp.id)}
                                disabled={categorizingId === exp.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-atd-blue text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                title="Apply selected category"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Apply
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={uncatPage}
                pageSize={uncatPageSize}
                totalItems={filteredExpenses.length}
                onPageChange={setUncatPage}
                onPageSizeChange={(size) => { setUncatPageSize(size); setUncatPage(1); }}
              />
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* DRAFTS TAB */}
      {/* ================================================================= */}
      {!loading && !error && activeTab === 'drafts' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {drafts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium text-gray-500">No pending drafts</p>
              <p className="text-sm mt-1">Categorize expenses from the Uncategorized tab to create drafts.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Vendor</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3">AI Suggestion</th>
                      <th className="px-6 py-3 text-center">Confidence</th>
                      <th className="px-6 py-3">Source</th>
                      <th className="px-6 py-3">Reasoning</th>
                      <th className="px-6 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedDrafts.map((draft) => (
                      <tr key={draft.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-gray-600">
                          {draft.txnDate || '—'}
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {draft.vendorName}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-900">
                          {formatCurrency(draft.totalAmount)}
                        </td>
                        <td className="px-6 py-3 text-gray-700 font-medium">
                          {draft.suggestedAccountName || '(none)'}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <ConfidenceBadge confidence={draft.confidence} />
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            draft.source === 'ai'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {draft.source === 'ai' ? '🤖 AI' : '👤 Manual'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-500 max-w-xs truncate" title={draft.reasoning}>
                          {draft.reasoning || '—'}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleApproveDraft(draft.id)}
                              disabled={processingDraftId === draft.id || !draft.suggestedAccountId}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                              title="Approve and push to QBO"
                            >
                              {processingDraftId === draft.id ? (
                                <LoadingSpinner size="xs" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectDraft(draft.id)}
                              disabled={processingDraftId === draft.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                              title="Reject this categorization"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
      {!loading && !error && activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium text-gray-500">No history yet</p>
              <p className="text-sm mt-1">Approved categorizations will appear here.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Vendor</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3">Applied Category</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-gray-600">
                          {item.expenseId || '—'}
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {item.vendorName || '—'}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-900">
                          {item.total ? formatCurrency(item.total) : '—'}
                        </td>
                        <td className="px-6 py-3 text-gray-700 font-medium">
                          {item.accountName || '—'}
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                          {item.timestamp ? formatDateTime(item.timestamp) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={histPage}
                pageSize={histPageSize}
                totalItems={history.length}
                onPageChange={setHistPage}
                onPageSizeChange={(size) => { setHistPageSize(size); setHistPage(1); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
