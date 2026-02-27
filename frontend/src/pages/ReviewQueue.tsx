import { useEffect, useState } from 'react';
import { getReviewQueue, decideItem } from '../api';
import type { PayoutItem } from '../types';
import StatusBadge from '../components/StatusBadge';
import ChainBadge from '../components/ChainBadge';

export default function ReviewQueue() {
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState<string>('');

  const refresh = () => getReviewQueue().then(setItems).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const handleDecide = async (itemId: string, decision: 'APPROVED' | 'REJECTED') => {
    setLoading(itemId);
    try {
      await decideItem(itemId, decision, `Manually ${decision.toLowerCase()} by operator`);
      await refresh();
    } catch {
      // ignore
    }
    setLoading('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Review Queue</h2>
        <button onClick={refresh} className="text-sm text-blue-600 hover:text-blue-800">
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border px-5 py-16 text-center text-gray-400">
          <p className="text-lg">No items pending review</p>
          <p className="text-sm mt-1">Run the policy engine on a batch to generate review items</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-lg">{item.recipient_name}</span>
                    <StatusBadge value={item.decision} />
                    <ChainBadge chain={item.destination_chain} />
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>
                      <span className="font-medium text-gray-700">${item.amount.toLocaleString()}</span>{' '}
                      {item.currency} — {item.category.replace('_', ' ')}
                    </div>
                    <div className="font-mono text-xs">{item.recipient_address}</div>
                    <div className="text-orange-600">{item.decision_reason}</div>
                    <div className="flex items-center gap-2">
                      <span>Risk Score:</span>
                      <span className={`font-bold ${item.risk_score >= 75 ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.risk_score}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecide(item.id, 'APPROVED')}
                    disabled={loading === item.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecide(item.id, 'REJECTED')}
                    disabled={loading === item.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
