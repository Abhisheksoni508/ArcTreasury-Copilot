import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listBatches, getBatch, seedDemoData, runPolicy, executeBatch } from '../api';
import type { Batch, BatchDetail } from '../types';
import StatusBadge from '../components/StatusBadge';
import ChainBadge from '../components/ChainBadge';
import SimulatedLabel from '../components/SimulatedLabel';

export default function BatchPage() {
  const [params, setParams] = useSearchParams();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

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

  useEffect(() => { refresh().catch(() => {}); }, [selectedId]);

  const handleSeed = async () => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Payout Batches</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={!!loading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loading === 'seed' ? 'Seeding...' : 'Seed Demo Data'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${msg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* Batch list */}
      {batches.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {batches.map(b => (
            <button
              key={b.id}
              onClick={() => setParams({ id: b.id })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors
                ${selectedId === b.id ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white hover:bg-gray-50'}`}
            >
              {b.name} <StatusBadge value={b.status} type="batch" />
            </button>
          ))}
        </div>
      )}

      {/* Batch detail */}
      {detail && (
        <div className="bg-white rounded-xl shadow-sm border">
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
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
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
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.recipient_name}</div>
                      <div className="text-xs text-gray-400 font-mono truncate max-w-[180px]">{item.recipient_address}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">${item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><ChainBadge chain={item.destination_chain} /></td>
                    <td className="px-4 py-3 capitalize text-gray-600">{item.category.replace('_', ' ')}</td>
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
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No batches yet</p>
          <p className="text-sm mt-1">Click "Seed Demo Data" to load 6 sample payout items</p>
        </div>
      )}
    </div>
  );
}
