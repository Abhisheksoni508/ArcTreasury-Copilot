import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Zap, Bot, ClipboardList, Settings as SettingsIcon, Landmark, Menu } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(true);

  return (
    <aside className={`${expanded ? 'w-64' : 'w-[80px]'} bg-white/60 backdrop-blur-xl border-r border-white/60 shadow-2xl shadow-blue-900/5 flex flex-col min-h-screen relative z-20 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}>
      <div className="h-24 flex items-center relative overflow-hidden shrink-0">
        <div className={`flex items-center gap-3 pl-6 transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <AnimatedLogo className="w-full h-full" />
          </div>
          <div className="whitespace-nowrap">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">ArcTreasury</h1>
            <p className="text-xs text-slate-500 font-semibold tracking-wide">Copilot v1.0</p>
          </div>
        </div>

        <div className="absolute top-0 right-0 h-full flex items-center justify-center w-[80px]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm shadow-transparent hover:shadow-slate-200/50 outline-none"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1.5 transition-all duration-300 ${expanded ? 'px-4' : 'px-3'}`}>
        <div className={`text-xs font-bold text-slate-400 uppercase tracking-widest transition-all duration-300 whitespace-nowrap overflow-hidden ${expanded ? 'mb-4 h-4 opacity-100 px-2' : 'mb-0 h-0 opacity-0 px-0'}`}>
          Menu
        </div>
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            title={!expanded ? n.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${expanded ? 'px-3.5' : 'justify-center'} py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative
               ${isActive
                ? 'bg-gradient-to-r from-cyan-50 to-purple-50 text-purple-700 border border-purple-100 shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent shadow-sm shadow-transparent hover:shadow-slate-200/50'}`
            }
          >
            <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">{n.icon}</span>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'w-40 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
              {n.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className={`transition-all duration-300 overflow-hidden ${expanded ? 'h-32 opacity-100 px-5 pb-6' : 'h-0 opacity-0 px-5 pb-0'}`}>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200/60 shadow-inner h-full flex items-center justify-center">
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium text-center whitespace-normal">
            AI-powered USDC payouts, policy checks, and treasury automation on Arc.
          </p>
        </div>
      </div>
    </aside>
  );
}
