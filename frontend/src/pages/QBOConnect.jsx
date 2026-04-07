import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, X, AlertCircle, ExternalLink } from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Toast from '../components/shared/Toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function getExpiryInfo(expiryStr) {
  if (!expiryStr) return { text: 'Unknown', color: 'text-gray-500', isExpired: false };
  const expiry = new Date(expiryStr);
  const now = new Date();
  const diffMs = expiry - now;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMs < 0) {
    const agoMins = Math.abs(diffMins);
    const text = agoMins < 60 ? `Expired ${agoMins}m ago` : `Expired ${Math.round(agoMins / 60)}h ago`;
    return { text, color: 'text-red-600', isExpired: true };
  }
  if (diffMins < 60) {
    return { text: `Expires in ${diffMins}m`, color: 'text-amber-600', isExpired: false };
  }
  const hours = Math.round(diffMins / 60);
  return { text: `Expires in ${hours}h`, color: 'text-green-600', isExpired: false };
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
                {status?.tokenExpiry ? (() => {
                  const expiry = getExpiryInfo(status.tokenExpiry);
                  return (
                    <span className={`text-sm font-medium ${expiry.color}`}>
                      {expiry.isExpired && <AlertCircle className="inline h-4 w-4 mr-1 align-text-bottom" />}
                      {formatDateTime(status.tokenExpiry)} — {expiry.text}
                    </span>
                  );
                })() : (
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
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}
