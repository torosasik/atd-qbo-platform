import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

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
} from 'lucide-react';

const mainNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/bills', label: 'Bills', icon: Receipt },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/ai-chat', label: 'AI Chat', icon: MessageSquare },
  { to: '/qbo-connect', label: 'QBO Connect', icon: Link2 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/vendor-management', label: 'Vendor Mapping', icon: Tags },
  { to: '/health', label: 'System Health', icon: Activity },
  { to: '/help', label: 'Help & Docs', icon: HelpCircle },
];

const comingSoonItems = [];

function SidebarContent({ onClose }) {
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

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-atd-blue text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}

        {/* Divider + Coming Soon section */}
        <div className="pt-4">
          <div className="border-t border-gray-600 mb-3" />
          <div className="px-3 mb-2 text-xs font-semibold text-atd-silver uppercase tracking-wider">
            Coming Soon
          </div>
          {comingSoonItems.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 flex-shrink-0" />
                {label}
              </div>
              <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                Soon
              </span>
            </div>
          ))}
        </div>
      </nav>

      {/* Version */}
      <div className="px-6 py-3 border-t border-gray-600">
        <span className="text-xs text-gray-500">{APP_VERSION}</span>
      </div>
    </div>
  );
}

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-atd-dark flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-50 flex flex-col w-64 h-full bg-atd-dark shadow-xl">
            <SidebarContent onClose={() => setSidebarOpen(false)} />
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
