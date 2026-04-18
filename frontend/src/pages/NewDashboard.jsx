import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function formatDateTime(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

// --------------------------------------------------------------------------
// Status Pill
// --------------------------------------------------------------------------
function StatusPill({ label, status, color }) {
  const colors = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };
  const dot = colors[color] || colors.gray;

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}: {status}
    </span>
  );
}

// --------------------------------------------------------------------------
// Stat Card
// --------------------------------------------------------------------------
function StatCard({ label, value, loading, highlight = false }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      {loading ? (
        <LoadingSpinner size="sm" color="gray" />
      ) : (
        <p className={`text-3xl font-bold ${highlight ? 'text-red-600' : 'text-atd-dark'}`}>
          {value}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Dashboard
// --------------------------------------------------------------------------
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [stats, setStats] = useState({ openOrders: 0, todayCreated: 0, drafts: 0, failed: 0 });
  const [activities, setActivities] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setHealthChecking(true);
    try {
      const [healthRes, statsRes, ordersRes, activityRes] = await Promise.allSettled([
        api.getHealth(),
        api.getPoStats(),
        api.getOrders(),
        api.getActivityLogs({ limit: 5 }),
      ]);

      // Health
      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      }

      // PO Stats
      const poStats = statsRes.status === 'fulfilled' ? statsRes.value : {};
      let openOrders = 0;

      // Orders - count unfulfilled
      if (ordersRes.status === 'fulfilled') {
        const ordersData = ordersRes.value?.data || ordersRes.value || {};
        const rows = ordersData.rows || [];
        const headers = ordersData.headers || [];
        const statusIdx = headers.findIndex(
          (h) => h.toLowerCase().trim() === 'status'
        );
        if (statusIdx >= 0) {
          const statusKey = headers[statusIdx];
          openOrders = rows.filter((row) => {
            const s = (row[statusKey] || '').toString().toUpperCase().trim();
            return s !== 'FULFILLED' && s !== 'CANCELLED' && s !== 'CANCELED';
          }).length;
        } else {
          openOrders = rows.length;
        }
      }

      setStats({
        openOrders,
        todayCreated: poStats.todayCreated || 0,
        drafts: poStats.drafts || 0,
        failed: poStats.failed || 0,
      });

      // Activity logs
      if (activityRes.status === 'fulfilled') {
        const logs = activityRes.value?.data?.logs || activityRes.value?.logs || [];
        setActivities(logs.slice(0, 5));
      }
    } catch {
      // Errors are handled per-request above
    } finally {
      setLoading(false);
      setHealthChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive connection statuses from health response
  const qboConnected = health?.services?.qbo_api?.status === 'connected';
  const sheetsConnected = health?.services?.google_sheets?.status === 'connected';
  const aiActive =
    health?.services?.claude_api?.status === 'configured' ||
    health?.services?.claude_api?.status === 'connected' ||
    health?.services?.ollama?.status === 'connected';
  const aiBothUnconfigured =
    health?.services?.claude_api?.status === 'not_configured' &&
    health?.services?.ollama?.status === 'not_configured';
  const healthFailed = healthChecking ? false : !qboConnected && !sheetsConnected;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <h1 className="text-2xl font-bold text-atd-dark">Dashboard</h1>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Row 1: Connection status pills */}
          <div className="flex flex-wrap gap-3">
            <StatusPill
              label="QuickBooks"
              status={healthChecking ? 'Checking…' : qboConnected ? 'Connected' : 'Disconnected'}
              color={healthChecking ? 'gray' : qboConnected ? 'green' : 'red'}
            />
            <StatusPill
              label="Google Sheets"
              status={healthChecking ? 'Checking…' : sheetsConnected ? 'Connected' : 'Not configured'}
              color={healthChecking ? 'gray' : sheetsConnected ? 'green' : 'red'}
            />
            <StatusPill
              label="AI"
              status={healthChecking ? 'Checking…' : aiActive ? 'Active' : aiBothUnconfigured ? 'Off' : 'Unavailable'}
              color={healthChecking ? 'gray' : aiActive ? 'green' : 'gray'}
            />
          </div>

          {/* Row 2: Four stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Open Orders" value={stats.openOrders} loading={loading} />
            <StatCard label="POs Created Today" value={stats.todayCreated} loading={loading} />
            <StatCard label="Pending Drafts" value={stats.drafts} loading={loading} />
            <StatCard
              label="Failed POs"
              value={stats.failed}
              loading={loading}
              highlight={stats.failed > 0}
            />
          </div>

          {/* Row 3: Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-atd-dark">Recent Activity</h2>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" color="atd-blue" />
                </div>
              ) : activities.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-gray-400">No recent activity</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">Timestamp</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">Action</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activities.map((entry, idx) => (
                      <tr key={entry.id || idx} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                          {formatDateTime(entry.timestamp || entry.createdAt)}
                        </td>
                        <td className="px-6 py-3 text-gray-700">
                          {entry.action || entry.message || '-'}
                        </td>
                        <td className="px-6 py-3 text-gray-500">
                          {entry.type || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
