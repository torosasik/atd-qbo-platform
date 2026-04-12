import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Database,
  Link2,
  Brain,
  Cloud,
  Sheet,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

// ---------------------------------------------------------------------------
// Error translation — converts raw backend errors to business language
// ---------------------------------------------------------------------------

const ERROR_TRANSLATIONS = [
  {
    match: /(documentPath|resource path|qbo.*token|token.*status)/i,
    userMessage: 'QuickBooks connection setup is incomplete.',
    impact: 'Purchase orders, vendor lookups, and bills cannot be processed.',
    action: 'Go to QBO Connect to reconnect your QuickBooks account.',
    actionLink: '/qbo-connect',
    actionLabel: 'Reconnect QuickBooks',
  },
  {
    match: /(token.*expir|refresh.*token|oauth.*error|401.*unauthorized)/i,
    userMessage: 'QuickBooks access token has expired.',
    impact: 'All QuickBooks-dependent features are temporarily unavailable.',
    action: 'Refresh your QuickBooks connection to restore access.',
    actionLink: '/qbo-connect',
    actionLabel: 'Refresh Connection',
  },
  {
    match: /(vendor.*not found|no vendors|vendor.*empty)/i,
    userMessage: 'Vendor list could not be loaded from QuickBooks.',
    impact: 'PO creation will not have vendor selection available.',
    action: 'Check your QuickBooks connection and sync vendors.',
    actionLink: '/vendor-management',
    actionLabel: 'Sync Vendors',
  },
  {
    match: /(ollama|ai.*connect|ai.*unavail)/i,
    userMessage: 'AI review service is not available.',
    impact: 'PO and invoice reviews will proceed without AI validation.',
    action: 'Check AI service settings or try a different provider.',
    actionLink: '/settings',
    actionLabel: 'Check Settings',
  },
  {
    match: /(sheet|google.*sheet|spreadsheet)/i,
    userMessage: 'Google Sheets connection is not working.',
    impact: 'Order imports from your spreadsheet are unavailable.',
    action: 'Verify your Google Sheets configuration in settings.',
    actionLink: '/settings',
    actionLabel: 'Check Settings',
  },
  {
    match: /(claude|anthropic)/i,
    userMessage: 'Claude AI service is not responding.',
    impact: 'AI-powered reviews will fall back to the alternate provider if available.',
    action: 'Check your Claude API key in settings.',
    actionLink: '/settings',
    actionLabel: 'Check Settings',
  },
];

function translateError(rawError) {
  const errStr = typeof rawError === 'string' ? rawError : String(rawError);
  for (const t of ERROR_TRANSLATIONS) {
    if (t.match.test(errStr)) {
      return { ...t, rawError: errStr };
    }
  }
  return {
    userMessage: 'A service error occurred.',
    impact: 'Some platform features may be affected.',
    action: 'Review the technical details below and contact support if needed.',
    actionLink: null,
    actionLabel: null,
    rawError: errStr,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  connected:      { color: 'bg-green-500',  label: 'Connected',     textColor: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  configured:     { color: 'bg-green-500',  label: 'Configured',    textColor: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  unavailable:    { color: 'bg-yellow-400', label: 'Unavailable',   textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  degraded:       { color: 'bg-yellow-400', label: 'Degraded',      textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  disconnected:   { color: 'bg-gray-400',   label: 'Disconnected',  textColor: 'text-gray-600',   bgColor: 'bg-gray-50',   borderColor: 'border-gray-200' },
  not_configured: { color: 'bg-gray-400',   label: 'Not Configured',textColor: 'text-gray-600',   bgColor: 'bg-gray-50',   borderColor: 'border-gray-200' },
  error:          { color: 'bg-red-500',    label: 'Error',         textColor: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  unknown:        { color: 'bg-yellow-400', label: 'Unknown',       textColor: 'text-yellow-800', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
};

function statusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.error;
}

// ---------------------------------------------------------------------------
// ServiceCard — with user-friendly message for error states
// ---------------------------------------------------------------------------

function ServiceCard({ name, icon: Icon, service }) {
  if (!service) return null;
  const cfg = statusConfig(service.status);
  const isError = service.status === 'error' || service.status === 'disconnected';
  const [showTechnical, setShowTechnical] = useState(false);

  // Generate a user-friendly message for error states
  const friendlyMsg = isError && service.message
    ? translateError(service.message)
    : null;

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${cfg.borderColor} overflow-hidden`}>
      <div className="px-5 py-4 flex items-start gap-4">
        <div className={`flex-shrink-0 h-10 w-10 rounded-lg ${cfg.bgColor} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${cfg.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-atd-dark">{name}</h3>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.textColor}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
              {cfg.label}
            </span>
          </div>

          {/* User-friendly message for errors */}
          {friendlyMsg ? (
            <div>
              <p className="text-sm text-gray-700 font-medium">{friendlyMsg.userMessage}</p>
              <p className="text-xs text-gray-500 mt-0.5">{friendlyMsg.impact}</p>
              {/* Technical details disclosure */}
              <button
                onClick={() => setShowTechnical(!showTechnical)}
                className="flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showTechnical ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Technical details
              </button>
              {showTechnical && (
                <p className="text-xs text-gray-400 mt-1 font-mono break-all bg-gray-50 rounded px-2 py-1.5">
                  {friendlyMsg.rawError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">{service.message}</p>
          )}

          {/* Extra detail rows */}
          <div className="mt-2 space-y-1">
            {service.latency_ms != null && (
              <DetailRow label="Latency" value={`${service.latency_ms}ms`} />
            )}
            {service.realm_id && (
              <DetailRow label="Realm ID" value={service.realm_id} />
            )}
            {service.environment && (
              <DetailRow label="Environment" value={service.environment} />
            )}
            {service.token_expires_at && (
              <DetailRow
                label="Token expires"
                value={new Date(service.token_expires_at).toLocaleString()}
              />
            )}
            {service.url && (
              <DetailRow label="URL" value={service.url} />
            )}
            {service.model && (
              <DetailRow label="Model" value={service.model} />
            )}
            {service.models && service.models.length > 0 && (
              <DetailRow label="Models" value={service.models.join(', ')} />
            )}
            {service.sheet_id && (
              <DetailRow label="Sheet ID" value={service.sheet_id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="font-medium text-gray-400 w-24 flex-shrink-0">{label}</span>
      <span className="text-gray-600 truncate">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overall status banner — user-friendly top-line messages
// ---------------------------------------------------------------------------

function StatusBanner({ status }) {
  if (status === 'healthy') {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-300 text-green-800 rounded-xl px-5 py-4">
        <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
        <div>
          <p className="font-semibold">All Systems Operational</p>
          <p className="text-sm opacity-80">All services are running normally. You can use all platform features.</p>
        </div>
      </div>
    );
  }

  if (status === 'degraded') {
    return (
      <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-5 py-4">
        <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
        <div>
          <p className="font-semibold">Some Features Limited</p>
          <p className="text-sm opacity-80">Non-critical services are unavailable. Core order processing may still work, but some features like AI review are limited.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-300 text-red-800 rounded-xl px-5 py-4">
      <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
      <div>
        <p className="font-semibold">Action Required</p>
        <p className="text-sm opacity-80">Critical services are down. Resolve the issues below to restore full functionality.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actionable Error Card — replaces raw error list
// ---------------------------------------------------------------------------

function ActionableErrorCard({ errors }) {
  const navigate = useNavigate();
  if (!errors || errors.length === 0) return null;

  const translatedErrors = errors.map(translateError);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-orange-100 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <h2 className="text-sm font-semibold text-atd-dark">
          {errors.length} Action{errors.length > 1 ? 's' : ''} Required
        </h2>
      </div>
      <div className="divide-y divide-gray-50">
        {translatedErrors.map((err, i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{err.userMessage}</p>
                <p className="text-xs text-gray-500 mt-0.5">{err.impact}</p>
                <div className="flex items-center gap-3 mt-2">
                  {err.actionLink && (
                    <button
                      onClick={() => navigate(err.actionLink)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-atd-blue hover:text-blue-700 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {err.actionLabel}
                    </button>
                  )}
                  <TechnicalDetail rawError={err.rawError} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnicalDetail({ rawError }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Technical info
      </button>
      {open && (
        <p className="text-xs text-gray-400 font-mono break-all bg-gray-50 rounded px-2 py-1.5 mt-1">
          {rawError}
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const SERVICE_META = [
  { key: 'backend_api', name: 'Backend API', icon: Activity },
  { key: 'qbo_api', name: 'QuickBooks Connection', icon: Link2 },
  { key: 'ollama', name: 'AI Service (Ollama)', icon: Brain },
  { key: 'claude_api', name: 'AI Service (Claude)', icon: Cloud },
  { key: 'google_sheets', name: 'Google Sheets', icon: Sheet },
];

function buildUnknownHealth() {
  const unknownService = {
    status: 'unknown',
    message: 'Unknown (API unreachable)',
  };

  return {
    status: 'degraded',
    version: 'N/A',
    errors: ['Health API unreachable'],
    services: {
      backend_api: unknownService,
      qbo_api: unknownService,
      ollama: unknownService,
      claude_api: unknownService,
      google_sheets: unknownService,
    },
  };
}

export default function HealthCheck() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getHealth();
      const normalized = {
        ...data,
        services: {
          backend_api: data?.services?.backend_api || { status: 'connected', message: 'Backend API reachable' },
          ...data?.services,
        },
      };
      setHealth(normalized);
      setLastChecked(new Date());
      setLastRefreshed(new Date());
    } catch (err) {
      setLoadError(err.message || 'Failed to reach the health endpoint.');
      setHealth(buildUnknownHealth());
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh with visibility awareness
  useEffect(() => {
    fetchHealth();

    let intervalId = setInterval(fetchHealth, 60_000);

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalId);
        intervalId = null;
      } else {
        fetchHealth(); // Refresh immediately when tab becomes visible
        intervalId = setInterval(fetchHealth, 60_000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-atd-dark">System Health</h1>
          <p className="text-gray-500 text-sm mt-1">
            Live status of all connected services
            {lastChecked && (
              <span className="ml-2 inline-flex items-center gap-1 text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                Last checked {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 shadow-sm flex-shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Load error */}
      {loadError && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-300 text-red-800 rounded-xl px-5 py-4 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">
            Cannot reach the platform backend. This may mean the server is down or your network is disconnected.
          </span>
          <button
            onClick={fetchHealth}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !health && (
        <div className="flex flex-col items-center justify-center min-h-64 gap-3">
          <LoadingSpinner size="lg" color="atd-blue" />
          <p className="text-sm text-gray-400">Checking service status…</p>
        </div>
      )}

      {health && (
        <>
          {/* Overall status banner */}
          <StatusBanner status={health.status} />

          {/* Actionable errors — user-friendly with technical disclosure */}
          <ActionableErrorCard errors={health.errors} />

          {/* Service cards grid */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Service Details</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {SERVICE_META.map(({ key, name, icon }) => (
                <ServiceCard
                  key={key}
                  name={name}
                  icon={icon}
                  service={health.services?.[key]}
                />
              ))}
            </div>
          </div>

          {/* Meta footer */}
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>Version {health.version}</span>
            <span>
              {lastRefreshed
                ? <>Last refreshed: {lastRefreshed.toLocaleTimeString()}</>
                : 'Auto-refreshes every 60 seconds'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
