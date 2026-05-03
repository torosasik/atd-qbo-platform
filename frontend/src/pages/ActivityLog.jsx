import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Search, Filter, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/helpers';

const ACTIVITY_TYPES = [
  'PO_CREATED',
  'PO_UPDATED',
  'STATUS_CHANGE',
  'RULE_CHANGE',
  'SETTINGS_CHANGE',
  'SYNC_EVENT',
  'ERROR',
  'AI_ACTION',
];

/** Returns Tailwind badge classes for each activity type. */
function typeBadgeClass(type) {
  const map = {
    PO_CREATED: 'bg-green-100 text-green-800',
    PO_UPDATED: 'bg-blue-100 text-blue-800',
    STATUS_CHANGE: 'bg-yellow-100 text-yellow-800',
    RULE_CHANGE: 'bg-purple-100 text-purple-800',
    SETTINGS_CHANGE: 'bg-indigo-100 text-indigo-800',
    SYNC_EVENT: 'bg-cyan-100 text-cyan-800',
    ERROR: 'bg-red-100 text-red-800',
    AI_ACTION: 'bg-orange-100 text-orange-800',
  };
  return map[type] || 'bg-gray-100 text-gray-700';
}

const PAGE_SIZE = 50;

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);

  const fetchLogs = useCallback(async (currentOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: currentOffset,
      };
      if (typeFilter) params.type = typeFilter;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.endDate = end.toISOString();
      }
      if (search.trim()) params.search = search.trim();

      const res = await api.getActivityLogs(params);
      setEntries(res.data?.entries || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, startDate, endDate, search]);

  // Fetch on filter/offset change
  useEffect(() => {
    fetchLogs(offset);
  }, [fetchLogs, offset]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setOffset(0);
  }, [typeFilter, startDate, endDate, search]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchLogs(offset), 30000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchLogs, offset]);

  const handlePrev = () => setOffset((o) => Math.max(0, o - PAGE_SIZE));
  const handleNext = () => setOffset((o) => o + PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const hasNext = entries.length === PAGE_SIZE;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">Audit trail of all platform actions</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <Clock className="h-4 w-4" />
            Auto-refresh
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
          </label>
          <button
            onClick={() => fetchLogs(offset)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-atd-blue text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        {/* Type filter */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          >
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
            <Search className="h-3 w-3" /> Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, details, user..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
          />
        </div>

        {/* Clear filters */}
        {(typeFilter || startDate || endDate || search) && (
          <button
            onClick={() => { setTypeFilter(''); setStartDate(''); setEndDate(''); setSearch(''); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Timestamp</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Details</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No activity log entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass(entry.type)}`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{entry.action}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={entry.details}>
                      {entry.details || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{entry.user || 'system'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-500">
            Page {currentPage} · {entries.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={offset === 0 || loading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              onClick={handleNext}
              disabled={!hasNext || loading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
