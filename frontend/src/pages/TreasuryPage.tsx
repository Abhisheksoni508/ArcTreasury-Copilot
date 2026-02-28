import { useCallback, useEffect, useState } from 'react';
import {
  Landmark, Coins, Building2, Home, ArrowRightLeft, Waypoints, Sprout, Scale,
  Banknote, BarChart3, TrendingUp, Gem, PieChart as PieChartIcon, FileText, Radio, ClipboardList,
  Globe, Hexagon, Diamond, Circle, Disc, Square, Triangle, Shuffle, Zap, ArrowDown, ArrowUp
} from 'lucide-react';
import AnimatedNumber from '../components/AnimatedNumber';

import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#f43f5e'];

import {
  getTreasuryOverview, getRwaCatalog, allocateToRwa, redeemRwaPosition,
  triggerRebalance, seedTreasuryPositions,
  getGatewayInfo, createDeposit, createWithdrawal, getGatewayTransactions,
  getBridgeDomains, getBridgeRoutes, planBridgeRoute,
} from '../api';
import type {
  TreasuryOverview, RwaAsset, GatewayInfo, GatewayTransaction,
  CctpDomains, BridgeRoute, BridgePlan,
} from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function usd(v: number) { return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

const RISK_COLORS: Record<string, string> = {
  AAA: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'AA+': 'text-teal-700 bg-teal-50 border-teal-200',
  A: 'text-blue-700 bg-blue-50 border-blue-200',
  'BBB+': 'text-amber-700 bg-amber-50 border-amber-200',
};

const CAT_ICONS: Record<string, React.ReactNode> = {
  government_bond: <Landmark size={18} />,
  money_market: <Coins size={18} />,
  corporate_bond: <Building2 size={18} />,
  real_estate: <Home size={18} />,
};

// ── Component ───────────────────────────────────────────────────────────

export default function TreasuryPage() {
  // Treasury state
  const [overview, setOverview] = useState<TreasuryOverview | null>(null);
  const [catalog, setCatalog] = useState<RwaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Allocate modal
  const [allocAsset, setAllocAsset] = useState<string>('');
  const [allocAmount, setAllocAmount] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Gateway state
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [gatewayTxns, setGatewayTxns] = useState<GatewayTransaction[]>([]);
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [gwLoading, setGwLoading] = useState(false);
  const [selectedRail, setSelectedRail] = useState('wire');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');

  // Bridge state
  const [domains, setDomains] = useState<CctpDomains | null>(null);
  const [routes, setRoutes] = useState<BridgeRoute[]>([]);
  const [bridgePlan, setBridgePlan] = useState<BridgePlan | null>(null);
  const [bridgeSrc, setBridgeSrc] = useState('arc');
  const [bridgeDst, setBridgeDst] = useState('ethereum');
  const [bridgeAmt, setBridgeAmt] = useState('1000');

  // Active tab
  const [tab, setTab] = useState<'treasury' | 'gateway' | 'bridge'>('treasury');

  const fetchAll = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const [ov, cat, gwInfo, gwTxns, dom, rts] = await Promise.all([
        getTreasuryOverview(),
        getRwaCatalog(),
        getGatewayInfo(),
        getGatewayTransactions(),
        getBridgeDomains(),
        getBridgeRoutes(),
      ]);
      setOverview(ov);
      setCatalog(cat);
      setGatewayInfo(gwInfo);
      setGatewayTxns(gwTxns);
      setDomains(dom);
      setRoutes(rts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load treasury data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleAllocate = async () => {
    if (!allocAsset || !allocAmount) return;
    setAllocating(true);

    // Find asset to check minimum
    const asset = catalog.find(a => a.symbol === allocAsset);
    if (asset && parseFloat(allocAmount) < asset.min_investment) {
      setNotification({
        type: 'error',
        message: `Minimum investment for ${asset.name} is ${usd(asset.min_investment)}`
      });
      setTimeout(() => setNotification(null), 4000);
      setAllocating(false);
      return;
    }

    try {
      await allocateToRwa(allocAsset, parseFloat(allocAmount));
      setAllocAsset('');
      setAllocAmount('');
      await fetchAll(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Allocation failed'); }
    finally { setAllocating(false); }
  };

  const handleRedeem = async (posId: string) => {
    try { await redeemRwaPosition(posId); await fetchAll(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Redeem failed'); }
  };

  const handleRebalance = async () => {
    try { await triggerRebalance(); await fetchAll(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Rebalance failed'); }
  };

  const handleSeed = async () => {
    try { await seedTreasuryPositions(); await fetchAll(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Seed failed'); }
  };

  const handleDeposit = async () => {
    if (!depositAmt) return;
    setGwLoading(true);
    try { await createDeposit(parseFloat(depositAmt), selectedCurrency, selectedRail); setDepositAmt(''); await fetchAll(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Deposit failed'); }
    finally { setGwLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmt) return;
    setGwLoading(true);
    try { await createWithdrawal(parseFloat(withdrawAmt), selectedCurrency, selectedRail); setWithdrawAmt(''); await fetchAll(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Withdrawal failed'); }
    finally { setGwLoading(false); }
  };

  const handlePlanRoute = async () => {
    const plan = await planBridgeRoute(bridgeSrc, bridgeDst, parseFloat(bridgeAmt));
    setBridgePlan(plan);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
    </div>
  );

  const health = overview?.health;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Treasury & RWA</h2>
          <p className="text-slate-500 mt-1 font-medium">RWA-backed reserves, Circle Gateway fiat ramps, and CCTP bridge routing</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeed} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-200 transition-colors border border-purple-200">
            <div className="flex items-center gap-2"><Sprout size={16} /> Seed RWA Demo</div>
          </button>
          <button onClick={handleRebalance} className="px-4 py-2 bg-cyan-100 text-cyan-700 rounded-xl text-sm font-bold hover:bg-cyan-200 transition-colors border border-cyan-200">
            <div className="flex items-center gap-2"><Scale size={16} /> Auto-Rebalance</div>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}
          <button onClick={() => setError('')} className="ml-2 text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit relative">
        <div
          className="absolute top-1 bottom-1 w-[164px] bg-white rounded-lg shadow-sm transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${tab === 'treasury' ? 0 : tab === 'gateway' ? 100 : 200}%)` }}
        />
        {(['treasury', 'gateway', 'bridge'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`w-[164px] py-2 rounded-lg text-sm font-bold transition-colors relative z-10 flex items-center justify-center ${tab === t ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'treasury' ? <span className="flex items-center gap-2"><Landmark size={18} /> RWA Treasury</span> : t === 'gateway' ? <span className="flex items-center gap-2"><ArrowRightLeft size={18} /> Circle Gateway</span> : <span className="flex items-center gap-2"><Waypoints size={18} /> CCTP Bridge</span>}
          </button>
        ))}
      </div>

      {/* ═══════════════════ TREASURY TAB ═══════════════════ */}
      {tab === 'treasury' && overview && (
        <>
          {/* Health Banner */}
          {health && (
            <div className={`rounded-2xl p-5 border-2 ${health.overall_score >= 80 ? 'bg-emerald-50/50 border-emerald-200' : health.overall_score >= 60 ? 'bg-blue-50/50 border-blue-200' : health.overall_score >= 40 ? 'bg-amber-50/50 border-amber-200' : 'bg-rose-50/50 border-rose-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${health.overall_score >= 80 ? 'bg-emerald-500 text-white' : health.overall_score >= 60 ? 'bg-blue-500 text-white' : health.overall_score >= 40 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {health.overall_score}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">Treasury Health: {health.overall_status.toUpperCase()}</h3>
                    <p className="text-sm text-slate-500">Composite score based on liquidity, diversification, and yield</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <MiniScore label="Liquidity" score={health.liquidity.score} detail={`Reserve: ${pct(health.liquidity.reserve_ratio)}`} />
                  <MiniScore label="Diversification" score={health.diversification.score} detail={`${health.diversification.categories} categories`} />
                  <MiniScore label="Yield" score={health.yield.score} detail={`APY: ${health.yield.weighted_apy}%`} />
                </div>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="Total AUM" value={usd(overview.total_aum)} icon={<Landmark size={24} className="text-slate-400" />} />
            <StatCard label="Liquid USDC" value={usd(overview.usdc_liquid)} icon={<Banknote size={24} className="text-cyan-600" />} accent="text-cyan-600" />
            <StatCard label="RWA Holdings" value={usd(overview.total_rwa_current_value)} icon={<BarChart3 size={24} className="text-purple-600" />} accent="text-purple-600" />
            <StatCard label="Accrued Yield" value={usd(overview.total_accrued_yield)} icon={<TrendingUp size={24} className="text-emerald-600" />} accent="text-emerald-600" />
            <StatCard label="Avg APY" value={`${overview.weighted_avg_apy}%`} icon={<Gem size={24} className="text-amber-600" />} accent="text-amber-600" />
          </div>

          {/* Reserve Ratio Bar */}
          {(() => {
            const ratio = overview.reserve_ratio;
            const minR = overview.config.min_reserve_ratio;
            const targetR = overview.config.target_reserve_ratio ?? 0.3;
            const status = ratio >= targetR ? 'Healthy' : ratio >= minR ? 'Adequate' : 'Critical';
            const statusColor = ratio >= targetR ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : ratio >= minR ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-rose-600 bg-rose-50 border-rose-200';
            const barColor = ratio >= targetR ? 'from-emerald-400 to-cyan-500' : ratio >= minR ? 'from-amber-400 to-yellow-500' : 'from-rose-400 to-red-500';
            return (
              <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
                {/* Top row: title + status badge + percentage */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-slate-800 text-base">Reserve Ratio</span>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${statusColor}`}>{status}</span>
                  </div>
                  <span className={`text-2xl font-black tabular-nums ${ratio >= targetR ? 'text-emerald-600' : ratio >= minR ? 'text-amber-600' : 'text-rose-600'}`}>
                    {pct(ratio)}
                  </span>
                </div>

                {/* Info row: liquid vs deployed */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
                  <div className="bg-cyan-50/80 rounded-xl px-3 py-2 border border-cyan-100">
                    <span className="text-slate-400 block">Liquid USDC</span>
                    <span className="font-extrabold text-cyan-700">{usd(overview.usdc_liquid)}</span>
                  </div>
                  <div className="bg-purple-50/80 rounded-xl px-3 py-2 border border-purple-100">
                    <span className="text-slate-400 block">Deployed in RWA</span>
                    <span className="font-extrabold text-purple-700">{usd(overview.total_rwa_current_value)}</span>
                  </div>
                  <div className="bg-slate-50/80 rounded-xl px-3 py-2 border border-slate-100">
                    <span className="text-slate-400 block">Total AUM</span>
                    <span className="font-extrabold text-slate-800">{usd(overview.total_aum)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative">
                  <div className="h-5 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${Math.min(100, ratio * 100)}%` }} />

                    {/* Min threshold marker */}
                    <div className="absolute top-0 h-full flex flex-col items-center"
                      style={{ left: `${minR * 100}%` }}>
                      <div className="w-0.5 h-full bg-rose-400" />
                    </div>

                    {/* Target threshold marker */}
                    <div className="absolute top-0 h-full flex flex-col items-center"
                      style={{ left: `${targetR * 100}%` }}>
                      <div className="w-0.5 h-full bg-amber-400" />
                    </div>
                  </div>

                  {/* Legends below bar */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-400 font-bold">0%</span>
                    <div className="flex items-center gap-5 text-[10px] font-bold">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Min {pct(minR)}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Target {pct(targetR)}</span>
                      <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full inline-block ${ratio >= targetR ? 'bg-emerald-500' : ratio >= minR ? 'bg-amber-500' : 'bg-rose-500'}`} /> Current {pct(ratio)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">100%</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Allocation Section */}
          <div className="grid grid-cols-2 gap-6">
            {/* RWA Positions */}
            <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm flex flex-col">
              <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><BarChart3 size={20} /> Active RWA Positions</span></h3>

              <div className="h-48 mb-4 flex items-center justify-center shrink-0">
                {overview.positions.length === 0 ? (
                  <div className="text-slate-400 flex flex-col items-center">
                    <PieChartIcon size={40} className="mb-2 opacity-20" />
                    <span className="text-sm">Not enough data to graph</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={overview.positions}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="current_value"
                        nameKey="asset_name"
                        stroke="none"
                      >
                        {overview.positions.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => usd(Number(value))} cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Thin Gray Line Divider */}
              <hr className="border-t border-slate-200 mb-4 shrink-0" />

              {overview.positions.length === 0 ? (
                <p className="text-slate-400 text-sm">No positions yet. Click "Seed RWA Demo" or allocate below.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {overview.positions.map(pos => (
                    <div key={pos.id} className="bg-gradient-to-r from-slate-50 to-white rounded-xl p-4 border border-slate-100 hover:border-purple-200 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span>{CAT_ICONS[pos.category] || <FileText size={18} />}</span>
                          <span className="font-bold text-slate-800 text-sm">{pos.asset_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-lg font-bold border ${RISK_COLORS[pos.risk_rating] || 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                            {pos.risk_rating}
                          </span>
                        </div>
                        <button onClick={() => handleRedeem(pos.id)}
                          className="text-xs px-3 py-1 bg-rose-50 text-rose-600 rounded-lg font-bold hover:bg-rose-100 border border-rose-200 transition-colors">
                          Redeem
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div><span className="text-slate-400">Principal</span><br /><span className="font-bold">{usd(pos.amount_usdc)}</span></div>
                        <div><span className="text-slate-400">Current</span><br /><span className="font-bold text-emerald-600">{usd(pos.current_value)}</span></div>
                        <div><span className="text-slate-400">Yield</span><br /><span className="font-bold text-cyan-600">+{usd(pos.accrued_yield)}</span></div>
                        <div><span className="text-slate-400">APY</span><br /><span className="font-bold text-purple-600">{pos.apy}%</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RWA Catalog + Allocate */}
            <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
              <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><Landmark size={20} /> Allocate to RWA</span></h3>
              <div className="space-y-3 mb-4">
                {catalog.map(asset => (
                  <button key={asset.symbol} onClick={() => setAllocAsset(asset.symbol)}
                    className={`w-full text-left rounded-xl p-3 border transition-all ${allocAsset === asset.symbol ? 'border-purple-400 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{CAT_ICONS[asset.category] || <FileText size={18} />}</span>
                        <span className="font-bold text-sm">{asset.name}</span>
                      </div>
                      <span className="text-sm font-extrabold text-purple-600">{asset.apy}% APY</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{asset.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-slate-500">
                      <span>Risk: <strong>{asset.risk_rating}</strong></span>
                      <span>Min: <strong>{usd(asset.min_investment)}</strong></span>
                      <span>Maturity: <strong>{asset.maturity_days}d</strong></span>
                    </div>
                  </button>
                ))}
              </div>
              {allocAsset && (
                <div className="mt-3 space-y-2">
                  {notification && (
                    <div className={`px-4 py-2.5 rounded-xl flex items-center justify-between text-sm font-bold animate-in slide-in-from-top-2 fade-in duration-200 ${notification.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                      <span>{notification.message}</span>
                      <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-75 transition-opacity text-lg leading-none">✕</button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="number" value={allocAmount} onChange={e => setAllocAmount(e.target.value)}
                      placeholder="Amount USDC" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium" />
                    <button onClick={handleAllocate} disabled={allocating}
                      className="px-5 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
                      {allocating ? '...' : `Allocate to ${allocAsset}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          {Object.keys(overview.category_breakdown).length > 0 && (
            <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
              <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><PieChartIcon size={20} /> Asset Allocation Breakdown</span></h3>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(overview.category_breakdown).map(([cat, data]) => (
                  <div key={cat} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{CAT_ICONS[cat] || <FileText size={18} />}</span>
                      <span className="font-bold text-sm text-slate-700 capitalize">{cat.replace('_', ' ')}</span>
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900">{usd(data.current_value)}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {data.count} position{data.count !== 1 ? 's' : ''} · {data.avg_apy.toFixed(1)}% avg APY
                    </div>
                    <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full"
                        style={{ width: `${overview.total_aum > 0 ? (data.current_value / overview.total_aum * 100) : 0}%` }} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {overview.total_aum > 0 ? ((data.current_value / overview.total_aum) * 100).toFixed(1) : 0}% of AUM
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ GATEWAY TAB ═══════════════════ */}
      {tab === 'gateway' && gatewayInfo && (
        <>
          <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-white shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl shadow-lg"><ArrowRightLeft size={28} className="text-white" /></div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">{gatewayInfo.provider}</h3>
                <p className="text-sm text-slate-500">{gatewayInfo.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {/* On-ramp Flow */}
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200">
                <h4 className="font-bold text-emerald-800 mb-3"><span className="flex items-center gap-2"><Banknote size={16} /> Fiat → USDC (On-Ramp)</span></h4>
                <ol className="space-y-2 text-sm text-emerald-700">
                  {gatewayInfo.treasury_integration.on_ramp_flow.map((step, i) => (
                    <li key={i} className="flex gap-2"><span className="text-emerald-400 font-mono text-xs mt-0.5">{step.slice(0, 2)}</span>{step.slice(3)}</li>
                  ))}
                </ol>
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                      placeholder={`${selectedCurrency} amount`} className="flex-1 px-3 py-2 rounded-lg border border-emerald-200 text-sm bg-white" />
                    <button onClick={handleDeposit} disabled={gwLoading}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
                      {gwLoading ? '...' : 'Deposit'}
                    </button>
                  </div>
                  {depositAmt && selectedCurrency !== 'USD' && (
                    <div className="text-xs text-emerald-600 bg-emerald-100/60 rounded-lg px-3 py-1.5 border border-emerald-200">
                      {selectedCurrency} {parseFloat(depositAmt).toLocaleString()} × {gatewayInfo.fx_rates?.[selectedCurrency] ?? 1} = <strong>${(parseFloat(depositAmt) * (gatewayInfo.fx_rates?.[selectedCurrency] ?? 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</strong>
                    </div>
                  )}
                </div>
              </div>
              {/* Off-ramp Flow */}
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-3"><span className="flex items-center gap-2"><Landmark size={16} /> USDC → Fiat (Off-Ramp)</span></h4>
                <ol className="space-y-2 text-sm text-blue-700">
                  {gatewayInfo.treasury_integration.off_ramp_flow.map((step, i) => (
                    <li key={i} className="flex gap-2"><span className="text-blue-400 font-mono text-xs mt-0.5">{step.slice(0, 2)}</span>{step.slice(3)}</li>
                  ))}
                </ol>
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <input type="number" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                      placeholder="USDC amount" className="flex-1 px-3 py-2 rounded-lg border border-blue-200 text-sm bg-white" />
                    <button onClick={handleWithdraw} disabled={gwLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                      {gwLoading ? '...' : 'Withdraw'}
                    </button>
                  </div>
                  {withdrawAmt && selectedCurrency !== 'USD' && (
                    <div className="text-xs text-blue-600 bg-blue-100/60 rounded-lg px-3 py-1.5 border border-blue-200">
                      ${parseFloat(withdrawAmt).toLocaleString()} USDC ÷ {gatewayInfo.fx_rates?.[selectedCurrency] ?? 1} = <strong>{selectedCurrency} {(parseFloat(withdrawAmt) / (gatewayInfo.fx_rates?.[selectedCurrency] ?? 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Rails Selection */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
            <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><Radio size={20} /> Select Payment Method</span></h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(gatewayInfo.payment_rails).map(([key, rail]) => {
                const isActive = selectedRail === key;
                return (
                  <button key={key} onClick={() => { setSelectedRail(key); setSelectedCurrency(rail.currencies[0]); }}
                    className={`text-left rounded-xl p-4 border-2 transition-all ${isActive ? 'border-purple-400 bg-purple-50/50 shadow-md shadow-purple-100' : 'border-slate-100 bg-gradient-to-br from-slate-50 to-white hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-bold ${isActive ? 'text-purple-800' : 'text-slate-800'}`}>{rail.name}</h4>
                      {isActive && <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />}
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Globe size={12} className="text-slate-400" />
                        <span>Currencies: <strong className={isActive ? 'text-purple-700' : ''}>{rail.currencies.join(', ')}</strong></span>
                      </div>
                      <div>Min: <strong>{usd(rail.min_amount)}</strong> · Max: <strong>{usd(rail.max_amount)}</strong></div>
                      <div className="flex items-center justify-between">
                        <span>⏱ <strong>{rail.estimated_time}</strong></span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${rail.fee_percent === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {rail.fee_percent === 0 ? 'FREE' : `${rail.fee_percent}% fee`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Currency selector for selected rail */}
            {gatewayInfo.payment_rails[selectedRail]?.currencies.length > 1 && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Currency:</span>
                <div className="flex gap-2">
                  {gatewayInfo.payment_rails[selectedRail].currencies.map(cur => (
                    <button key={cur} onClick={() => setSelectedCurrency(cur)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedCurrency === cur ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                      {cur}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active rail summary */}
            <div className="mt-4 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Active: <strong className="text-slate-800">{gatewayInfo.payment_rails[selectedRail]?.name}</strong> in <strong className="text-purple-700">{selectedCurrency}</strong></span>
              <span className="text-slate-400">Settlement: <strong>{gatewayInfo.payment_rails[selectedRail]?.estimated_time}</strong></span>
            </div>
          </div>

          {/* Gateway Transactions */}
          {gatewayTxns.length > 0 && (
            <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
              <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><ClipboardList size={20} /> Gateway Transactions</span></h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Fiat</th>
                    <th className="pb-2 font-semibold">FX → USD</th>
                    <th className="pb-2 font-semibold">USDC</th>
                    <th className="pb-2 font-semibold">Rail</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {gatewayTxns.map(tx => {
                    const fxRate = gatewayInfo?.fx_rates?.[tx.fiat_currency] ?? 1;
                    const isNonUsd = tx.fiat_currency !== 'USD';
                    return (
                      <tr key={tx.id} className="border-b border-slate-50">
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${tx.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                            {tx.type === 'DEPOSIT' ? <span className="flex items-center gap-1"><ArrowDown size={14} /> Deposit</span> : <span className="flex items-center gap-1"><ArrowUp size={14} /> Withdraw</span>}
                          </span>
                        </td>
                        <td className="py-2 font-bold">{tx.fiat_currency} {tx.fiat_amount.toLocaleString()}</td>
                        <td className="py-2 text-xs">
                          {isNonUsd ? (
                            <span className="text-slate-500">×{fxRate} = <strong className="text-slate-700">${(tx.fiat_amount * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 font-bold text-cyan-600">{tx.usdc_amount.toLocaleString()} USDC</td>
                        <td className="py-2 capitalize">{tx.rail}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${tx.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-400 text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ BRIDGE TAB ═══════════════════ */}
      {tab === 'bridge' && domains && (
        <>
          {/* CCTP Domain Map */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
            <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><Globe size={20} /> CCTP Domain Registry</span></h3>
            <p className="text-sm text-slate-500 mb-4">
              Circle's Cross-Chain Transfer Protocol V2 enables native USDC transfers across blockchains
              via burn-attest-mint. Each chain has a unique CCTP domain.
            </p>
            <div className="grid grid-cols-7 gap-3">
              {Object.entries(domains).map(([chain, info]) => (
                <div key={chain} className={`rounded-xl p-3 border text-center transition-all ${chain === 'arc' ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200' : 'bg-slate-50 border-slate-200'}`}>

                  <div className="flex justify-center mb-2">
                    {chain === 'arc' ? <Hexagon size={24} className="text-purple-600" /> :
                      chain === 'ethereum' ? <Diamond size={24} className="text-blue-500" /> :
                        chain === 'polygon' ? <Circle size={24} className="text-purple-500" /> :
                          chain === 'solana' ? <Disc size={24} className="text-green-500" /> :
                            chain === 'arbitrum' ? <Circle size={24} className="text-blue-500" /> :
                              chain === 'base' ? <div className="rotate-45"><Square size={24} className="text-blue-600" /></div> :
                                <Triangle size={24} className="text-red-500" />}
                  </div>
                  <div className="font-bold text-sm capitalize">{chain}</div>
                  <div className="text-xs text-slate-400 mt-1">Domain <strong>{info.domain}</strong></div>
                  <div className="text-xs text-slate-400">Chain {info.testnet_chain_id}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Route Planner */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
            <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><Shuffle size={20} /> Bridge Route Planner</span></h3>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Source</label>
                <select value={bridgeSrc} onChange={e => setBridgeSrc(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white">
                  {Object.keys(domains).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <span className="text-2xl pb-1">→</span>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Destination</label>
                <select value={bridgeDst} onChange={e => setBridgeDst(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white">
                  {Object.keys(domains).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Amount USDC</label>
                <input type="number" value={bridgeAmt} onChange={e => setBridgeAmt(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium w-32" />
              </div>
              <button onClick={handlePlanRoute}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                Plan Route
              </button>
            </div>

            {/* Route Plan Result */}
            {bridgePlan && (
              <div className="mt-5 bg-indigo-50/50 rounded-xl p-5 border border-indigo-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-indigo-800">
                    {bridgePlan.type === 'DIRECT' ? <span className="flex items-center gap-1.5"><Zap size={16} /> Direct Transfer</span> : <span className="flex items-center gap-1.5"><Waypoints size={16} /> CCTP Bridge Route</span>}
                  </span>
                  {bridgePlan.fee_usdc !== undefined && (
                    <span className="text-sm text-indigo-600">Fee: <strong>{bridgePlan.fee_usdc} USDC</strong> · Net: <strong>{bridgePlan.net_amount} USDC</strong></span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {bridgePlan.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-indigo-300">→</span>}
                      <div className={`rounded-xl px-4 py-3 text-center border ${step.action === 'BURN' ? 'bg-rose-50 border-rose-200' : step.action === 'ATTEST' ? 'bg-amber-50 border-amber-200' : step.action === 'MINT' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="font-bold text-xs">{step.action}</div>
                        <div className="text-xs text-slate-500 mt-1">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {bridgePlan.estimated_seconds !== undefined && (
                  <div className="mt-3 text-xs text-indigo-500">
                    Estimated time: <strong>{bridgePlan.estimated_seconds}s</strong>
                    {bridgePlan.attestation_url && <> · <a href={bridgePlan.attestation_url} className="underline">Attestation API</a></>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Supported Routes Table */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
            <h3 className="font-extrabold text-slate-900 mb-4"><span className="flex items-center gap-2"><Radio size={20} /> All CCTP Routes ({routes.length})</span></h3>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="pb-2 font-semibold">Source</th>
                    <th className="pb-2 font-semibold">→</th>
                    <th className="pb-2 font-semibold">Destination</th>
                    <th className="pb-2 font-semibold">Domains</th>
                    <th className="pb-2 font-semibold">Fee</th>
                    <th className="pb-2 font-semibold">Est. Time</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-1.5 font-medium capitalize">{r.source_chain}</td>
                      <td className="py-1.5 text-slate-300">→</td>
                      <td className="py-1.5 font-medium capitalize">{r.destination_chain}</td>
                      <td className="py-1.5 text-xs text-slate-400">{r.source_domain} → {r.destination_domain}</td>
                      <td className="py-1.5 font-bold text-cyan-600">{r.fee_usdc} USDC</td>
                      <td className="py-1.5 text-slate-500">{r.estimated_seconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white/60 backdrop-blur rounded-2xl p-4 border border-white shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-xl font-extrabold ${accent || 'text-slate-900'}`}><AnimatedNumber value={value} /></div>
    </div>
  );
}

function MiniScore({ label, score, detail }: { label: string; score: number; detail: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-black ${score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{score}</div>
      <div className="text-xs font-bold text-slate-600">{label}</div>
      <div className="text-xs text-slate-400">{detail}</div>
    </div>
  );
}
