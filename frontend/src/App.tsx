import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import BatchPage from './pages/BatchPage';
import ReviewQueue from './pages/ReviewQueue';
import ExecutionMonitor from './pages/ExecutionMonitor';
import AuditLog from './pages/AuditLog';
import AgentPage from './pages/AgentPage';
import Settings from './pages/Settings';
import AnimatedLogo from './components/AnimatedLogo';

function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50 transition-all duration-700 opacity-100">
      <div className="flex flex-col items-center gap-6 animate-pulse duration-1000">
        <div className="relative transform scale-125 mb-4">
          <AnimatedLogo />
        </div>
        <div className="text-center space-y-2 opacity-0 fade-in-up" style={{ animationDelay: '1.2s' }}>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 drop-shadow-sm">ArcTreasury <span className="text-slate-700">Copilot</span></h1>
          <p className="text-sm font-semibold text-slate-500 tracking-wide uppercase">AI-powered USDC Payouts</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // 3.0 seconds delay for the splash animation
    const timer1 = setTimeout(() => {
      setLoading(false);
    }, 3000);

    // allow exit animation to complete before removing from DOM
    const timer2 = setTimeout(() => {
      setShowSplash(false);
    }, 3700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <>
      {showSplash && (
        <div className={`transition-opacity duration-700 ${loading ? 'opacity-100' : 'opacity-0'}`}>
          <SplashScreen />
        </div>
      )}
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/batches" element={<BatchPage />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/execution" element={<ExecutionMonitor />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/agent" element={<AgentPage />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
