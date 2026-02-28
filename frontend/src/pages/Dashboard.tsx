import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Banknote, Receipt, CheckCircle, XCircle } from 'lucide-react';
import { listBatches, getHealth, listExecutions, getTreasuryBalance } from '../api';
import type { Batch, HealthResponse, PayoutItem, WalletBalanceResponse } from '../types';
import StatusBadge from '../components/StatusBadge';
import AnimatedNumber from '../components/AnimatedNumber';

export default function Dashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [executions, setExecutions] = useState<PayoutItem[]>([]);
  const [walletBalance, setWalletBalance] = useState<WalletBalanceResponse | null>(null);
  const [balanceError, setBalanceError] = useState('');
  const [error, setError] = useState('');
  const nav = useNavigate();

  const fetchData = useCallback(async () => {
    setBalanceError('');
    setError('');
    try {
      const results = await Promise.allSettled([
        getHealth(),
        listBatches(),
        listExecutions(),
        getTreasuryBalance()
      ]);

      if (results[0].status === 'fulfilled') setHealth(results[0].value);
      else setError('Backend unavailable — start the FastAPI server on port 8000');

      if (results[1].status === 'fulfilled') setBatches(results[1].value);
      if (results[2].status === 'fulfilled') setExecutions(results[2].value);

      if (results[3].status === 'fulfilled') {
        setWalletBalance(results[3].value);
      } else {
        setBalanceError(results[3].reason instanceof Error ? results[3].reason.message : 'Unable to load treasury balance');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handleModeChange = () => fetchData();
    window.addEventListener('adapterModeChanged', handleModeChange);
    return () => window.removeEventListener('adapterModeChanged', handleModeChange);
  }, [fetchData]);

  const totalVolume = batches.reduce((s, b) => s + b.total_amount, 0);
  const totalItems = batches.reduce((s, b) => s + b.item_count, 0);
  const settled = executions.filter(e => e.execution_status === 'SETTLED').length;
  const failed = executions.filter(e => e.execution_status === 'FAILED').length;
  const usdcBalance = walletBalance?.balances.find((b) => b.token.symbol === 'USDC' || b.token.symbol === 'USD');

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-1 font-medium">Overview of your treasury and payout operations.</p>
        </div>
        {health && (
          <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white shadow-sm">
            <span className="text-xs text-emerald-600 flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
              Backend {health.status} — {health.adapter_mode.toUpperCase()} mode
            </span>
            <span className="w-px h-5 bg-slate-200" />
            <span className={`text-xs px-3 py-1.5 rounded-xl font-bold shadow-sm ${health.circle_configured
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
              Circle {health.circle_configured ? (health.circle_sandbox ? 'Sandbox' : 'Live') : 'Not Configured'}
            </span>
            <span className={`text-xs px-3 py-1.5 rounded-xl font-bold shadow-sm ${health.arc_configured
              ? 'bg-purple-50 text-purple-700 border border-purple-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
              Arc {health.arc_configured ? 'Ready' : 'Not Configured'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50/80 backdrop-blur-sm border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl shadow-sm flex items-center gap-3">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-5">
        <StatCard label="Total Batches" value={batches.length} icon={<Package size={24} className="text-blue-500" />} />
        <StatCard label="Total Volume" value={`$${totalVolume.toLocaleString()}`} icon={<Banknote size={24} className="text-emerald-500" />} />
        <StatCard label="Total Items" value={totalItems} icon={<Receipt size={24} className="text-purple-500" />} />
        <StatCard label="Items Settled" value={settled} color="text-emerald-600" bg="bg-emerald-50/50" icon={<CheckCircle size={24} className="text-emerald-600" />} />
        <StatCard label="Items Failed" value={failed} color="text-rose-600" bg="bg-rose-50/50" icon={<XCircle size={24} className="text-rose-600" />} />
      </div>

      {/* Main Treasury Card - Updated to match image gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 rounded-3xl shadow-xl shadow-blue-900/10 border border-white/20 p-8">
        {/* Subtle glass overlays */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full mix-blend-overlay filter blur-2xl transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full mix-blend-overlay filter blur-2xl transform -translate-x-1/3 translate-y-1/3"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-cyan-50 text-xs font-extrabold tracking-widest uppercase mb-1 flex items-center gap-2 drop-shadow-sm">
              <svg className="w-4 h-4 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              Treasury USDC Balance
            </h3>

            {usdcBalance ? (
              <div className="flex items-baseline gap-2 mt-2 drop-shadow-md">
                <span className="text-5xl lg:text-6xl font-black text-white tracking-tight">
                  {Number(usdcBalance.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xl font-bold text-cyan-200">USDC</span>
              </div>
            ) : (
              <div className="mt-2 text-4xl font-bold text-white/70">
                Unavailable
              </div>
            )}

            {walletBalance?.wallet_id && (
              <div className="mt-5 flex items-center gap-3 text-sm text-blue-50 font-mono bg-black/20 backdrop-blur-md px-4 py-2 rounded-xl w-fit border border-white/10 shadow-inner">
                <span className="select-all opacity-90">{walletBalance.wallet_id}</span>
              </div>
            )}

            {balanceError && (
              <div className="mt-5 flex items-center gap-2 bg-red-500/30 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm border border-red-400/30 font-medium tracking-wide">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {balanceError}
              </div>
            )}
          </div>

          <div className="shrink-0 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 text-center min-w-[180px] shadow-lg">
            <div className="text-cyan-100 text-xs font-bold uppercase tracking-widest mb-1.5 opacity-90">Active Network</div>
            <div className="text-white font-extrabold text-xl tracking-tight drop-shadow-sm">
              {health?.adapter_mode === 'arc' ? 'Arc L1' : health?.adapter_mode === 'circle' ? 'Circle API' : 'Mock Network'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Batches */}
        <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
          <div className="px-7 py-6 border-b border-slate-200/50 flex items-center justify-between bg-white/50">
            <h3 className="font-extrabold text-slate-900 text-xl flex items-center gap-2.5">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Recent Batches
            </h3>
            <button
              onClick={() => nav('/batches')}
              className="text-sm font-bold text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              View All &rarr;
            </button>
          </div>
          <div className="flex-1 overflow-x-auto bg-white/30">
            {batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-white">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                </div>
                <h4 className="text-slate-800 font-bold pb-1 text-lg">No batches found</h4>
                <p className="text-slate-500 font-medium max-w-sm">Create a new batch or seed demo data to get started with ArcTreasury.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200/50 text-slate-400 text-xs uppercase font-extrabold tracking-wider bg-slate-50/50">
                  <tr>
                    <th className="px-7 py-4 text-left">Batch Name</th>
                    <th className="px-7 py-4 text-left">Status</th>
                    <th className="px-7 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {batches.slice(0, 5).map(b => (
                    <tr
                      key={b.id}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      onClick={() => nav(`/batches?id=${b.id}`)}
                    >
                      <td className="px-7 py-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-base">{b.name}</div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">{new Date(b.created_at).toLocaleDateString()} &middot; {b.item_count} items</div>
                      </td>
                      <td className="px-7 py-4"><StatusBadge value={b.status} type="batch" /></td>
                      <td className="px-7 py-4 text-right font-mono font-bold text-slate-700 text-base">${b.total_amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Executions */}
        <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
          <div className="px-7 py-6 border-b border-slate-200/50 flex items-center justify-between bg-white/50">
            <h3 className="font-extrabold text-slate-900 text-xl flex items-center gap-2.5">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Recent Executions
            </h3>
            {executions.length > 0 && (
              <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                Latest {Math.min(executions.length, 5)}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-x-auto bg-white/30">
            {executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-white">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h4 className="text-slate-800 font-bold pb-1 text-lg">No execution history</h4>
                <p className="text-slate-500 font-medium max-w-sm">Approved payout items will appear here once execution begins.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200/50 text-slate-400 text-xs uppercase font-extrabold tracking-wider bg-slate-50/50">
                  <tr>
                    <th className="px-7 py-4 text-left">Recipient</th>
                    <th className="px-7 py-4 text-left">Status</th>
                    <th className="px-7 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {executions.slice(0, 5).map(e => (
                    <tr key={e.id} className="hover:bg-purple-50/40 transition-colors">
                      <td className="px-7 py-4">
                        <div className="font-bold text-slate-900 text-base">{e.recipient_name}</div>
                        <div className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">{e.adapter_used || 'Pending'}</div>
                      </td>
                      <td className="px-7 py-4">
                        <StatusBadge value={e.execution_status} type="execution" />
                      </td>
                      <td className="px-7 py-4 text-right font-mono font-bold text-slate-700 text-base">${e.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg, icon }: { label: string; value: string | number; color?: string; bg?: string; icon?: React.ReactNode }) {
  return (
    <div className={`glass-panel rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-900/10 group ${bg || 'bg-white/80 border-slate-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">{label}</div>
        {icon && <div className="p-2 bg-slate-50 rounded-2xl shadow-inner border border-white group-hover:scale-110 transition-transform">{icon}</div>}
      </div>
      <div className={`text-4xl font-black tracking-tight ${color || 'text-slate-900'}`}><AnimatedNumber value={value} /></div>
    </div>
  );
}
