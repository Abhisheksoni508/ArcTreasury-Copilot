import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listBatches, getHealth, listExecutions } from '../api';
import type { Batch, HealthResponse, PayoutItem } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [executions, setExecutions] = useState<PayoutItem[]>([]);
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setError('Backend unavailable — start the FastAPI server on port 8000'));
    listBatches().then(setBatches).catch(() => {});
    listExecutions().then(setExecutions).catch(() => {});
  }, []);

  const totalVolume = batches.reduce((s, b) => s + b.total_amount, 0);
  const totalItems = batches.reduce((s, b) => s + b.item_count, 0);
  const settled = executions.filter(e => e.execution_status === 'SETTLED').length;
  const failed = executions.filter(e => e.execution_status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        {health && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Backend {health.status} — {health.adapter_mode.toUpperCase()} mode
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Batches" value={batches.length} />
        <StatCard label="Total Volume" value={`$${totalVolume.toLocaleString()}`} />
        <StatCard label="Items Settled" value={settled} color="text-green-600" />
        <StatCard label="Items Failed" value={failed} color="text-red-600" />
      </div>

      {/* Recent batches */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Recent Batches</h3>
          <button
            onClick={() => nav('/batches')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View All
          </button>
        </div>
        {batches.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            No batches yet. Go to Batches page to seed demo data.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Batch</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Items</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map(b => (
                <tr
                  key={b.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => nav(`/batches?id=${b.id}`)}
                >
                  <td className="px-5 py-3 font-medium">{b.name}</td>
                  <td className="px-5 py-3"><StatusBadge value={b.status} type="batch" /></td>
                  <td className="px-5 py-3 text-right">{b.item_count}</td>
                  <td className="px-5 py-3 text-right font-mono">${b.total_amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{new Date(b.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent execution items */}
      {executions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold">Recent Executions</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Recipient</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-left">Adapter</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {executions.slice(0, 5).map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">{e.recipient_name}</td>
                  <td className="px-5 py-3"><StatusBadge value={e.execution_status} type="execution" /></td>
                  <td className="px-5 py-3 text-right font-mono">${e.amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-500">{e.adapter_used || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border px-5 py-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
