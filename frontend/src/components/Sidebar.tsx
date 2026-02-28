import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Zap, Bot, ClipboardList, Settings as SettingsIcon, Landmark } from 'lucide-react';
import AnimatedLogo from './AnimatedLogo';

const NAV = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/batches', label: 'Batches', icon: <Package size={18} /> },
  { to: '/execution', label: 'Execution', icon: <Zap size={18} /> },
  { to: '/agent', label: 'Copilot Agent', icon: <Bot size={18} /> },
  { to: '/treasury', label: 'Treasury & RWA', icon: <Landmark size={18} /> },
  { to: '/audit', label: 'Audit Log', icon: <ClipboardList size={18} /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-r border-white/60 dark:border-slate-800/60 shadow-2xl shadow-blue-900/5 flex flex-col min-h-screen relative z-20 transition-colors duration-500">
      <div className="px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <AnimatedLogo className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight transition-colors">ArcTreasury</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold tracking-wide transition-colors">Copilot v1.0</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-4 py-2 space-y-1.5">
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-2 transition-colors">Menu</div>
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group
               ${isActive
                ? 'bg-gradient-to-r from-cyan-50 to-purple-50 dark:from-cyan-900/40 dark:to-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/50 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent shadow-sm shadow-transparent hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50'}`
            }
          >
            <span className={`text-base transition-transform duration-200 group-hover:scale-110`}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium transition-colors">
            AI-powered USDC payouts, policy checks, and treasury automation on Arc.
          </p>
        </div>
      </div>
    </aside>
  );
}
