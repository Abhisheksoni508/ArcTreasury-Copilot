import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { listExecutions, retryItem, getItemLegs } from '../api';
import type { PayoutItem, PayoutLeg } from '../types';
import StatusBadge from '../components/StatusBadge';
import ChainBadge from '../components/ChainBadge';
import SimulatedLabel from '../components/SimulatedLabel';

export default function ExecutionMonitor() {
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [legs, setLegs] = useState<PayoutLeg[]>([]);
  const [loading, setLoading] = useState('');

  const refresh = () => listExecutions().then(setItems).catch(() => { });
  useEffect(() => { refresh(); }, []);

  const handleExpand = async (itemId: string) => {
    if (expandedItem === itemId) {
      setExpandedItem(null);
      return;
    }
    setExpandedItem(itemId);
    try {
      setLegs(await getItemLegs(itemId));
    } catch {
      setLegs([]);
    }
  };

  const handleRetry = async (itemId: string) => {
    setLoading(itemId);
    try {
      await retryItem(itemId);
      await refresh();
      if (expandedItem === itemId) {
        setLegs(await getItemLegs(itemId));
      }
    } catch {
      // ignore
    }
    setLoading('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Execution Monitor</h2>
        <button onClick={refresh} className="text-sm text-blue-600 hover:text-blue-800">
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border px-5 py-16 text-center text-gray-400">
          <p className="text-lg">No executions yet</p>
          <p className="text-sm mt-1">Execute a batch to see payout results here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Recipient</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Chain</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Adapter</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <>
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleExpand(item.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.recipient_name}</div>
                      <div className="text-xs text-gray-400 font-mono truncate max-w-[160px]">{item.recipient_address}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><ChainBadge chain={item.destination_chain} /></td>
                    <td className="px-4 py-3"><StatusBadge value={item.execution_status} type="execution" /></td>
                    <td className="px-4 py-3 text-gray-600">{item.adapter_used || '—'}</td>
                    <td className="px-4 py-3"><SimulatedLabel isSimulated={item.is_simulated} /></td>
                    <td className="px-4 py-3">
                      {item.execution_status === 'FAILED' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleRetry(item.id); }}
                          disabled={loading === item.id}
                          className="w-[72px] h-[28px] flex items-center justify-center gap-1.5 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                        >
                          {loading === item.id ? (
                            <>
                              <Loader2 size={12} className="animate-spin" /> Retry
                            </>
                          ) : (
                            'Retry'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedItem === item.id && (
                    <tr key={`${item.id}-legs`}>
                      <td colSpan={7} className="bg-gray-50 px-6 py-4">
                        <h4 className="font-semibold text-xs uppercase text-gray-500 mb-2">Payout Legs</h4>
                        {legs.length === 0 ? (
                          <span className="text-gray-400 text-sm">No legs recorded</span>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-gray-500 uppercase">
                              <tr>
                                <th className="py-1 text-left">Attempt</th>
                                <th className="py-1 text-left">Type</th>
                                <th className="py-1 text-left">Route</th>
                                <th className="py-1 text-left">Status</th>
                                <th className="py-1 text-left">TX Hash</th>
                                <th className="py-1 text-left">Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {legs.map(leg => (
                                <tr key={leg.id}>
                                  <td className="py-1">#{leg.attempt_number}</td>
                                  <td className="py-1 capitalize">{leg.leg_type}</td>
                                  <td className="py-1">{leg.source_chain} → {leg.destination_chain}</td>
                                  <td className="py-1"><StatusBadge value={leg.status} type="execution" /></td>
                                  <td className="py-1 font-mono text-gray-500 truncate max-w-[200px]">{leg.tx_hash || '—'}</td>
                                  <td className="py-1 text-red-500">{leg.error_message || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
