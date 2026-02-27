import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import BatchPage from './pages/BatchPage';
import ReviewQueue from './pages/ReviewQueue';
import ExecutionMonitor from './pages/ExecutionMonitor';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/batches" element={<BatchPage />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/execution" element={<ExecutionMonitor />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
