import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/batches', label: 'Batches', icon: '📦' },
  { to: '/review', label: 'Review Queue', icon: '🔍' },
  { to: '/execution', label: 'Execution', icon: '⚡' },
  { to: '/audit', label: 'Audit Log', icon: '📋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white/60 backdrop-blur-xl border-r border-white/60 shadow-2xl shadow-blue-900/5 flex flex-col min-h-screen relative z-20">
      <div className="px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 text-white font-bold text-xl drop-shadow-md">
            A
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">ArcTreasury</h1>
            <p className="text-xs text-slate-500 font-semibold tracking-wide">Copilot v1.0</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-4 py-2 space-y-1.5">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Menu</div>
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group
               ${isActive
                ? 'bg-gradient-to-r from-cyan-50 to-purple-50 text-purple-700 border border-purple-100 shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent shadow-sm shadow-transparent hover:shadow-slate-200/50'}`
            }
          >
            <span className={`text-base transition-transform duration-200 group-hover:scale-110`}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200/60 shadow-inner">
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            AI-powered USDC payouts, policy checks, and treasury automation on Arc.
          </p>
        </div>
      </div>
    </aside>
  );
}
