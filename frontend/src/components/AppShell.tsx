import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ModeToggle from './ModeToggle';

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 relative selection:bg-purple-100 selection:text-purple-900">
      {/* Background glowing blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob pointer-events-none"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000 pointer-events-none"></div>

      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="h-16 border-b border-white/50 bg-white dark:bg-slate-900/40 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-20 shadow-sm shadow-slate-200/50">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800 tracking-tight">Global Payouts & Treasury</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">USDC Ecosystem</span>
          </div>
          <ModeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-8 shadow-inner bg-white dark:bg-slate-900/30 backdrop-blur-[2px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
