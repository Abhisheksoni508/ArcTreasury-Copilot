import type { Decision, ExecutionStatus, BatchStatus } from '../types';

const DECISION_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700 dark:text-gray-300',
  APPROVED: 'bg-green-100 text-green-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  HELD: 'bg-orange-100 text-orange-800',
  QUEUED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const EXEC_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700 dark:text-gray-300',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SETTLED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  RETRYING: 'bg-yellow-100 text-yellow-800',
};

const BATCH_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:text-gray-300',
  POLICY_RUN: 'bg-purple-100 text-purple-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  EXECUTING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-800',
  SETTLED: 'bg-emerald-100 text-emerald-800',
};

type BadgeType = 'decision' | 'execution' | 'batch';

export default function StatusBadge({
  value,
  type = 'decision',
}: {
  value: Decision | ExecutionStatus | BatchStatus | string;
  type?: BadgeType;
}) {
  const colorMap = type === 'execution' ? EXEC_COLORS : type === 'batch' ? BATCH_COLORS : DECISION_COLORS;
  const color = colorMap[value] || 'bg-gray-100 text-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {value}
    </span>
  );
}
