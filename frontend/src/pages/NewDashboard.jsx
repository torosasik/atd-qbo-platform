import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  FileText,
  History,
  Settings,
  Link2,
  Tags,
  Activity,
  HelpCircle,
  Plus,
  CheckCircle,
  X,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  Brain,
  Receipt,
  CreditCard,
  Wallet,
  Lock,
} from 'lucide-react';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Load PurchaseOrders for inline sections
import PurchaseOrders from './PurchaseOrders';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

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

function isToday(ts) {
  if (!ts) return false;
  try {
    const d = new Date(ts);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  } catch { return false; }
}

// --------------------------------------------------------------------------
// Dashboard Feature Box Component
// --------------------------------------------------------------------------
function DashboardBox({ icon: Icon, title, description, count, onClick, loading, accentColor = 'bg-atd-blue', disabled = false, badge = null }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative bg-white rounded-xl shadow-sm border text-left group transition-all ${
        disabled
          ? 'border-gray-200 opacity-80 cursor-not-allowed'
          : 'border-gray-100 hover:shadow-md hover:border-atd-blue/30'
      }`}
    >
      {disabled && (
        <div className="absolute inset-0 bg-white/55 flex items-center justify-center rounded-xl z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-semibold shadow-sm">
            <Lock className="h-3.5 w-3.5" />
            {badge || 'Coming Soon'}
          </div>
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${accentColor}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {loading ? (
            <LoadingSpinner size="sm" color="gray" />
          ) : count !== undefined ? (
            <span className="text-3xl font-bold text-atd-dark">{count}</span>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold text-atd-dark mb-1 group-hover:text-atd-blue transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2">{description}</p>
      </div>
    </button>
  );
}

// --------------------------------------------------------------------------
// Main Dashboard Component
// --------------------------------------------------------------------------
export default function Dashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemOk, setSystemOk] = useState(null);
  const [error, setError] = useState(null);
  const [healthWarning, setHealthWarning] = useState(null);
  const [healthDismissed, setHealthDismissed] = useState(false);

  // Data for overview stats
  const [stats, setStats] = useState({ drafts: 0, todayPOs: 0, todayAIReviews: 0 });
  const [aiStatus, setAiStatus] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftsRes, historyRes, healthRes, settingsRes] = await Promise.all([
        api.getPoDrafts().catch(() => ({ drafts: [] })),
        api.getPoHistory().catch(() => ({ history: [] })),
        api.getHealth().catch(() => null),
        api.getSettings().catch(() => null),
      ]);

      // AI status from settings
      if (settingsRes?.settings?.ai) {
        const ai = settingsRes.settings.ai;
        setAiStatus({
          enabled: ai.enabled !== false,
          ollamaEnabled: ai.ollama_enabled !== false,
          provider: ai.preferred_provider || 'auto',
        });
      }
      const drafts = Array.isArray(draftsRes.drafts) ? draftsRes.drafts : [];
      const history = Array.isArray(historyRes.history) ? historyRes.history : [];
      const todayHistory = history.filter((h) => isToday(h.createdAt || h.timestamp));
      const todayAiReviews = todayHistory.filter((h) => h.aiReview || h.ai_status);

      setStats({
        drafts: drafts.length,
        todayPOs: todayHistory.length,
        todayAIReviews: todayAiReviews.length,
      });
      setSystemOk(healthRes ? (healthRes.status === 'ok' || healthRes.status === 'healthy') : null);

      // Health warning banner for unhealthy/degraded status
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
    fetchStats();
  }, [fetchStats]);

  // Feature boxes configuration
  const featureBoxes = [
    {
      id: 'overview',
      icon: Activity,
      title: 'Overview',
      description: 'View platform stats, system health, and recent activity at a glance.',
      accentColor: 'bg-atd-blue',
    },
    {
      id: 'create-po',
      icon: Plus,
      title: 'Create PO',
      description: 'Create a new purchase order. Select vendor, add line items, and submit for approval or push directly to QuickBooks.',
      accentColor: 'bg-green-600',
    },
    {
      id: 'drafts',
      icon: FileText,
      title: 'Drafts',
      description: 'Review and approve pending purchase order drafts before they go to QuickBooks.',
      accentColor: 'bg-yellow-500',
    },
    {
      id: 'history',
      icon: History,
      title: 'History',
      description: 'See all purchase orders that have been pushed to QuickBooks with their status and details.',
      accentColor: 'bg-purple-500',
    },
    {
      id: 'import',
      icon: FileSpreadsheet,
      title: 'Import from Sheets',
      description: 'Import purchase orders from a Google Sheet. Configure your sheet mapping in settings first.',
      accentColor: 'bg-blue-500',
    },
    {
      id: 'vendors',
      icon: Tags,
      title: 'Vendor Mapping',
      description: 'Map and sync vendors between ATD and QuickBooks. Keep your vendor list up to date.',
      accentColor: 'bg-orange-500',
    },
    {
      id: 'qbo',
      icon: Link2,
      title: 'QBO Connect',
      description: 'Connect or disconnect your QuickBooks account. Check connection status and manage authentication.',
      accentColor: 'bg-indigo-500',
    },
    {
      id: 'ai-review',
      icon: Brain,
      title: 'AI Assistant',
      description: 'Use AI to review and validate your purchase orders before submitting. Get suggestions and flag potential issues.',
      accentColor: 'bg-pink-500',
    },
    {
      id: 'invoices',
      icon: FileText,
      title: 'Invoice Create',
      description: 'Create invoices with AI review.',
      accentColor: 'bg-emerald-600',
      route: '/invoices',
      comingSoon: true,
    },
    {
      id: 'bills',
      icon: Receipt,
      title: 'Bill Create',
      description: 'Manage vendor bills.',
      accentColor: 'bg-amber-600',
      route: '/bills',
      comingSoon: true,
    },
    {
      id: 'payments',
      icon: CreditCard,
      title: 'Payment Apply',
      description: 'Apply payments to invoices.',
      accentColor: 'bg-cyan-600',
      route: '/payments',
      comingSoon: true,
    },
    {
      id: 'expenses',
      icon: Wallet,
      title: 'Expense Categorize',
      description: 'AI-powered expense categorization.',
      accentColor: 'bg-rose-600',
      route: '/expenses',
      comingSoon: true,
    },
  ];

  // Render the selected section
  const renderSection = () => {
    if (!activeSection) return null;
    
    switch (activeSection) {
      case 'overview':
        return <OverviewSection stats={stats} systemOk={systemOk} aiStatus={aiStatus} loading={loading} onRefresh={fetchStats} onClose={() => setActiveSection(null)} onNavigate={setActiveSection} />;
      case 'create-po':
        return <CreatePOSection onClose={() => setActiveSection(null)} />;
      case 'drafts':
        return <DraftsSection onClose={() => setActiveSection(null)} />;
      case 'history':
        return <HistorySection onClose={() => setActiveSection(null)} />;
      case 'import':
        return <ImportSection onClose={() => setActiveSection(null)} />;
      case 'vendors':
        return <VendorMappingSection onClose={() => setActiveSection(null)} />;
      case 'qbo':
        return <QBOConnectSection onClose={() => setActiveSection(null)} />;
      case 'ai-review':
        return <AIChatSection onClose={() => setActiveSection(null)} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Header - Title left, Actions right */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-atd-dark">Dashboard</h1>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-3">
          <SettingsButton />
          <HelpButton />
        </div>
      </header>

      {/* Main Content - Either section or grid of boxes */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeSection ? (
          renderSection()
        ) : (
          <div className="max-w-6xl mx-auto">
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

            <p className="text-gray-500 text-sm mb-6">Select a feature below to get started.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {featureBoxes.map((box) => (
                <DashboardBox
                  key={box.id}
                  icon={box.icon}
                  title={box.title}
                  description={box.description}
                  loading={loading}
                  accentColor={box.accentColor}
                  disabled={Boolean(box.comingSoon)}
                  badge={box.comingSoon ? 'Coming Soon' : null}
                  onClick={() => {
                    if (box.comingSoon) return;
                    if (box.route) {
                      navigate(box.route);
                      return;
                    }
                    setActiveSection(box.id);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --------------------------------------------------------------------------
// Settings Button (top right)
// --------------------------------------------------------------------------
function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      api.getSettings()
        .then((r) => setSettings(r.settings))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  async function handleSave(key, value) {
    try {
      await api.updateSettings({ [key]: value });
      setSettings((s) => ({ ...s, [key]: value }));
    } catch (err) {
      console.error(err);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-500 hover:text-atd-blue hover:bg-gray-100 rounded-lg transition-colors"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-atd-dark">Settings</h2>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <LoadingSpinner size="lg" color="atd-blue" />
          ) : (
            <>
              <div>
                <h3 className="font-medium text-atd-dark mb-3">Google Sheets</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Sheet ID</label>
                    <input
                      type="text"
                      defaultValue={settings?.google_sheets?.po_sheet_id || ''}
                      onBlur={(e) => handleSave('google_sheets.po_sheet_id', e.target.value)}
                      placeholder="Enter Google Sheet ID"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Sheet Tab Name</label>
                    <input
                      type="text"
                      defaultValue={settings?.google_sheets?.po_sheet_tab || ''}
                      onBlur={(e) => handleSave('google_sheets.po_sheet_tab', e.target.value)}
                      placeholder="e.g., Sheet1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-atd-dark mb-3">AI Review</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Enable AI Review</span>
                  <button
                    onClick={() => handleSave('ai.enabled', !settings?.ai?.enabled)}
                    className={`w-12 h-6 rounded-full transition-colors ${settings?.ai?.enabled ? 'bg-atd-blue' : 'bg-gray-300'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings?.ai?.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Help Button (top right)
// --------------------------------------------------------------------------
function HelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-500 hover:text-atd-blue hover:bg-gray-100 rounded-lg transition-colors"
        title="User Guide"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-atd-dark">User Guide</h2>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="font-medium text-atd-dark mb-2">Getting Started</h3>
            <p className="text-sm text-gray-600">
              This platform connects ATD with QuickBooks for managing purchase orders. 
              Start by connecting your QuickBooks account, then create POs or import from Google Sheets.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-atd-dark mb-2">Workflow</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Connect QuickBooks in QBO Connect</li>
              <li>Create a PO or import from Sheets</li>
              <li>AI reviews and validates the PO</li>
              <li>Approve drafts or auto-push to QBO</li>
              <li>Track history and sync vendors</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium text-atd-dark mb-2">Tips</h3>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li>Enable AI Review in Settings for automatic validation</li>
              <li>Use Vendor Mapping to sync vendors from QBO</li>
              <li>Import from Sheets to bulk-create POs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Overview Section
// --------------------------------------------------------------------------
function OverviewSection({ stats, systemOk, aiStatus, loading, onRefresh, onClose, onNavigate }) {
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    api.getPoHistory()
      .then((res) => setRecentActivity((res.history || []).slice(0, 10)))
      .catch(() => {});
  }, []);

  // Build AI status label
  const aiLabel = (() => {
    if (!aiStatus) return null;
    if (!aiStatus.enabled) return 'AI Disabled';
    if (aiStatus.provider === 'claude-only') return 'Claude Only';
    if (aiStatus.provider === 'ollama-only') return aiStatus.ollamaEnabled ? 'Ollama Only' : 'Ollama Only (Disabled!)';
    // auto
    return aiStatus.ollamaEnabled ? 'Ollama Enabled (Auto)' : 'Claude Fallback (Ollama Off)';
  })();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardBox icon={FileText} title="Pending Drafts" description="" count={stats.drafts} accentColor="bg-atd-blue" onClick={() => onNavigate('drafts')} />
        <DashboardBox icon={ShoppingCart} title="POs Today" description="" count={stats.todayPOs} accentColor="bg-green-600" onClick={() => onNavigate('history')} />
        <DashboardBox icon={Brain} title="AI Reviews" description="" count={stats.todayAIReviews} accentColor="bg-purple-500" onClick={() => onNavigate('ai-review')} />
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
            {systemOk ? <CheckCircle className="h-6 w-6 text-white" /> : <XCircle className="h-6 w-6 text-white" />}
          </div>
        </div>
      </div>

      {/* AI Provider Status */}
      {aiLabel && (
        <div className="bg-white rounded-xl shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium text-atd-dark">AI Provider</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            !aiStatus.enabled
              ? 'bg-gray-100 text-gray-500'
              : aiStatus.ollamaEnabled
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
          }`}>
            <span className={`inline-block h-2 w-2 rounded-full ${
              !aiStatus.enabled ? 'bg-gray-400' : 'bg-green-500'
            }`} />
            {aiLabel}
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-atd-dark">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          {recentActivity.length === 0 ? (
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
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(item.createdAt || item.timestamp)}</td>
                    <td className="px-6 py-3 font-medium text-atd-dark">{item.module || 'Purchase Order'}</td>
                    <td className="px-6 py-3 text-gray-600">{item.action || item.type || 'Create'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'success' ? 'bg-green-100 text-green-700' :
                        item.status === 'error' ? 'bg-red-100 text-red-700' :
                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        item.status === 'draft' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>{item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-3 text-gray-500 max-w-xs truncate">
                      {item.qboEntityId
                        ? `QBO ID: ${item.qboEntityId}`
                        : item.vendorName || item.details || item.error || '-'}
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

// --------------------------------------------------------------------------
// Create PO Section
// --------------------------------------------------------------------------
function CreatePOSection({ onClose }) {
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [vLoading, setVLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getVendors().then((r) => { setVendors(r.vendors || []); setVLoading(false); }).catch(() => setVLoading(false)),
      api.getItems().then((r) => setItems(r.items || [])).catch(() => {}),
    ]);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>
      <PurchaseOrders vendors={vendors} qboVendors={vendors} items={items} vendorsLoading={vLoading} initialTab="create" />
    </div>
  );
}

// --------------------------------------------------------------------------
// Drafts Section
// --------------------------------------------------------------------------
function DraftsSection({ onClose }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPoDrafts();
      setDrafts(res.drafts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  async function handleApprove(draftId) {
    try {
      await api.approveDraft(draftId);
      await fetchDrafts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>
      
      <h2 className="text-xl font-semibold text-atd-dark mb-4">Pending Drafts</h2>
      {error && <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" color="atd-blue" /></div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No pending drafts.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Lines</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td className="px-6 py-3 font-medium text-atd-dark">{draft.vendorName || '-'}</td>
                    <td className="px-6 py-3 text-gray-500">{draft.txnDate || '-'}</td>
                    <td className="px-6 py-3 text-gray-500">{(draft.lines || []).length}</td>
                    <td className="px-6 py-3 font-medium">{formatCurrency((draft.lines || []).reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unitPrice) || 0), 0))}</td>
                    <td className="px-6 py-3 text-gray-500">{formatDateTime(draft.createdAt)}</td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleApprove(draft.id)}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// History Section
// --------------------------------------------------------------------------
function HistorySection({ onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPoHistory()
      .then((r) => setHistory(r.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>
      
      <h2 className="text-xl font-semibold text-atd-dark mb-4">PO History</h2>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" color="atd-blue" /></div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No history yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-6 py-3">Date/Time</th>
                  <th className="px-6 py-3">PO #</th>
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="px-6 py-3 text-gray-500">{formatDateTime(item.timestamp)}</td>
                    <td className="px-6 py-3 font-medium text-atd-dark">{item.poNumber || '-'}</td>
                    <td className="px-6 py-3 text-gray-600">{item.vendorName || '-'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Import from Sheets Section
// --------------------------------------------------------------------------
function ImportSection({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.testSheetConnection();
      setResult(r);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.importFromSheets();
      setResult(r);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>
      
      <h2 className="text-xl font-semibold text-atd-dark mb-4">Import from Google Sheets</h2>
      <p className="text-gray-500 mb-6">Import purchase orders from a configured Google Sheet. Make sure the Sheet ID is set in Settings.</p>
      
      {result && (
        <div className={`mb-4 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-300 text-green-700' : 'bg-red-50 border border-red-300 text-red-700'}`}>
          {result.success ? `Imported ${result.imported || 0} POs` : result.error}
        </div>
      )}
      
      <div className="flex gap-4">
        <button
          onClick={handleTest}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          Test Connection
        </button>
        <button
          onClick={handleImport}
          disabled={loading}
          className="px-4 py-2 bg-atd-blue text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? <LoadingSpinner size="sm" color="white" /> : 'Import POs'}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Vendor Mapping Section
// --------------------------------------------------------------------------
function VendorMappingSection({ onClose }) {
  const [mappings, setMappings] = useState({ vendors: [], last_synced: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api.getVendorMappings()
      .then((r) => setMappings(r.mappings || { vendors: [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await api.syncVendorMappings();
      const r = await api.getVendorMappings();
      setMappings(r.mappings || { vendors: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-atd-dark">Vendor Mapping</h2>
          <p className="text-sm text-gray-500">Last synced: {mappings.last_synced ? formatDateTime(mappings.last_synced) : 'Never'}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-atd-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync from QBO
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" color="atd-blue" /></div>
        ) : mappings.vendors.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No vendor mappings.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-6 py-3">Vendor Name</th>
                  <th className="px-6 py-3">QBO ID</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mappings.vendors.map((v, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-3 font-medium text-atd-dark">{v.name}</td>
                    <td className="px-6 py-3 text-gray-500">{v.qbo_id}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.active ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                        {v.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// QBO Connect Section
// --------------------------------------------------------------------------
function QBOConnectSection({ onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuthStatus()
      .then((r) => setStatus(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleConnect() {
    window.location.href = `${API_BASE_URL}/auth/connect`;
  }

  return (
    <div className="max-w-md mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>
      
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-atd-blue rounded-full flex items-center justify-center mx-auto mb-4">
          <Link2 className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-atd-dark">QuickBooks Integration</h2>
        <p className="text-gray-500 mt-2 mb-6">Connect your QuickBooks account</p>

        {loading ? (
          <LoadingSpinner size="lg" color="atd-blue" />
        ) : status?.connected ? (
          <div>
            <div className="flex items-center gap-2 justify-center mb-4">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-green-700 font-medium">Connected</span>
            </div>
            {status.realmId && <p className="text-sm text-gray-500 mb-4">Realm: {status.realmId}</p>}
            <button
              onClick={() => api.disconnectAuth().then(() => window.location.reload())}
              className="text-sm text-red-600 hover:underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="bg-atd-blue hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Connect to QuickBooks
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// AI Chat Section
// --------------------------------------------------------------------------
function AIChatSection({ onClose }) {
  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-atd-blue mb-4">
        <X className="h-4 w-4" /> Back to Dashboard
      </button>
      
      <h2 className="text-xl font-semibold text-atd-dark mb-4">AI Assistant</h2>
      <p className="text-gray-500 mb-6">The AI assistant is automatically enabled when creating purchase orders. It reviews and validates POs for potential issues before submission.</p>
      
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-500">AI chat interface is available at /ai-chat route.</p>
      </div>
    </div>
  );
}
