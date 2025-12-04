export type MinerStatus = 'online' | 'offline';
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Miner {
  miner_id: number;
  wallet_address: string;
  device_type: string | null;
  hashrate: number;
  pending_balance: string;
  total_earned: string;
  last_ping_time: Date | null;
  status: MinerStatus;
  created_at: Date;
}

export interface MiningSession {
  session_id: number;
  miner_id: number;
  start_minute: Date;
  hashrate_snapshot: number;
  reward_amount: string;
  created_at: Date;
  expires_at: Date | null;
}

export interface WithdrawalRequest {
  withdrawal_id: number;
  miner_id: number;
  amount: string;
  wallet_address: string;
  status: WithdrawalStatus;
  tx_hash: string | null;
  requested_at: Date;
  completed_at: Date | null;
  error_message: string | null;
}

export interface MinerStatsResponse {
  pending_balance: string;
  total_earned: string;
  active_minutes_today: number;
  current_hashrate: number;
  pool_hashrate: number;
}

// Re-export pool types
export * from './pool';
