// Pool-related request and response types

// V1 Constants: Single pool, single asset, no cooldown
export const V1_DEFAULT_POOL_ID = 'btcd-main-pool';
export const V1_SUPPORTED_ASSET = 'BTCD';

export interface PoolInfoResponse {
  poolId: string;
  name: string;
  asset: string;
  tvl: string;
  apy: string;
  exchangeRate: string;
  totalShares: string;
  status: 'active' | 'paused';
  depositCap?: string;
  // V1: No cooldown period (immediate withdrawals)
  cooldownPeriod?: number;
}

export interface UserBalanceResponse {
  address: string;
  poolId: string;
  shares: string;
  underlyingBalance: string;
  pendingRewards: string;
  // V1: No cooldown period (removed)
}

export interface DepositRequest {
  // V1: poolId defaults to btcd-main-pool if not provided
  poolId?: string;
  amount: string;
  // V1: Only BTCD supported
  asset: string;
  address: string;
  signature: string;
  timestamp: number;
  nonce: string;
}

export interface DepositResponse {
  success: boolean;
  shares: string;
  txHash?: string;
}

export interface WithdrawRequest {
  // V1: poolId defaults to btcd-main-pool if not provided
  poolId?: string;
  amount: string;
  address: string;
  signature: string;
  timestamp: number;
  nonce: string;
}

export interface WithdrawResponse {
  success: boolean;
  underlyingAmount: string;
  txHash?: string;
  withdrawal_id?: number;
  status?: string;
  estimated_completion?: string;
}

export interface RewardsResponse {
  address: string;
  totalPending: string;
  totalClaimed: string;
  rewardsByPool: Array<{
    poolId: string;
    pending: string;
    claimed: string;
  }>;
}

export interface CreatePoolRequest {
  name: string;
  asset: string;
  depositCap?: string;
  cooldownPeriod: number;
  rewardWeight: number;
}

export interface CreatePoolResponse {
  success: boolean;
  poolId: string;
}

export interface PausePoolRequest {
  poolId: string;
  reason: string;
}

export interface SetRewardWeightsRequest {
  poolId: string;
  weights: Record<string, number>;
}

export interface RiskStatusResponse {
  poolId: string;
  circuitBreakerActive: boolean;
  currentTvl: string;
  tvlCap: string;
  utilizationRate: string;
  oracleStatus: 'healthy' | 'stale' | 'failed';
  lastOracleUpdate: number;
  withdrawalCap24h: string;
  withdrawalsLast24h: string;
}

// BTCD Pool v1 Response Types (as per docs/btcd-pool-v1.md spec)
export interface BtcdPoolInfoResponse {
  pool_id: string;
  name: string;
  deposit_asset: string;
  reward_asset: string;
  tvl: string;
  apr: string;
  apy: string;
  status: 'active' | 'paused';
  min_withdraw_threshold: string;
}

export interface BtcdUserPositionResponse {
  wallet_address: string;
  pool_id: string;
  staked_amount: string;
  pending_rewards: string;
  total_earned: string;
  last_updated: string;
}
