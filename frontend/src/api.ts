/**
 * Typed API client for ArcTreasury Copilot backend.
 * All calls go through Vite proxy (/api → localhost:8000/api).
 */

import type {
  Batch, BatchDetail, PayoutItem, PayoutLeg, AuditLog,
  PolicyRunResponse, ExecutionResponse, SeedResponse,
  HealthResponse, Settings, WalletSetupResponse, WalletBalanceResponse,
} from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Health ──────────────────────────────────────────────────────────────
export const getHealth = () => request<HealthResponse>('/health');

// ── Settings ────────────────────────────────────────────────────────────
export const getSettings = () => request<Settings>('/settings');
export const updateSettings = (body: Partial<Settings>) =>
  request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(body) });

// ── Seed ────────────────────────────────────────────────────────────────
export const seedDemoData = () =>
  request<SeedResponse>('/seed', { method: 'POST' });


// ── Wallets ─────────────────────────────────────────────────────────────
export const setupTreasuryWallet = (body?: { wallet_set_name?: string; wallet_name?: string; blockchains?: string[] }) =>
  request<WalletSetupResponse>('/wallets/setup', { method: 'POST', body: JSON.stringify(body ?? {}) });
export const getTreasuryBalance = () => request<WalletBalanceResponse>('/wallets/balance');

// ── Batches ─────────────────────────────────────────────────────────────
export const listBatches = () => request<Batch[]>('/batches');
export const getBatch = (id: string) => request<BatchDetail>(`/batches/${id}`);
export const createBatch = (body: { name: string; items: unknown[] }) =>
  request<Batch>('/batches', { method: 'POST', body: JSON.stringify(body) });

// ── Policy ──────────────────────────────────────────────────────────────
export const runPolicy = (batchId: string) =>
  request<PolicyRunResponse>(`/batches/${batchId}/policy`, { method: 'POST' });

// ── Review ──────────────────────────────────────────────────────────────
export const getReviewQueue = () => request<PayoutItem[]>('/review-queue');
export const decideItem = (itemId: string, decision: string, reason: string) =>
  request<PayoutItem>(`/items/${itemId}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  });

// ── Execution ───────────────────────────────────────────────────────────
export const executeBatch = (batchId: string) =>
  request<ExecutionResponse>(`/batches/${batchId}/execute`, { method: 'POST' });
export const retryItem = (itemId: string) =>
  request<unknown>(`/items/${itemId}/retry`, { method: 'POST' });
export const listExecutions = () => request<PayoutItem[]>('/executions');
export const getItemLegs = (itemId: string) => request<PayoutLeg[]>(`/items/${itemId}/legs`);

// ── Audit ───────────────────────────────────────────────────────────────
export const listAuditLogs = (params?: { entity_type?: string; entity_id?: string; limit?: number }) => {
  const qs = new URLSearchParams();
  if (params?.entity_type) qs.set('entity_type', params.entity_type);
  if (params?.entity_id) qs.set('entity_id', params.entity_id);
  if (params?.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return request<AuditLog[]>(`/audit-logs${q ? '?' + q : ''}`);
};
