import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, X, AlertCircle, ExternalLink, Clock } from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Toast from '../components/shared/Toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Calculates detailed expiry information with color-coded thresholds:
 * - Green:  > 24 hours remaining
 * - Yellow: 1–24 hours remaining
 * - Red:    < 1 hour remaining (or expired)
 */
function getExpiryInfo(expiryStr) {
  if (!expiryStr) return { text: 'Unknown', color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200', badgeColor: 'bg-gray-100 text-gray-600', isExpired: false, level: 'unknown' };

  const expiry = new Date(expiryStr);
  const now = new Date();
  const diffMs = expiry - now;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMs < 0) {
    const agoMins = Math.abs(diffMins);
    let text;
    if (agoMins < 60) {
      text = `Expired ${agoMins}m ago`;
    } else if (agoMins < 1440) {
      text = `Expired ${Math.floor(agoMins / 60)}h ${agoMins % 60}m ago`;
    } else {
      const days = Math.floor(agoMins / 1440);
      const hours = Math.floor((agoMins % 1440) / 60);
      text = `Expired ${days}d ${hours}h ago`;
    }
    return { text, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', badgeColor: 'bg-red-100 text-red-700', isExpired: true, level: 'expired' };
  }

  const days = Math.floor(diffMins / 1440);
  const hours = Math.floor((diffMins % 1440) / 60);
  const mins = diffMins % 60;

  let text;
  if (days > 0) {
    text = `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    text = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  } else {
    text = `${mins} minute${mins !== 1 ? 's' : ''}`;
  }

  // Green: > 24h, Yellow: 1-24h, Red: < 1h
  if (diffMins > 1440) {
    return { text, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', badgeColor: 'bg-green-100 text-green-700', isExpired: false, level: 'healthy' };
  }
  if (diffMins > 60) {
    return { text, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', badgeColor: 'bg-amber-100 text-amber-700', isExpired: false, level: 'warning' };
  }
  return { text, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', badgeColor: 'bg-red-100 text-red-700', isExpired: false, level: 'critical' };
}

function formatDateTime(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
}

export default function QBOConnect() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // 'disconnect' | 'refresh'
  const [toast, setToast] = useState(null);
  const [connectionTest, setConnectionTest] = useState({ status: null, loading: false, message: '' });
  // Tick counter to force countdown re-render every 60s
  const [countdownTick, setCountdownTick] = useState(0);

  const dismissToast = useCallback(() => setToast(null), []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAuthStatus();
      setStatus(res.data ?? res);
    } catch (err) {
      setError(err.message || 'Failed to load connection status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    let intervalId = setInterval(fetchStatus, 60_000);

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalId);
        intervalId = null;
      } else {
        fetchStatus();
        intervalId = setInterval(fetchStatus, 60_000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Separate countdown ticker — updates the displayed countdown every 60s
  useEffect(() => {
    const tickId = setInterval(() => setCountdownTick((t) => t + 1), 60_000);
    return () => clearInterval(tickId);
  }, []);

  // Compute expiry info (recalculated every tick or when status changes)
  // eslint-disable-next-line no-unused-vars
  const _tick = countdownTick; // read so React tracks the dependency
  const expiryInfo = status?.tokenExpiry ? getExpiryInfo(status.tokenExpiry) : null;

  async function handleDisconnect() {
    setActionLoading('disconnect');
    try {
      await api.disconnectQBO();
      setToast({ message: 'Disconnected from QuickBooks.', type: 'success' });
      await fetchStatus();
    } catch (err) {
      setToast({ message: err.message || 'Failed to disconnect.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefreshToken() {
    setActionLoading('refresh');
    try {
      await api.refreshToken();
      setToast({ message: 'Token refreshed.', type: 'success' });
      await fetchStatus();
    } catch (err) {
      setToast({ message: err.message || 'Failed to refresh token.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTestConnection() {
    setConnectionTest({ status: null, loading: true, message: '' });
    try {
      const res = await api.getQboCompanyInfo();
      const company = res?.data ?? res;
      const companyName = company?.CompanyInfo?.CompanyName || company?.companyName || 'Company info retrieved';
      setConnectionTest({ status: 'ok', loading: false, message: `Success: ${companyName}` });
    } catch (err) {
      setConnectionTest({ status: 'error', loading: false, message: err.message || 'Connection test failed.' });
    }
  }

  const connected = status?.connected === true;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-atd-dark">QuickBooks Connection</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your QuickBooks Online OAuth connection</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-atd-dark">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 align-middle ${
              status == null ? 'bg-gray-400' : connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            Connection Status
          </h2>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-atd-blue transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" color="atd-blue" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-100 bg-gray-50">
              {connected ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Connected to QuickBooks</p>
                    <p className="text-xs text-gray-500 mt-0.5">OAuth token is active</p>
                  </div>
                </>
              ) : (
                <>
                  <X className="h-6 w-6 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Not Connected</p>
                    <p className="text-xs text-gray-500 mt-0.5">Connect to QuickBooks to enable API access</p>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                <span className="text-sm font-medium text-gray-700 sm:w-36 flex-shrink-0">Realm ID</span>
                <span className="text-sm text-gray-600 font-mono">
                  {status?.realmId || '(not connected)'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                <span className="text-sm font-medium text-gray-700 sm:w-36 flex-shrink-0">Token Expires</span>
                {expiryInfo ? (
                  <span className={`text-sm font-medium ${expiryInfo.color}`}>
                    {expiryInfo.isExpired && <AlertCircle className="inline h-4 w-4 mr-1 align-text-bottom" />}
                    {formatDateTime(status.tokenExpiry)} — {expiryInfo.text}
                  </span>
                ) : (
                  <span className="text-sm text-gray-600">(unavailable)</span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                <span className="text-sm font-medium text-gray-700 sm:w-36 flex-shrink-0">Last Refreshed</span>
                <span className="text-sm text-gray-600">
                  {status?.lastRefreshed ? formatDateTime(status.lastRefreshed) : '(unavailable)'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-900 space-y-2">
        <p className="font-semibold">Permissions requested during OAuth connect</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>QuickBooks Online accounting company data access</li>
          <li>Read and write access needed for invoices, bills, purchase orders, and payments</li>
          <li>Offline access for secure refresh tokens</li>
        </ul>
        <p className="text-blue-800">After connecting, your token will auto-refresh. You can check token status on the Settings page.</p>
      </div>

      {/* Token Expiry Countdown Banner */}
      {connected && !loading && expiryInfo && (
        <div className={`rounded-xl border p-4 ${expiryInfo.bgColor} shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${expiryInfo.badgeColor}`}>
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${expiryInfo.color}`}>
                {expiryInfo.isExpired ? 'Token Expired' : 'Expires in:'}
              </p>
              <p className={`text-lg font-bold ${expiryInfo.color} tracking-tight`}>
                {expiryInfo.text}
              </p>
            </div>
            {(expiryInfo.level === 'critical' || expiryInfo.level === 'expired') && (
              <button
                onClick={handleRefreshToken}
                disabled={actionLoading === 'refresh'}
                className="flex items-center gap-1.5 bg-white/80 hover:bg-white text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
              >
                {actionLoading === 'refresh' ? (
                  <LoadingSpinner size="sm" color="gray" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh Now
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2 ml-13">
            Updates every 60 seconds · Token auto-refreshes before expiry
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-atd-dark">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {!connected && (
            <a
              href={`${API_BASE_URL}/auth/connect`}
              className="flex items-center gap-2 bg-atd-blue hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Connect to QuickBooks
            </a>
          )}
          {connected && (
            <>
              <button
                onClick={handleTestConnection}
                disabled={connectionTest.loading}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {connectionTest.loading ? (
                  <LoadingSpinner size="sm" color="gray" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Test Connection
              </button>
              <button
                onClick={handleRefreshToken}
                disabled={actionLoading === 'refresh'}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {actionLoading === 'refresh' ? (
                  <LoadingSpinner size="sm" color="gray" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh Token
              </button>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading === 'disconnect'}
                className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {actionLoading === 'disconnect' ? (
                  <LoadingSpinner size="sm" color="gray" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Disconnect
              </button>
            </>
          )}
        </div>
        {connectionTest.status === 'ok' && (
          <p className="text-sm text-green-700">{connectionTest.message}</p>
        )}
        {connectionTest.status === 'error' && (
          <p className="text-sm text-red-700">{connectionTest.message}</p>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}
