// ── Enums ──────────────────────────────────────────────────────────────

export type BatchStatus = 'DRAFT' | 'POLICY_RUN' | 'REVIEW' | 'EXECUTING' | 'COMPLETED' | 'SETTLED';
export type Decision = 'PENDING' | 'APPROVED' | 'REVIEW' | 'HELD' | 'QUEUED' | 'REJECTED';
export type ExecutionStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'RETRYING';
export type LegStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
export type Category = 'payroll' | 'vendor' | 'revenue_split';

// ── API Response Types ─────────────────────────────────────────────────

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  total_amount: number;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface BatchDetail extends Batch {
  items: PayoutItem[];
}

export interface PayoutItem {
  id: string;
  batch_id: string;
  recipient_name: string;
  recipient_address: string;
  amount: number;
  currency: string;
  destination_chain: string;
  category: string;
  decision: Decision;
  risk_score: number;
  decision_reason: string;
  execution_status: ExecutionStatus;
  adapter_used: string | null;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayoutLeg {
  id: string;
  item_id: string;
  leg_type: string;
  source_chain: string;
  destination_chain: string;
  amount: number;
  status: LegStatus;
  tx_hash: string | null;
  adapter_used: string | null;
  attempt_number: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  timestamp: string;
}

export interface PolicyResultItem {
  item_id: string;
  decision: string;
  risk_score: number;
  reason: string;
}

export interface PolicyRunResponse {
  batch_id: string;
  results: PolicyResultItem[];
}

export interface ExecutionResultItem {
  item_id: string;
  status: string;
  tx_hash: string | null;
  error: string | null;
  is_simulated: boolean;
}

export interface ExecutionResponse {
  batch_id: string;
  executed: number;
  results: ExecutionResultItem[];
}

export interface SeedResponse {
  batch_id: string;
  items_created: number;
  message: string;
}


export interface WalletSetupResponse {
  wallet_set_id: string;
  wallet_id: string;
  address: string;
  blockchain: string;
  message: string;
}

export interface WalletBalanceResponse {
  wallet_id: string;
  balances: Array<{
    amount: string;
    token: {
      symbol: string;
    };
  }>;
}

export interface HealthResponse {
  status: string;
  adapter_mode: string;
  version: string;
  circle_configured: boolean;
  arc_configured: boolean;
  circle_sandbox: boolean;
}

export interface Settings {
  adapter_mode: string;
  policy_max_amount: number;
  policy_velocity_limit: number;
  supported_chains: string[];
  treasury_wallet: string;
  circle_sandbox: boolean;
  circle_wallet_configured: boolean;
  arc_chain: string;
}
