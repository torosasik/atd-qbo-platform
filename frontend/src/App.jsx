import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/shared/AppLayout';
import LoadingSpinner from './components/shared/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

// Lazy load page components for better performance
const NewDashboard = lazy(() => import('./pages/NewDashboard'));
const HealthCheck = lazy(() => import('./pages/HealthCheck'));
const Help = lazy(() => import('./pages/Help'));
const AIChat = lazy(() => import('./pages/AIChat'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Settings = lazy(() => import('./pages/Settings'));
const QBOConnect = lazy(() => import('./pages/QBOConnect'));
const VendorManagement = lazy(() => import('./pages/VendorManagement'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Bills = lazy(() => import('./pages/Bills'));
const Payments = lazy(() => import('./pages/Payments'));
const Expenses = lazy(() => import('./pages/Expenses'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const Orders = lazy(() => import('./pages/Orders'));
const Rules = lazy(() => import('./pages/Rules'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" color="atd-blue" />
    </div>
  );
}

// Error boundary for lazy loaded routes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Route error:', errorMessage, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] text-center p-6">
          <div>
            <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-4">Failed to load this page. Please try refreshing.</p>
            {this.state.error && (
              <p className="text-xs text-gray-400 mb-4 font-mono break-all">
                {this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-atd-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            {/* Protected routes wrapped in AppLayout (sidebar) */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<NewDashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/ai-chat" element={<AIChat />} />
              <Route path="/qbo-connect" element={<QBOConnect />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/vendor-management" element={<VendorManagement />} />
              <Route path="/health" element={<HealthCheck />} />
              <Route path="/activity-log" element={<ActivityLog />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/help" element={<Help />} />
              {/* Catch-all: redirect unknown paths to Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
