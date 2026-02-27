import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ModeToggle from './ModeToggle';

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
          <span className="text-sm text-gray-500">Global Payouts & Treasury — USDC</span>
          <ModeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
