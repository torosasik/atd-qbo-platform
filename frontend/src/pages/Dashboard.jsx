import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ShoppingCart,
  Brain,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function StatCard({ label, value, icon: Icon, iconColor, loading }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className="mt-2">
          {loading ? (
            <LoadingSpinner size="sm" color="gray" />
          ) : (
            <p className="text-3xl font-bold text-atd-dark">{value}</p>
          )}
        </div>
      </div>
      <div className={`p-2 rounded-lg ${iconColor}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    success: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    draft: 'bg-blue-100 text-blue-700',
  };
  const label = status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : 'Unknown';
  const cls = map[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function formatDateTime(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function isToday(ts) {
  if (!ts) return false;
  try {
    const d = new Date(ts);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemOk, setSystemOk] = useState(null);
  const [error, setError] = useState(null);
  const [healthWarning, setHealthWarning] = useState(null);
  const [healthDismissed, setHealthDismissed] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftsRes, historyRes, healthRes] = await Promise.all([
        api.getPoDrafts(),
        api.getPoHistory(),
        api.getHealth().catch(() => null),
      ]);
      setDrafts(Array.isArray(draftsRes.data ?? draftsRes) ? (draftsRes.data ?? draftsRes) : []);
      const histData = historyRes.history ?? historyRes.data?.history ?? [];
      setHistory(Array.isArray(histData) ? histData : []);
      setSystemOk(healthRes ? (healthRes.status === 'ok' || healthRes.status === 'healthy') : false);

      if (healthRes && (healthRes.status === 'unhealthy' || healthRes.status === 'degraded')) {
        setHealthWarning({
          status: healthRes.status,
          errors: healthRes.errors || [],
        });
        setHealthDismissed(false);
      } else {
        setHealthWarning(null);
      }
    } catch (err) {
      setSystemOk(false);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const todayHistory = history.filter((h) => isToday(h.createdAt || h.timestamp));
  const todayAiReviews = todayHistory.filter((h) => h.aiReview || h.ai_review);
  const recentActivity = history.slice(0, 10);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atd-dark">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">ATD QBO Platform Overview</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Health warning banner */}
      {healthWarning && !healthDismissed && (
        <div className={`mb-6 rounded-lg px-4 py-3 text-sm flex items-start justify-between ${
          healthWarning.status === 'unhealthy'
            ? 'bg-red-50 border border-red-300 text-red-700'
            : 'bg-yellow-50 border border-yellow-300 text-yellow-700'
        }`}>
          <div className="flex items-start gap-2 flex-1">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">
                System {healthWarning.status === 'unhealthy' ? 'Unhealthy' : 'Degraded'}
              </p>
              {healthWarning.errors.length > 0 && (
                <ul className="mt-1 list-disc list-inside">
                  {healthWarning.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => navigate('/health')}
                className="mt-1 underline text-sm font-medium hover:opacity-80"
              >
                View Details
              </button>
            </div>
          </div>
          <button
            onClick={() => setHealthDismissed(true)}
            className="ml-3 flex-shrink-0 hover:opacity-70"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Pending Drafts"
          value={drafts.length}
          icon={FileText}
          iconColor="bg-atd-blue"
          loading={loading}
        />
        <StatCard
          label="POs Today"
          value={todayHistory.length}
          icon={ShoppingCart}
          iconColor="bg-atd-blue-light"
          loading={loading}
        />
        <StatCard
          label="AI Reviews Today"
          value={todayAiReviews.length}
          icon={Brain}
          iconColor="bg-purple-500"
          loading={loading}
        />
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">System Status</p>
            <div className="mt-2 flex items-center gap-2">
              {loading ? (
                <LoadingSpinner size="sm" color="gray" />
              ) : systemOk === null ? (
                <span className="text-gray-400 text-sm">Checking...</span>
              ) : systemOk ? (
                <>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-base font-semibold text-green-700">Connected</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-base font-semibold text-red-700">Error</span>
                </>
              )}
            </div>
          </div>
          <div className={`p-2 rounded-lg ${systemOk === null ? 'bg-gray-400' : systemOk ? 'bg-green-500' : 'bg-red-500'}`}>
            {systemOk ? (
              <CheckCircle className="h-6 w-6 text-white" />
            ) : (
              <XCircle className="h-6 w-6 text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-atd-dark">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" color="atd-blue" />
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium mb-2">No activity yet</p>
              <p className="text-sm">Create your first Purchase Order to see activity here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Date / Time</th>
                  <th className="px-6 py-3">Module</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentActivity.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateTime(item.createdAt || item.timestamp)}
                    </td>
                    <td className="px-6 py-3 font-medium text-atd-dark">
                      {item.module || 'Purchase Order'}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {item.action || item.type || 'Create'}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-3 text-gray-500 max-w-xs truncate">
                      {item.qboEntityId
                        ? `QBO ID: ${item.qboEntityId}`
                        : item.details || item.error || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
