import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listBatches, getBatch, seedDemoData, runPolicy, executeBatch,
  getReviewQueue, decideItem, listExecutions, retryItem,
} from '../api';
import { Leaf, ShieldAlert, Zap, Eye, CheckCircle2, Ticket, AlertTriangle, AlertCircle, RefreshCw, Rocket } from 'lucide-react';
import type {
  Batch, BatchDetail, PayoutItem, SeedResponse,
  PolicyRunResponse, ExecutionResponse,
} from '../types';
import StatusBadge from '../components/StatusBadge';
import ChainBadge from '../components/ChainBadge';
import SimulatedLabel from '../components/SimulatedLabel';

/* ── helpers ────────────────────────────────────────────────────────── */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type AutoStep =
  | 'idle'
  | 'seeding' | 'seeded'
  | 'running-policy' | 'policy-done'
  | 'executing' | 'executed'
  | 'review'
  | 'complete';

const STEP_ORDER: AutoStep[] = [
  'seeding', 'seeded', 'running-policy', 'policy-done',
  'executing', 'executed', 'review', 'complete',
];

function stepIndex(s: AutoStep): number {
  const i = STEP_ORDER.indexOf(s);
  return i < 0 ? -1 : i;
}

/* ── spinner component ──────────────────────────────────────────────── */
function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.963 7.963 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

/* ── pulsing dot ────────────────────────────────────────────────────── */
function PulsingDot({ color = 'bg-blue-500' }: { color?: string }) {
  return (
    <span className="relative flex h-3 w-3">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
    </span>
  );
}

/* ── step indicator ─────────────────────────────────────────────────── */
function StepIndicator({ current }: { current: AutoStep }) {
  const steps = [
    { key: 'seeding', label: 'Seed', icon: <Leaf size={18} /> },
    { key: 'running-policy', label: 'Policy', icon: <ShieldAlert size={18} /> },
    { key: 'executing', label: 'Execute', icon: <Zap size={18} /> },
    { key: 'review', label: 'Review', icon: <Eye size={18} /> },
    { key: 'complete', label: 'Done', icon: <CheckCircle2 size={18} /> },
  ];

  const ci = stepIndex(current);

  return (
    <div className="flex items-center justify-between max-w-2xl mx-auto mb-8">
      {steps.map((s, i) => {
        const sI = stepIndex(s.key as AutoStep);
        const done = ci > sI || (s.key === 'complete' && current === 'complete');
        const active = ci >= sI && ci <= sI + 1 && !done;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500
                  ${done ? 'bg-green-100 ring-2 ring-green-400 text-green-600' :
                    active ? 'bg-blue-100 ring-2 ring-blue-400 scale-110 text-blue-600' :
                      'bg-gray-100 ring-1 ring-gray-300 text-gray-400'}`}
              >
                {done ? <CheckCircle2 size={18} /> : s.icon}
              </div>
              <span className={`text-xs mt-1 font-medium transition-colors duration-300
                ${done ? 'text-green-600' : active ? 'text-blue-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 transition-colors duration-500
                ${ci > sI + 1 ? 'bg-green-400' : ci > sI ? 'bg-blue-400' : 'bg-gray-200'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
export default function BatchPage() {
  const [params, setParams] = useSearchParams();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

  /* ── autopilot state ──────────────────────────────────────────────── */
  const [step, setStep] = useState<AutoStep>('idle');
  const [seedRes, setSeedRes] = useState<SeedResponse | null>(null);
  const [policyRes, setPolicyRes] = useState<PolicyRunResponse | null>(null);
  const [execRes, setExecRes] = useState<ExecutionResponse | null>(null);
  const [reviewItems, setReviewItems] = useState<PayoutItem[]>([]);
  const [failedItems, setFailedItems] = useState<PayoutItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState('');
  const [retryLoading, setRetryLoading] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedId = params.get('id');

  const refresh = async () => {
    const bs = await listBatches();
    setBatches(bs);
    if (selectedId) {
      setDetail(await getBatch(selectedId));
    } else if (bs.length > 0) {
      setParams({ id: bs[0].id });
    }
  };

  useEffect(() => { refresh().catch(() => { }); }, [selectedId]);

  // auto-scroll when step changes
  useEffect(() => {
    if (step !== 'idle') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [step, reviewItems.length, failedItems.length]);

  /* ── THE AUTOPILOT FLOW ───────────────────────────────────────────── */
  const runAutoPilot = async () => {
    setError('');
    setSeedRes(null);
    setPolicyRes(null);
    setExecRes(null);
    setReviewItems([]);
    setFailedItems([]);

    try {
      // ── Step 1: Seed ──
      setStep('seeding');
      await sleep(800);
      const seed = await seedDemoData();
      setSeedRes(seed);
      setStep('seeded');
      setParams({ id: seed.batch_id });
      await sleep(2000);

      // ── Step 2: Policy ──
      setStep('running-policy');
      await sleep(1500);
      const policy = await runPolicy(seed.batch_id);
      setPolicyRes(policy);
      setStep('policy-done');
      await sleep(2000);

      // ── Step 3: Execute ──
      setStep('executing');
      await sleep(1500);
      const exec = await executeBatch(seed.batch_id);
      setExecRes(exec);
      setStep('executed');
      await sleep(2000);

      // ── Step 4: Load review items ──
      const review = await getReviewQueue();
      setReviewItems(review);

      // Load execution failures
      const executions = await listExecutions();
      setFailedItems(executions.filter(i => i.execution_status === 'FAILED'));

      // refresh batch detail
      await refresh();

      if (review.length > 0) {
        setStep('review');
      } else {
        setStep('complete');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /* ── review decision handler ──────────────────────────────────────── */
  const handleReviewDecide = async (itemId: string, decision: 'APPROVED' | 'REJECTED') => {
    setReviewLoading(itemId);
    try {
      await decideItem(itemId, decision, `Manually ${decision.toLowerCase()} by operator`);
      const remaining = reviewItems.filter(i => i.id !== itemId);
      setReviewItems(remaining);

      if (remaining.length === 0) {
        await sleep(500);
        const executions = await listExecutions();
        setFailedItems(executions.filter(i => i.execution_status === 'FAILED'));
        await refresh();
        setStep('complete');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setReviewLoading('');
  };

  /* ── retry handler ────────────────────────────────────────────────── */
  const handleRetry = async (itemId: string) => {
    setRetryLoading(itemId);
    try {
      await retryItem(itemId);
      const executions = await listExecutions();
      setFailedItems(executions.filter(i => i.execution_status === 'FAILED'));
    } catch {
      // ignore
    }
    setRetryLoading('');
  };

  /* ── manual batch actions (when NOT in autopilot) ─────────────────── */
  const handleSeedManual = async () => {
    setLoading('seed');
    setMsg('');
    try {
      const res = await seedDemoData();
      setMsg(res.message);
      setParams({ id: res.batch_id });
      await refresh();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading('');
  };

  const handlePolicy = async () => {
    if (!selectedId) return;
    setLoading('policy');
    try {
      await runPolicy(selectedId);
      await refresh();
      setMsg('Policy engine completed — items classified');
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading('');
  };

  const handleExecute = async () => {
    if (!selectedId) return;
    setLoading('execute');
    try {
      const res = await executeBatch(selectedId);
      setMsg(`Executed ${res.executed} items`);
      await refresh();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading('');
  };

  const isAutopilot = step !== 'idle';

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Payout Batches</h2>
        <div className="flex gap-2">
          {isAutopilot && step !== 'complete' && (
            <button
              onClick={() => { setStep('idle'); }}
              className="px-4 py-2 border dark:border-slate-800 border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-slate-800/50"
            >
              Exit AutoPilot
            </button>
          )}
          {!isAutopilot && (
            <>
              <button
                onClick={handleSeedManual}
                disabled={!!loading}
                className="px-4 py-2 border dark:border-slate-800 border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-slate-800/50 disabled:opacity-50"
              >
                {loading === 'seed' ? 'Seeding...' : 'Seed (Manual)'}
              </button>
              <button
                onClick={runAutoPilot}
                disabled={!!loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 shadow-md flex items-center gap-2"
              >
                <Rocket size={16} /> Seed &amp; AutoPilot
              </button>
            </>
          )}
          {step === 'complete' && (
            <button
              onClick={() => { setStep('idle'); }}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Back to Batches
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border dark:border-slate-800 border-red-200">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Manual mode message ───────────────────────────────────────── */}
      {!isAutopilot && msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${msg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
         AUTOPILOT FLOW
         ════════════════════════════════════════════════════════════════ */}
      {isAutopilot && (
        <div className="space-y-6">
          <StepIndicator current={step} />

          {/* ── Step 1: Seeding ───────────────────────────────────────── */}
          <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden transition-all duration-500
            ${stepIndex(step) >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="px-5 py-4 flex items-center gap-3">
              <span className="text-green-600 bg-green-50 p-2 rounded-xl"><Leaf size={24} /></span>
              <div className="flex-1">
                <h3 className="font-semibold">Step 1 — Seed Demo Data</h3>
                {step === 'seeding' && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-blue-600">
                    <Spinner className="w-4 h-4 text-blue-600" />
                    Creating payout batch with demo recipients...
                  </div>
                )}
                {seedRes && stepIndex(step) >= stepIndex('seeded') && (
                  <div className="mt-1 text-sm text-green-700">
                    ✅ {seedRes.message}
                  </div>
                )}
              </div>
              {step === 'seeding' && <PulsingDot color="bg-blue-500" />}
              {stepIndex(step) >= stepIndex('seeded') && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Done</span>
              )}
            </div>
            {step === 'seeding' && (
              <div className="h-1 bg-gray-100">
                <div className="h-1 bg-blue-500 animate-pulse rounded-r" style={{ width: '60%' }} />
              </div>
            )}
          </div>

          {/* ── Step 2: Policy Engine ─────────────────────────────────── */}
          {stepIndex(step) >= stepIndex('seeded') && (
            <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden transition-all duration-500
              ${stepIndex(step) >= stepIndex('seeded') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="px-5 py-4 flex items-center gap-3">
                <span className="text-purple-600 bg-purple-50 p-2 rounded-xl"><ShieldAlert size={24} /></span>
                <div className="flex-1">
                  <h3 className="font-semibold">Step 2 — Policy Engine Evaluation</h3>
                  {step === 'seeded' && (
                    <p className="text-sm text-gray-500 mt-1">Preparing to run automated policy engine...</p>
                  )}
                  {step === 'running-policy' && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-purple-600">
                        <Spinner className="w-4 h-4 text-purple-600" />
                        Evaluating risk scores, compliance rules, velocity checks...
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['Checking amount limits...', 'Scoring recipient risk...', 'Validating compliance...'].map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-slate-800/50 rounded px-3 py-2">
                            <Spinner className="w-3 h-3 text-gray-400" /> {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {policyRes && stepIndex(step) >= stepIndex('policy-done') && (
                    <div className="mt-2">
                      <p className="text-sm text-green-700 mb-2">
                        ✅ Policy evaluation complete — {policyRes.results.length} items classified
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {(() => {
                          const counts: Record<string, number> = {};
                          policyRes.results.forEach(r => { counts[r.decision] = (counts[r.decision] || 0) + 1; });
                          return Object.entries(counts).map(([d, c]) => (
                            <span key={d} className={`px-3 py-1 rounded-full text-xs font-medium
                              ${d === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                d === 'REVIEW' ? 'bg-yellow-100 text-yellow-700' :
                                  d === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                    d === 'HELD' ? 'bg-orange-100 text-orange-700' :
                                      'bg-gray-100 text-gray-700 dark:text-gray-300'}`}>
                              {c} {d}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                {step === 'running-policy' && <PulsingDot color="bg-purple-500" />}
                {stepIndex(step) >= stepIndex('policy-done') && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Done</span>
                )}
              </div>
              {step === 'running-policy' && (
                <div className="h-1 bg-gray-100">
                  <div className="h-1 bg-purple-500 animate-pulse rounded-r" style={{ width: '45%' }} />
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Batch Execution ───────────────────────────────── */}
          {stepIndex(step) >= stepIndex('policy-done') && (
            <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden transition-all duration-500
              ${stepIndex(step) >= stepIndex('policy-done') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="px-5 py-4 flex items-center gap-3">
                <span className="text-blue-600 bg-blue-50 p-2 rounded-xl"><Zap size={24} /></span>
                <div className="flex-1">
                  <h3 className="font-semibold">Step 3 — On-Chain Execution</h3>
                  {step === 'policy-done' && (
                    <p className="text-sm text-gray-500 mt-1">Preparing to execute approved payouts...</p>
                  )}
                  {step === 'executing' && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Spinner className="w-4 h-4 text-blue-600" />
                        Submitting USDC transfers via Circle Programmable Wallets...
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {['Signing transactions...', 'Broadcasting to blockchain...'].map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 rounded px-3 py-2">
                            <Spinner className="w-3 h-3 text-blue-400" /> {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {execRes && stepIndex(step) >= stepIndex('executed') && (
                    <div className="mt-2">
                      <p className="text-sm text-green-700 mb-2">
                        ✅ Batch execution complete — {execRes.executed} items submitted
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {(() => {
                          const counts: Record<string, number> = {};
                          execRes.results.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
                          return Object.entries(counts).map(([s, c]) => (
                            <span key={s} className={`px-3 py-1 rounded-full text-xs font-medium
                              ${s === 'PROCESSING' || s === 'SETTLED' ? 'bg-green-100 text-green-700' :
                                s === 'FAILED' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700 dark:text-gray-300'}`}>
                              {c} {s}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                {step === 'executing' && <PulsingDot color="bg-blue-500" />}
                {stepIndex(step) >= stepIndex('executed') && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Done</span>
                )}
              </div>
              {step === 'executing' && (
                <div className="h-1 bg-gray-100">
                  <div className="h-1 bg-blue-500 animate-pulse rounded-r" style={{ width: '55%' }} />
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Review Queue (inline) ─────────────────────────── */}
          {step === 'review' && reviewItems.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden transition-all duration-500 border-yellow-300">
              <div className="px-5 py-4 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-600 bg-yellow-100 p-2 rounded-xl"><Eye size={24} /></span>
                  <div>
                    <h3 className="font-semibold text-yellow-800">Step 4 — Human Review Required</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      {reviewItems.length} item{reviewItems.length > 1 ? 's were' : ' was'} flagged as suspicious or exceeded policy limits.
                      These require your manual approval or rejection.
                    </p>
                  </div>
                  <PulsingDot color="bg-yellow-500" />
                </div>
              </div>
              <div className="divide-y">
                {reviewItems.map(item => (
                  <div key={item.id} className="px-5 py-4 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-lg">{item.recipient_name}</span>
                          <StatusBadge value={item.decision} />
                          <ChainBadge chain={item.destination_chain} />
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300 text-lg">${item.amount.toLocaleString()}</span>{' '}
                            {item.currency} — <span className="capitalize">{item.category.replace('_', ' ')}</span>
                          </div>
                          <div className="font-mono text-xs text-gray-400">{item.recipient_address}</div>
                          <div className="flex items-center gap-1 text-orange-600 font-medium"><AlertTriangle size={14} /> {item.decision_reason}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Risk Score:</span>
                            <span className={`font-bold text-lg ${item.risk_score >= 75 ? 'text-red-600' : item.risk_score >= 50 ? 'text-orange-600' : 'text-yellow-600'}`}>
                              {item.risk_score}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleReviewDecide(item.id, 'APPROVED')}
                          disabled={reviewLoading === item.id}
                          className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {reviewLoading === item.id ? 'Processing...' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => handleReviewDecide(item.id, 'REJECTED')}
                          disabled={reviewLoading === item.id}
                          className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {reviewLoading === item.id ? 'Processing...' : '✗ Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 5: Complete — summary + failures ──────────────────── */}
          {step === 'complete' && (
            <div className="space-y-6 transition-all duration-500">
              {/* Success banner */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border dark:border-slate-800 border-green-200 px-6 py-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-emerald-600 bg-emerald-100 p-2 rounded-xl"><CheckCircle2 size={28} /></span>
                  <div>
                    <h3 className="font-bold text-lg text-green-800">Batch Complete!</h3>
                    <p className="text-sm text-green-700">
                      All automated steps finished. Here's the summary:
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-white dark:bg-slate-900 rounded-lg px-4 py-3 border dark:border-slate-800 border-green-200">
                    <div className="text-xs text-gray-500 uppercase font-medium">Items Seeded</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{seedRes?.items_created ?? 0}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-lg px-4 py-3 border dark:border-slate-800 border-green-200">
                    <div className="text-xs text-gray-500 uppercase font-medium">Items Executed</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{execRes?.executed ?? 0}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-lg px-4 py-3 border dark:border-slate-800 border-green-200">
                    <div className="text-xs text-gray-500 uppercase font-medium">Failed</div>
                    <div className="text-2xl font-bold text-red-600">{failedItems.length}</div>
                  </div>
                </div>
              </div>

              {/* Failed items with retry */}
              {failedItems.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 border-red-200 overflow-hidden">
                  <div className="px-5 py-4 bg-red-50 border-b border-red-200">
                    <div className="flex items-center gap-3">
                      <span className="text-red-600 bg-red-100 p-2 rounded-xl"><AlertTriangle size={24} /></span>
                      <div>
                        <h3 className="font-semibold text-red-800">
                          Complications — {failedItems.length} Unsuccessful Execution{failedItems.length > 1 ? 's' : ''}
                        </h3>
                        <p className="text-sm text-red-700 mt-1">
                          These transfers failed on-chain. Common causes: cross-chain routing (wallet is ARC-TESTNET only),
                          insufficient funds, or network issues. You can retry them individually.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {failedItems.map(item => (
                      <div key={item.id} className="px-5 py-4 flex items-center justify-between hover:bg-red-50/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.recipient_name}</span>
                              <ChainBadge chain={item.destination_chain} />
                              <StatusBadge value={item.execution_status} type="execution" />
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              <span className="font-mono">${item.amount.toLocaleString()}</span> USDC
                              {item.destination_chain !== 'ARC-TESTNET' && (
                                <span className="ml-2 text-red-500 text-xs">
                                  ← Wallet is on ARC-TESTNET, cannot send to {item.destination_chain}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRetry(item.id)}
                          disabled={retryLoading === item.id}
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {retryLoading === item.id ? 'Retrying...' : <><RefreshCw size={14} /> Retry</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {failedItems.length === 0 && (
                <div className="bg-green-50 rounded-xl border dark:border-slate-800 border-green-200 px-6 py-8 text-center flex flex-col items-center">
                  <span className="text-green-600 bg-green-200/50 p-4 rounded-full mb-3"><CheckCircle2 size={32} /></span>
                  <p className="text-green-700 font-medium tracking-wide">All executions succeeded — no complications!</p>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
         NORMAL BATCH VIEW (when autopilot is idle)
         ════════════════════════════════════════════════════════════════ */}
      {!isAutopilot && (
        <>
          {/* Batch list */}
          {batches.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {batches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setParams({ id: b.id })}
                  className={`px-4 py-2 rounded-lg border dark:border-slate-800 text-sm font-medium transition-colors
                    ${selectedId === b.id ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:bg-slate-800/50'}`}
                >
                  {b.name} <StatusBadge value={b.status} type="batch" />
                </button>
              ))}
            </div>
          )}

          {/* Batch detail */}
          {detail && (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{detail.name}</h3>
                  <p className="text-sm text-gray-500">
                    {detail.item_count} items — ${detail.total_amount.toLocaleString()} USDC —{' '}
                    <StatusBadge value={detail.status} type="batch" />
                  </p>
                </div>
                <div className="flex gap-2">
                  {detail.status === 'DRAFT' && (
                    <button
                      onClick={handlePolicy}
                      disabled={!!loading}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {loading === 'policy' ? 'Running...' : 'Run Policy Engine'}
                    </button>
                  )}
                  {['POLICY_RUN', 'REVIEW'].includes(detail.status) && (
                    <button
                      onClick={handleExecute}
                      disabled={!!loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading === 'execute' ? 'Executing...' : 'Execute Batch'}
                    </button>
                  )}
                </div>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Recipient</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Chain</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Decision</th>
                      <th className="px-4 py-3 text-right">Risk</th>
                      <th className="px-4 py-3 text-left">Exec Status</th>
                      <th className="px-4 py-3 text-left">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.recipient_name}</div>
                          <div className="text-xs text-gray-400 font-mono truncate max-w-[180px]">{item.recipient_address}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">${item.amount.toLocaleString()}</td>
                        <td className="px-4 py-3"><ChainBadge chain={item.destination_chain} /></td>
                        <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-400">{item.category.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <StatusBadge value={item.decision} />
                          {item.decision_reason && (
                            <div className="text-xs text-gray-400 mt-1 max-w-[200px] truncate" title={item.decision_reason}>
                              {item.decision_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.risk_score > 0 && (
                            <span className={`font-mono font-semibold ${item.risk_score >= 75 ? 'text-red-600' : item.risk_score >= 50 ? 'text-orange-600' : item.risk_score >= 25 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {item.risk_score}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge value={item.execution_status} type="execution" /></td>
                        <td className="px-4 py-3"><SimulatedLabel isSimulated={item.is_simulated} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {batches.length === 0 && (
            <div className="text-center py-16 text-gray-400 flex flex-col items-center">
              <span className="text-gray-300 bg-gray-100 p-4 rounded-3xl mb-4"><Ticket size={32} /></span>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">No batches yet</p>
              <p className="text-sm mt-1">Click <strong>"Seed &amp; AutoPilot"</strong> to see the full automated pipeline in action</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
