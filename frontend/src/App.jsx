import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SimpleLayout from './components/shared/SimpleLayout';
import NewDashboard from './pages/NewDashboard';
import HealthCheck from './pages/HealthCheck';
import Help from './pages/Help';
import AIChat from './pages/AIChat';

export default function App() {
  return (
    <BrowserRouter>
      <SimpleLayout>
        <Routes>
          <Route path="/" element={<NewDashboard />} />
          <Route path="/health" element={<HealthCheck />} />
          <Route path="/help" element={<Help />} />
          <Route path="/ai-chat" element={<AIChat />} />
          {/* Catch-all: redirect unknown paths to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SimpleLayout>
    </BrowserRouter>
  );
}
