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
    <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold tracking-tight">ArcTreasury</h1>
        <p className="text-xs text-gray-400 mt-0.5">Copilot v1.0</p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
               ${isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
            }
          >
            <span>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
        USDC Treasury Automation
      </div>
    </aside>
  );
}
