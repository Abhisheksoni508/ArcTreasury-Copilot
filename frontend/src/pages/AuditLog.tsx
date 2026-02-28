import { useEffect, useState } from 'react';
import { listAuditLogs } from '../api';
import type { AuditLog as AuditLogType } from '../types';

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [filter, setFilter] = useState<string>('');

  const refresh = () => listAuditLogs({ limit: 200 }).then(setLogs).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const filtered = filter
    ? logs.filter(l => l.entity_type === filter || l.action.includes(filter.toUpperCase()))
    : logs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All events</option>
            <option value="batch">Batches</option>
            <option value="item">Items</option>
            <option value="leg">Legs</option>
          </select>
          <button onClick={refresh} className="text-sm text-blue-600 hover:text-blue-800">
            Refresh
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 px-5 py-16 text-center text-gray-400">
          <p className="text-lg">No audit events yet</p>
          <p className="text-sm mt-1">Events are recorded for every state transition</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Transition</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:bg-slate-800/50 text-xs">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{log.entity_type}</span>
                    <span className="text-gray-400 ml-1 font-mono">{log.entity_id}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {log.old_value && log.new_value ? (
                      <span>
                        <span className="text-gray-400">{log.old_value}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">{log.new_value}</span>
                      </span>
                    ) : log.new_value ? (
                      <span className="font-medium">{log.new_value}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate" title={log.details || ''}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-400 text-center">
        Showing {filtered.length} of {logs.length} events
      </div>
    </div>
  );
}
