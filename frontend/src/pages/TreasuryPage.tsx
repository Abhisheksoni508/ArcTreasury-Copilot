import { useCallback, useEffect, useState } from 'react';
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

const CAT_ICONS: Record<string, string> = {
  government_bond: '🏛️',
  money_market: '💰',
  corporate_bond: '🏢',
  real_estate: '🏠',
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

  // Gateway state
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [gatewayTxns, setGatewayTxns] = useState<GatewayTransaction[]>([]);
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [gwLoading, setGwLoading] = useState(false);

  // Bridge state
  const [domains, setDomains] = useState<CctpDomains | null>(null);
  const [routes, setRoutes] = useState<BridgeRoute[]>([]);
  const [bridgePlan, setBridgePlan] = useState<BridgePlan | null>(null);
  const [bridgeSrc, setBridgeSrc] = useState('arc');
  const [bridgeDst, setBridgeDst] = useState('ethereum');
  const [bridgeAmt, setBridgeAmt] = useState('1000');

  // Active tab
  const [tab, setTab] = useState<'treasury' | 'gateway' | 'bridge'>('treasury');

  const fetchAll = useCallback(async () => {
    setLoading(true);
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
    try {
      await allocateToRwa(allocAsset, parseFloat(allocAmount));
      setAllocAsset('');
      setAllocAmount('');
      await fetchAll();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Allocation failed'); }
    finally { setAllocating(false); }
  };

  const handleRedeem = async (posId: string) => {
    try { await redeemRwaPosition(posId); await fetchAll(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Redeem failed'); }
  };

  const handleRebalance = async () => {
    try { await triggerRebalance(); await fetchAll(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Rebalance failed'); }
  };

  const handleSeed = async () => {
    try { await seedTreasuryPositions(); await fetchAll(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Seed failed'); }
  };

  const handleDeposit = async () => {
    if (!depositAmt) return;
    setGwLoading(true);
    try { await createDeposit(parseFloat(depositAmt)); setDepositAmt(''); await fetchAll(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Deposit failed'); }
    finally { setGwLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmt) return;
    setGwLoading(true);
    try { await createWithdrawal(parseFloat(withdrawAmt)); setWithdrawAmt(''); await fetchAll(); }
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
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Treasury & RWA</h2>
          <p className="text-slate-500 mt-1 font-medium">RWA-backed reserves, Circle Gateway fiat ramps, and CCTP bridge routing</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeed} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-200 transition-colors border border-purple-200">
            🌱 Seed RWA Demo
          </button>
          <button onClick={handleRebalance} className="px-4 py-2 bg-cyan-100 text-cyan-700 rounded-xl text-sm font-bold hover:bg-cyan-200 transition-colors border border-cyan-200">
            ⚖️ Auto-Rebalance
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}
          <button onClick={() => setError('')} className="ml-2 text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['treasury', 'gateway', 'bridge'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'treasury' ? '🏦 RWA Treasury' : t === 'gateway' ? '🏧 Circle Gateway' : '🌉 CCTP Bridge'}
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
            <StatCard label="Total AUM" value={usd(overview.total_aum)} icon="🏦" />
            <StatCard label="Liquid USDC" value={usd(overview.usdc_liquid)} icon="💵" accent="text-cyan-600" />
            <StatCard label="RWA Holdings" value={usd(overview.total_rwa_current_value)} icon="📊" accent="text-purple-600" />
            <StatCard label="Accrued Yield" value={usd(overview.total_accrued_yield)} icon="📈" accent="text-emerald-600" />
            <StatCard label="Avg APY" value={`${overview.weighted_avg_apy}%`} icon="💎" accent="text-amber-600" />
          </div>

          {/* Reserve Ratio Bar */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-700">Reserve Ratio</span>
              <span className="text-sm font-bold text-slate-500">{pct(overview.reserve_ratio)} liquid ({pct(overview.config.min_reserve_ratio)} minimum)</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, overview.reserve_ratio * 100)}%` }} />
              <div className="absolute top-0 h-full w-0.5 bg-rose-400"
                style={{ left: `${overview.config.min_reserve_ratio * 100}%` }} />
              <div className="absolute top-0 h-full w-0.5 bg-amber-400"
                style={{ left: `${(overview.config.target_reserve_ratio ?? 0.3) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-400">
              <span>0%</span>
              <span className="text-rose-400">Min {pct(overview.config.min_reserve_ratio)}</span>
              <span className="text-amber-400">Target {pct(overview.config.target_reserve_ratio ?? 0.3)}</span>
              <span>100%</span>
            </div>
          </div>

          {/* Allocation Section */}
          <div className="grid grid-cols-2 gap-6">
            {/* RWA Positions */}
            <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
              <h3 className="font-extrabold text-slate-900 mb-4">📊 Active RWA Positions</h3>
              {overview.positions.length === 0 ? (
                <p className="text-slate-400 text-sm">No positions yet. Click "Seed RWA Demo" or allocate below.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {overview.positions.map(pos => (
                    <div key={pos.id} className="bg-gradient-to-r from-slate-50 to-white rounded-xl p-4 border border-slate-100 hover:border-purple-200 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span>{CAT_ICONS[pos.category] || '📄'}</span>
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
              <h3 className="font-extrabold text-slate-900 mb-4">🏦 Allocate to RWA</h3>
              <div className="space-y-3 mb-4">
                {catalog.map(asset => (
                  <button key={asset.symbol} onClick={() => setAllocAsset(asset.symbol)}
                    className={`w-full text-left rounded-xl p-3 border transition-all ${allocAsset === asset.symbol ? 'border-purple-400 bg-purple-50' : 'border-slate-100 bg-slate-50 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{CAT_ICONS[asset.category] || '📄'}</span>
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
                <div className="flex gap-2 mt-3">
                  <input type="number" value={allocAmount} onChange={e => setAllocAmount(e.target.value)}
                    placeholder="Amount USDC" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium" />
                  <button onClick={handleAllocate} disabled={allocating}
                    className="px-5 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
                    {allocating ? '...' : `Allocate to ${allocAsset}`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          {Object.keys(overview.category_breakdown).length > 0 && (
            <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
              <h3 className="font-extrabold text-slate-900 mb-4">📈 Asset Allocation Breakdown</h3>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(overview.category_breakdown).map(([cat, data]) => (
                  <div key={cat} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{CAT_ICONS[cat] || '📄'}</span>
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl shadow-lg">🏧</div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">{gatewayInfo.provider}</h3>
                <p className="text-sm text-slate-500">{gatewayInfo.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {/* On-ramp Flow */}
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200">
                <h4 className="font-bold text-emerald-800 mb-3">💰 Fiat → USDC (On-Ramp)</h4>
                <ol className="space-y-2 text-sm text-emerald-700">
                  {gatewayInfo.treasury_integration.on_ramp_flow.map((step, i) => (
                    <li key={i} className="flex gap-2"><span className="text-emerald-400 font-mono text-xs mt-0.5">{step.slice(0, 2)}</span>{step.slice(3)}</li>
                  ))}
                </ol>
                <div className="mt-4 flex gap-2">
                  <input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                    placeholder="USD amount" className="flex-1 px-3 py-2 rounded-lg border border-emerald-200 text-sm bg-white" />
                  <button onClick={handleDeposit} disabled={gwLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
                    {gwLoading ? '...' : 'Deposit'}
                  </button>
                </div>
              </div>
              {/* Off-ramp Flow */}
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-3">🏦 USDC → Fiat (Off-Ramp)</h4>
                <ol className="space-y-2 text-sm text-blue-700">
                  {gatewayInfo.treasury_integration.off_ramp_flow.map((step, i) => (
                    <li key={i} className="flex gap-2"><span className="text-blue-400 font-mono text-xs mt-0.5">{step.slice(0, 2)}</span>{step.slice(3)}</li>
                  ))}
                </ol>
                <div className="mt-4 flex gap-2">
                  <input type="number" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                    placeholder="USDC amount" className="flex-1 px-3 py-2 rounded-lg border border-blue-200 text-sm bg-white" />
                  <button onClick={handleWithdraw} disabled={gwLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                    {gwLoading ? '...' : 'Withdraw'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Rails */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
            <h3 className="font-extrabold text-slate-900 mb-4">📡 Supported Payment Rails</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(gatewayInfo.payment_rails).map(([key, rail]) => (
                <div key={key} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-100">
                  <h4 className="font-bold text-slate-800">{rail.name}</h4>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div>Currencies: <strong>{rail.currencies.join(', ')}</strong></div>
                    <div>Min: <strong>{usd(rail.min_amount)}</strong> · Max: <strong>{usd(rail.max_amount)}</strong></div>
                    <div>Time: <strong>{rail.estimated_time}</strong></div>
                    <div>Fee: <strong>{rail.fee_percent}%</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gateway Transactions */}
          {gatewayTxns.length > 0 && (
            <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
              <h3 className="font-extrabold text-slate-900 mb-4">📋 Gateway Transactions</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Fiat</th>
                    <th className="pb-2 font-semibold">USDC</th>
                    <th className="pb-2 font-semibold">Rail</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {gatewayTxns.map(tx => (
                    <tr key={tx.id} className="border-b border-slate-50">
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${tx.type === 'DEPOSIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                          {tx.type === 'DEPOSIT' ? '↓ Deposit' : '↑ Withdraw'}
                        </span>
                      </td>
                      <td className="py-2 font-bold">{tx.fiat_currency} {tx.fiat_amount.toLocaleString()}</td>
                      <td className="py-2 font-bold text-cyan-600">{tx.usdc_amount.toLocaleString()} USDC</td>
                      <td className="py-2 capitalize">{tx.rail}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${tx.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2 text-slate-400 text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
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
            <h3 className="font-extrabold text-slate-900 mb-4">🌐 CCTP Domain Registry</h3>
            <p className="text-sm text-slate-500 mb-4">
              Circle's Cross-Chain Transfer Protocol V2 enables native USDC transfers across blockchains
              via burn-attest-mint. Each chain has a unique CCTP domain.
            </p>
            <div className="grid grid-cols-7 gap-3">
              {Object.entries(domains).map(([chain, info]) => (
                <div key={chain} className={`rounded-xl p-3 border text-center transition-all ${chain === 'arc' ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-lg mb-1">{chain === 'arc' ? '⬡' : chain === 'ethereum' ? 'Ξ' : chain === 'polygon' ? '🟣' : chain === 'solana' ? '◎' : chain === 'arbitrum' ? '🔵' : chain === 'base' ? '🔷' : '🔺'}</div>
                  <div className="font-bold text-sm capitalize">{chain}</div>
                  <div className="text-xs text-slate-400 mt-1">Domain <strong>{info.domain}</strong></div>
                  <div className="text-xs text-slate-400">Chain {info.testnet_chain_id}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Route Planner */}
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-white shadow-sm">
            <h3 className="font-extrabold text-slate-900 mb-4">🔀 Bridge Route Planner</h3>
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
                    {bridgePlan.type === 'DIRECT' ? '⚡ Direct Transfer' : '🌉 CCTP Bridge Route'}
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
            <h3 className="font-extrabold text-slate-900 mb-4">📡 All CCTP Routes ({routes.length})</h3>
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

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent?: string }) {
  return (
    <div className="bg-white/60 backdrop-blur rounded-2xl p-4 border border-white shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-xl font-extrabold ${accent || 'text-slate-900'}`}>{value}</div>
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
