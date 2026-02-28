import { useEffect, useState, useRef } from 'react';
import {
  getAgentStatus,
  controlAgent,
  listAgentActivity,
  clearAgentActivity,
  getAgentStrategies,
} from '../api';
import type { AgentStatus, AgentActivity, AgentStrategyInfo } from '../types';
import { ClipboardCheck, CheckCircle2, Rocket, BarChart2, RefreshCw, XCircle, Bot, Zap, Play } from 'lucide-react';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  AUTO_POLICY: <ClipboardCheck size={16} />,
  AUTO_APPROVE: <CheckCircle2 size={16} />,
  AUTO_EXECUTE: <Rocket size={16} />,
  EXECUTE_RESULT: <BarChart2 size={16} />,
  AUTO_RETRY: <RefreshCw size={16} />,
  RETRY_RESULT: <BarChart2 size={16} />,
  IDLE: <Zap size={16} className="text-gray-400" />,
  ERROR: <XCircle size={16} />,
};

const ACTION_COLORS: Record<string, string> = {
  AUTO_POLICY: 'text-blue-700 bg-blue-50 border-blue-200',
  AUTO_APPROVE: 'text-green-700 bg-green-50 border-green-200',
  AUTO_EXECUTE: 'text-purple-700 bg-purple-50 border-purple-200',
  EXECUTE_RESULT: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  AUTO_RETRY: 'text-amber-700 bg-amber-50 border-amber-200',
  RETRY_RESULT: 'text-amber-700 bg-amber-50 border-amber-200',
  IDLE: 'text-gray-500 bg-gray-50 border-gray-200',
  ERROR: 'text-red-700 bg-red-50 border-red-200',
};

const STRATEGY_COLORS: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-800',
  balanced: 'bg-green-100 text-green-800',
  aggressive: 'bg-red-100 text-red-800',
};

export default function AgentPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [strategies, setStrategies] = useState<Record<string, AgentStrategyInfo>>({});
  const [selectedStrategy, setSelectedStrategy] = useState('balanced');
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    const [s, a] = await Promise.all([
      getAgentStatus().catch(() => null),
      listAgentActivity({ limit: 100 }).catch(() => []),
    ]);
    if (s) setStatus(s);
    setActivities(a);
  };

  useEffect(() => {
    refresh();
    getAgentStrategies().then(setStrategies).catch(() => { });
  }, []);

  // Auto-poll when agent is running
  useEffect(() => {
    if (status?.running) {
      pollRef.current = setInterval(refresh, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status?.running]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const s = await controlAgent('start', selectedStrategy);
      setStatus(s);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const s = await controlAgent('stop');
      setStatus(s);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleClear = async () => {
    await clearAgentActivity();
    setActivities([]);
  };

  const isRunning = status?.running ?? false;
  const activeStrategyInfo = strategies[status?.strategy ?? 'balanced'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot size={28} className="text-blue-600" /> Treasury Copilot Agent
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Autonomous payout orchestration — monitors, approves, executes, and retries
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Running &middot; Cycle {status?.cycle_count}
            </span>
          ) : (
            <span className="text-sm text-gray-400 px-3 py-1.5">Stopped</span>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-start justify-between gap-6">
          {/* Strategy selector */}
          <div className="flex-1">
            <h3 className="font-semibold mb-3">Strategy</h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(strategies).map(([name, info]) => (
                <button
                  key={name}
                  onClick={() => setSelectedStrategy(name)}
                  disabled={isRunning}
                  className={`text-left px-4 py-3 rounded-lg border-2 text-sm transition-colors ${selectedStrategy === name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                    } ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${STRATEGY_COLORS[name] || 'bg-gray-100'}`}>
                      {name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{info.description}</div>
                  <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                    <div>Auto-approve: risk &le; {info.auto_approve_max_risk}, amount &le; ${info.auto_approve_max_amount.toLocaleString()}</div>
                    <div>Decisions: {info.auto_approve_decisions.join(', ') || 'none'}</div>
                    <div>Max retries: {info.max_retries} &middot; Interval: {info.loop_interval}s</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Start/Stop controls */}
          <div className="flex flex-col items-end gap-3 min-w-[180px]">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Starting...' : <><Play size={18} fill="currentColor" /> Start Agent</>}
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={loading}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Stopping...' : '⏹ Stop Agent'}
              </button>
            )}
            {isRunning && activeStrategyInfo && (
              <div className="text-xs text-gray-500 text-right">
                <div>Strategy: <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${STRATEGY_COLORS[status?.strategy ?? ''] || ''}`}>{status?.strategy}</span></div>
                {status?.last_cycle_at && (
                  <div className="mt-1">Last cycle: {new Date(status.last_cycle_at).toLocaleTimeString()}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Agent Activity Feed</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{activities.length} events</span>
            {activities.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear
              </button>
            )}
            <button
              onClick={refresh}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 flex flex-col items-center">
            <span className="bg-gray-100 text-gray-400 p-4 rounded-full mb-3"><Bot size={32} /></span>
            <p className="text-sm">No agent activity yet.</p>
            <p className="text-xs mt-1">Start the agent and seed some demo data to see it in action.</p>
          </div>
        ) : (
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {activities.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <span className="mt-1 flex items-center justify-center w-6">{ACTION_ICONS[a.action] || <Zap size={16} className="text-gray-400" />}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${ACTION_COLORS[a.action] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                      {a.action}
                    </span>
                    <span className="text-xs text-gray-400">
                      {a.entity_type}/{a.entity_id}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${STRATEGY_COLORS[a.strategy] || 'bg-gray-100'}`}>
                      {a.strategy}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 truncate">{a.details}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(a.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 rounded-xl border p-5">
        <h3 className="font-semibold text-sm text-gray-700 mb-3">How the Agent Works</h3>
        <div className="grid grid-cols-4 gap-4 text-xs text-gray-600">
          <div className="bg-white rounded-lg p-3 border">
            <div className="mb-2 text-blue-600 bg-blue-50 w-fit p-1.5 rounded-lg"><ClipboardCheck size={20} /></div>
            <div className="font-semibold text-gray-800">1. Auto-Policy</div>
            <div className="mt-1">Detects new DRAFT batches and runs the 5-rule risk engine automatically.</div>
          </div>
          <div className="bg-white rounded-lg p-3 border">
            <div className="mb-2 text-green-600 bg-green-50 w-fit p-1.5 rounded-lg"><CheckCircle2 size={20} /></div>
            <div className="font-semibold text-gray-800">2. Auto-Approve</div>
            <div className="mt-1">Approves REVIEW/HELD items when risk score and amount are below strategy thresholds.</div>
          </div>
          <div className="bg-white rounded-lg p-3 border">
            <div className="mb-2 text-purple-600 bg-purple-50 w-fit p-1.5 rounded-lg"><Rocket size={20} /></div>
            <div className="font-semibold text-gray-800">3. Auto-Execute</div>
            <div className="mt-1">Triggers batch execution when all decidable items are resolved.</div>
          </div>
          <div className="bg-white rounded-lg p-3 border">
            <div className="mb-2 text-amber-600 bg-amber-50 w-fit p-1.5 rounded-lg"><RefreshCw size={20} /></div>
            <div className="font-semibold text-gray-800">4. Auto-Retry</div>
            <div className="mt-1">Retries failed transfers with exponential backoff up to the strategy's max retries.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
