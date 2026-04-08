import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SimpleLayout from './components/shared/SimpleLayout';
import LoadingSpinner from './components/shared/LoadingSpinner';

// Lazy load page components for better performance
const NewDashboard = lazy(() => import('./pages/NewDashboard'));
const HealthCheck = lazy(() => import('./pages/HealthCheck'));
const Help = lazy(() => import('./pages/Help'));
const AIChat = lazy(() => import('./pages/AIChat'));

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
    console.error('Route error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] text-center p-6">
          <div>
            <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-4">Failed to load this page. Please try refreshing.</p>
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
      <SimpleLayout>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<NewDashboard />} />
              <Route path="/health" element={<HealthCheck />} />
              <Route path="/help" element={<Help />} />
              <Route path="/ai-chat" element={<AIChat />} />
              {/* Catch-all: redirect unknown paths to Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </SimpleLayout>
    </BrowserRouter>
  );
}
