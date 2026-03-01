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

// ── Agent Types ────────────────────────────────────────────────────────

export interface AgentActivity {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  strategy: string;
  timestamp: string;
}

export interface AgentStatus {
  running: boolean;
  strategy: string;
  cycle_count: number;
  last_cycle_at: string | null;
  strategy_config: Record<string, unknown>;
  available_strategies: string[];
}

export interface AgentStrategyInfo {
  description: string;
  auto_approve_max_risk: number;
  auto_approve_max_amount: number;
  auto_approve_decisions: string[];
  max_retries: number;
  loop_interval: number;
}

// ── Treasury / RWA Types ───────────────────────────────────────────────

export interface TreasuryPosition {
  id: string;
  asset_symbol: string;
  asset_name: string;
  category: string;
  amount_usdc: number;
  shares: number;
  apy: number;
  risk_rating: string;
  status: string;
  chain: string;
  tx_hash: string;
  allocated_at: string;
  updated_at: string;
  current_value: number;
  accrued_yield: number;
}

export interface TreasuryHealth {
  overall_score: number;
  overall_status: string;
  liquidity: { score: number; status: string; reserve_ratio: number; min_required: number };
  diversification: { score: number; status: string; categories: number };
  yield: { score: number; status: string; weighted_apy: number };
}

export interface TreasuryOverview {
  usdc_liquid: number;
  total_rwa_principal: number;
  total_rwa_current_value: number;
  total_accrued_yield: number;
  total_aum: number;
  reserve_ratio: number;
  weighted_avg_apy: number;
  position_count: number;
  positions: TreasuryPosition[];
  category_breakdown: Record<string, { count: number; principal: number; current_value: number; avg_apy: number }>;
  config: { min_reserve_ratio: number; target_reserve_ratio: number; rebalance_threshold: number };
  health: TreasuryHealth;
}

export interface RwaAsset {
  name: string;
  symbol: string;
  category: string;
  apy: number;
  risk_rating: string;
  maturity_days: number;
  min_investment: number;
  issuer: string;
  chain: string;
  description: string;
}

// ── Gateway Types ──────────────────────────────────────────────────────

export interface GatewayChainInfo {
  name: string;
  chain_id: number;
  testnet_chain_id: number;
  testnet_name: string;
  gateway_contract: string;
  usdc_contract: string;
  deposit_gas_estimate: string;
  status: string;
}

export interface GatewayInfo {
  provider: string;
  description: string;
  product_url: string;
  supported_chains: Record<string, GatewayChainInfo>;
  chain_count: number;
  key_features: string[];
  transfer_flow: string[];
  vs_cctp: {
    cctp: string;
    gateway: string;
    recommendation: string;
  };
}

export interface GatewayBalance {
  unified_balance_usdc: number;
  deposits_by_chain: Record<string, number>;
  available_to_mint: number;
  chains_with_balance: string[];
  total_chains: number;
}

export interface GatewayTransaction {
  id: string;
  type: string;
  source_chain: string | null;
  destination_chain: string | null;
  amount_usdc: number;
  fee_usdc: number;
  status: string;
  tx_hash: string | null;
  gateway_address: string | null;
  created_at: string;
  updated_at: string;
}

// ── Bridge / CCTP Types ────────────────────────────────────────────────

export interface CctpDomainInfo {
  domain: number;
  chain_id: number;
  testnet_chain_id: number;
  testnet_name: string;
  usdc_contract: string;
}

export type CctpDomains = Record<string, CctpDomainInfo>;

export interface BridgeRoute {
  source_chain: string;
  destination_chain: string;
  source_domain: number;
  destination_domain: number;
  fee_usdc: number;
  estimated_seconds: number;
  protocol: string;
  status: string;
}

export interface BridgePlanStep {
  step: number;
  action: string;
  chain: string;
  contract?: string;
  description: string;
}

export interface BridgePlan {
  type: string;
  source_chain: string;
  destination_chain: string;
  steps: BridgePlanStep[];
  fee_usdc: number;
  estimated_seconds: number;
  net_amount: number;
  gross_amount?: number;
  attestation_url?: string;
}
