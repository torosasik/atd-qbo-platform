import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import useFeatures from '../../utils/useFeatures';
import { api } from '../../utils/api';
import { logActivity } from '../../utils/activityLogger';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'v0.1.0';
import {
  LayoutDashboard,
  ShoppingCart,
  MessageSquare,
  Settings,
  FileText,
  Receipt,
  CreditCard,
  Wallet,
  Menu,
  X,
  Link2,
  Activity,
  HelpCircle,
  Tags,
  ClipboardList,
  ListOrdered,
  Scale,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Navigation structure — grouped by workflow
// ---------------------------------------------------------------------------

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/orders', label: 'Orders', icon: ListOrdered, featureKey: 'sheets_import' },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, featureKey: 'purchase_orders' },
      { to: '/invoices', label: 'Invoices', icon: FileText, featureKey: 'invoices' },
      { to: '/bills', label: 'Bills', icon: Receipt, featureKey: 'bills' },
      { to: '/payments', label: 'Payments', icon: CreditCard, featureKey: 'payments' },
      { to: '/expenses', label: 'Expenses', icon: Wallet, featureKey: 'expenses' },
      { to: '/ai-chat', label: 'AI Chat', icon: MessageSquare, featureKey: 'ai_chat' },
    ],
  },
  {
    label: 'Setup',
    items: [
      { to: '/qbo-connect', label: 'QBO Connect', icon: Link2 },
      { to: '/rules', label: 'Business Rules', icon: Scale },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/activity-log', label: 'Activity Log', icon: ClipboardList },
      { to: '/health', label: 'System Health', icon: Activity },
      { to: '/help', label: 'Help & Docs', icon: HelpCircle },
    ],
  },
];

// ---------------------------------------------------------------------------
// Translate raw health errors into user-friendly business messages
// ---------------------------------------------------------------------------

const ERROR_TRANSLATIONS = {
  qbo: {
    match: /(qbo|quickbooks|token|oauth|realm)/i,
    message: 'QuickBooks is disconnected — PO creation and vendor lookups may fail.',
    action: 'Reconnect QuickBooks',
    link: '/qbo-connect',
  },
  sheets: {
    match: /(sheet|google sheets|spreadsheet)/i,
    message: 'Google Sheets connection issue — order imports are unavailable.',
    action: 'Check Settings',
    link: '/settings',
  },
  ai: {
    match: /(ollama|claude|ai service|ai provider)/i,
    message: 'AI review service is down — PO reviews will skip AI validation.',
    action: 'View Health',
    link: '/health',
  },
};

function translateHealthError(rawError, aiMode = 'cloud') {
  const errStr = typeof rawError === 'string' ? rawError : rawError?.message || '';
  if (aiMode === 'off' && ERROR_TRANSLATIONS.ai.match.test(errStr)) return null;
  if (aiMode === 'cloud' && /ollama/i.test(errStr)) return null;
  if (aiMode === 'ollama' && /(claude|api key)/i.test(errStr)) return null;
  for (const t of Object.values(ERROR_TRANSLATIONS)) {
    if (t.match.test(errStr)) return t;
  }
  return {
    message: 'A system service is experiencing issues.',
    action: 'View Details',
    link: '/health',
  };
}

// ---------------------------------------------------------------------------
// Global Health Banner — shown across all pages when system is unhealthy
// ---------------------------------------------------------------------------

function GlobalHealthBanner({ healthStatus, errors, aiMode, onDismiss }) {
  const navigate = useNavigate();
  if (!healthStatus || healthStatus === 'healthy' || healthStatus === 'ok') return null;

  const isUnhealthy = healthStatus === 'unhealthy';
  const translated = errors?.length ? translateHealthError(errors[0], aiMode) : null;
  if (errors?.length && !translated) return null;
  const bannerMsg = translated?.message || (isUnhealthy
    ? 'Critical services are down. Some features may not work correctly.'
    : 'Some services are degraded. Non-critical features may be limited.');

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
      isUnhealthy
        ? 'bg-red-50 border-b border-red-200 text-red-800'
        : 'bg-yellow-50 border-b border-yellow-200 text-yellow-800'
    }`}>
      {isUnhealthy
        ? <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
        : <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-500" />
      }
      <span className="flex-1 font-medium">{bannerMsg}</span>
      {translated?.link && (
        <button
          onClick={() => navigate(translated.link)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
            isUnhealthy
              ? 'bg-red-100 hover:bg-red-200 text-red-700'
              : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
          }`}
        >
          {translated.action}
        </button>
      )}
      <button
        onClick={onDismiss}
        className="ml-1 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarContent — grouped navigation
// ---------------------------------------------------------------------------

function SidebarContent({ onClose, features = {} }) {
  const filterItems = (items) =>
    items.filter(({ featureKey }) => {
      if (!featureKey) return true;
      return features[featureKey] !== false;
    });

  return (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-600">
        <div>
          <div className="text-white text-2xl font-bold leading-tight">ATD QBO</div>
          <div className="text-atd-silver text-xs mt-0.5">Control Panel</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Grouped nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = filterItems(group.items);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              {/* Group header — skip for first group to keep Dashboard prominent */}
              {gi > 0 && (
                <div className="px-3 mb-2 text-[10px] font-semibold text-gray-300 uppercase tracking-widest">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-atd-blue text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Sign Out + Version */}
      <div className="px-4 py-3 border-t border-gray-600 space-y-2">
        <button
          onClick={() => { const auth = getAuth(); signOut(auth); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
        <span className="text-xs text-gray-400 px-3">{APP_VERSION}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppLayout — main layout shell
// ---------------------------------------------------------------------------

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { features } = useFeatures();
  const navigate = useNavigate();
  
  // Session inactivity timeout — 24 hours
  // Note: setTimeout max delay is ~24.8 days; larger values fire immediately!
  const inactivityTimeout = useRef(null);
  const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  // Reset the inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeout.current) {
      clearTimeout(inactivityTimeout.current);
    }
    
    inactivityTimeout.current = setTimeout(() => {
      const auth = getAuth();
      signOut(auth)
        .then(() => {
          console.log('Session timed out due to inactivity');
          logActivity('USER_LOGOUT', 'User session timed out due to inactivity');
          navigate('/login');
        })
        .catch((error) => {
          console.error('Error signing out on inactivity timeout:', error);
          navigate('/login');
        });
    }, INACTIVITY_TIMEOUT_MS);
  }, [navigate]);
  
  // Initialize and track inactivity
  useEffect(() => {
    // Reset timer on initial mount
    resetInactivityTimer();
    
    // Event listener to reset timer on user activity
    const resetTimerOnActivity = () => {
      resetInactivityTimer();
    };
    
    // Listen for mouse movements and keyboard events
    const events = ['mousemove', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, resetTimerOnActivity, { passive: true });
    });
    
    // Cleanup event listeners and timer
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimerOnActivity);
      });
      if (inactivityTimeout.current) {
        clearTimeout(inactivityTimeout.current);
      }
    };
  }, [resetInactivityTimer]);

  // Global health check — lightweight poll
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthErrors, setHealthErrors] = useState([]);
  const [healthAiMode, setHealthAiMode] = useState('cloud');
  const [healthDismissed, setHealthDismissed] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealthStatus(data?.status || null);
      setHealthErrors(data?.errors || []);
      setHealthAiMode(data?.ai_mode || 'cloud');
      // Auto-show banner again if status changed to worse
      if (data?.status === 'unhealthy' || data?.status === 'degraded') {
        setHealthDismissed(false);
      }
    } catch {
      // Silent fail — don't block UI for health check
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 120_000); // Check every 2 minutes
    return () => clearInterval(id);
  }, [fetchHealth]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-atd-dark flex-shrink-0">
        <SidebarContent features={features} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-50 flex flex-col w-64 h-full bg-atd-dark shadow-xl">
            <SidebarContent onClose={() => setSidebarOpen(false)} features={features} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-atd-dark border-b border-gray-600">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-300 hover:text-white"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-white font-semibold text-base">ATD QBO Platform</span>
        </header>

        {/* Global health warning banner */}
        {!healthDismissed && (
          <GlobalHealthBanner
            healthStatus={healthStatus}
            errors={healthErrors}
            aiMode={healthAiMode}
            onDismiss={() => setHealthDismissed(true)}
          />
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
