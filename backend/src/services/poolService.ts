import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

import { config } from '../config/env';
import { POOL_CONFIG, isValidDepositAsset } from '../config/poolConfig';
import { query } from '../db/postgres';
import { log } from '../lib/logger';
import { metrics } from './prometheusMetrics';

// Pool accounting state from on-chain
export interface PoolState {
  poolId: string;
  totalValueLocked: string; // in base asset units
  totalShares: string;
  exchangeRate: string; // underlying per share
  paused: boolean;
  lastUpdateBlock: number;
}

// User pool position
export interface UserPoolPosition {
  poolId: string;
  userId: number;
  sharesOwned: string;
  underlyingValue: string;
  pendingRewards: string;
  lastDepositTime: Date | null;
}

// Deposit/withdraw validation result
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Pool row in DB
interface PoolRow {
  pool_id: string;
  asset_address: string;
  total_value_locked: string;
  total_shares: string;
  exchange_rate: string;
  paused: boolean;
  last_update_block: number;
  updated_at: Date;
}

// User pool shares row in DB
interface UserPoolSharesRow {
  user_id: number;
  pool_id: string;
  shares_owned: string;
  last_deposit_time: Date | null;
}

// Minimal ERC20-like pool contract ABI for reading state
const POOL_ABI = [
  'function totalValueLocked() view returns (uint256)',
  'function totalShares() view returns (uint256)',
  'function exchangeRate() view returns (uint256)',
  'function paused() view returns (bool)',
  'function minDepositAmount() view returns (uint256)',
  'function maxDepositAmount() view returns (uint256)',
  'function withdrawalCooldownSeconds() view returns (uint256)'
];

/**
 * Fetches on-chain pool state and syncs to local DB.
 * @param poolId - Unique pool identifier (contract address or pool name)
 * @param contractAddress - Deployed pool contract address
 * @returns Current pool state
 */
export async function syncPoolState(poolId: string, contractAddress: string): Promise<PoolState> {
  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    const poolContract = new Contract(contractAddress, POOL_ABI, provider);

    const [tvl, totalShares, exchangeRate, paused, blockNumber] = await Promise.all([
      poolContract.totalValueLocked(),
      poolContract.totalShares(),
      poolContract.exchangeRate(),
      poolContract.paused(),
      provider.getBlockNumber()
    ]);

    const poolState: PoolState = {
      poolId,
      totalValueLocked: formatUnits(tvl, 18),
      totalShares: formatUnits(totalShares, 18),
      exchangeRate: formatUnits(exchangeRate, 18),
      paused,
      lastUpdateBlock: blockNumber
    };

    // Upsert pool state to DB
    await query(
      `INSERT INTO pools (pool_id, asset_address, total_value_locked, total_shares, exchange_rate, paused, last_update_block)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (pool_id)
       DO UPDATE SET
         total_value_locked = EXCLUDED.total_value_locked,
         total_shares = EXCLUDED.total_shares,
         exchange_rate = EXCLUDED.exchange_rate,
         paused = EXCLUDED.paused,
         last_update_block = EXCLUDED.last_update_block,
         updated_at = NOW()`,
      [
        poolState.poolId,
        contractAddress,
        poolState.totalValueLocked,
        poolState.totalShares,
        poolState.exchangeRate,
        poolState.paused ? 1 : 0,
        poolState.lastUpdateBlock
      ]
    );

    // Update Prometheus metrics
    metrics.poolTvlUsd.set({ pool_id: poolId }, parseFloat(poolState.totalValueLocked));

    log.info('pool state synced', {
      poolId,
      tvl: poolState.totalValueLocked,
      totalShares: poolState.totalShares,
      exchangeRate: poolState.exchangeRate,
      paused,
      blockNumber
    });
    return poolState;
  } catch (err) {
    log.error('pool state sync error', { poolId, err });
    throw new Error(`Failed to sync pool state for ${poolId}: ${err}`);
  }
}

/**
 * Retrieves cached pool state from DB (no on-chain call).
 * @param poolId - Pool identifier
 * @returns Pool state or null if not found
 */
export async function getCachedPoolState(poolId: string): Promise<PoolState | null> {
  const rows = await query<PoolRow>(
    `SELECT pool_id, asset_address, total_value_locked, total_shares, exchange_rate, paused, last_update_block
     FROM pools
     WHERE pool_id = $1`,
    [poolId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    poolId: row.pool_id,
    totalValueLocked: row.total_value_locked,
    totalShares: row.total_shares,
    exchangeRate: row.exchange_rate,
    paused: row.paused,
    lastUpdateBlock: row.last_update_block
  };
}

/**
 * Queries user's pool position (shares owned, underlying value, pending rewards).
 * @param userId - Internal user ID (miner_id or similar)
 * @param poolId - Pool identifier
 * @returns User position or null if no shares
 */
export async function getUserPoolPosition(
  userId: number,
  poolId: string
): Promise<UserPoolPosition | null> {
  const sharesRows = await query<UserPoolSharesRow>(
    `SELECT user_id, pool_id, shares_owned, last_deposit_time
     FROM user_pool_shares
     WHERE user_id = $1 AND pool_id = $2`,
    [userId, poolId]
  );

  if (!sharesRows.length) return null;

  const sharesRow = sharesRows[0];
  const poolState = await getCachedPoolState(poolId);
  if (!poolState) {
    log.warn('pool state not found for user position', { userId, poolId });
    return null;
  }

  // Calculate underlying value: shares * exchangeRate
  const sharesOwned = parseFloat(sharesRow.shares_owned);
  const exchangeRate = parseFloat(poolState.exchangeRate);
  const underlyingValue = (sharesOwned * exchangeRate).toFixed(18);

  // Fetch pending rewards from pool_rewards table (implemented in poolRewardService)
  const rewardRows = await query<{ pending_rewards: string }>(
    `SELECT COALESCE(SUM(reward_amount), 0)::numeric(38,18) AS pending_rewards
     FROM pool_rewards
     WHERE user_id = $1 AND pool_id = $2 AND claimed = false`,
    [userId, poolId]
  );

  const pendingRewards = rewardRows.length ? rewardRows[0].pending_rewards : '0';

  return {
    poolId,
    userId,
    sharesOwned: sharesRow.shares_owned,
    underlyingValue,
    pendingRewards,
    lastDepositTime: sharesRow.last_deposit_time
  };
}

/**
 * Validates deposit request against pool rules (amounts, caps, cooldowns).
 * V1: Simplified validation - only BTCD asset, no lockup/cooldown checks.
 * V2: Can add asset switching, lockup validation, multi-asset support.
 * 
 * @param userId - User attempting deposit
 * @param poolId - Target pool
 * @param amount - Deposit amount in base asset units (e.g., "100.0" BTCD)
 * @param asset - Asset to deposit (V1: must be BTCD)
 * @param contractAddress - Pool contract address
 * @returns Validation result with error message if invalid
 */
export async function validateDepositRequest(
  userId: number,
  poolId: string,
  amount: string,
  asset: string,
  contractAddress: string
): Promise<ValidationResult> {
  try {
    // V1: Validate BTCD-only asset
    if (!isValidDepositAsset(asset)) {
      return { 
        valid: false, 
        error: `Invalid asset: ${asset}. V1 only supports ${POOL_CONFIG.DEPOSIT_ASSET}` 
      };
    }

    // V1: Validate single pool
    if (poolId !== POOL_CONFIG.POOL_ID) {
      return { 
        valid: false, 
        error: `Invalid pool: ${poolId}. V1 only supports ${POOL_CONFIG.POOL_ID}` 
      };
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return { valid: false, error: 'Invalid deposit amount' };
    }

    // Check if pool is paused
    const poolState = await getCachedPoolState(poolId);
    if (!poolState) {
      return { valid: false, error: 'Pool not found' };
    }
    if (poolState.paused) {
      return { valid: false, error: 'Pool is paused' };
    }

    // V1: Simplified TVL cap check (no complex asset switching logic)
    // Check TVL cap from risk service would be done here or in a pre-check
    // Note: newTvl calculation reserved for future TVL validation logic

    // Fetch on-chain deposit limits
    const provider = new JsonRpcProvider(config.rpcUrl);
    const poolContract = new Contract(contractAddress, POOL_ABI, provider);
    const [minDeposit, maxDeposit] = await Promise.all([
      poolContract.minDepositAmount(),
      poolContract.maxDepositAmount()
    ]);

    const minDepositNum = parseFloat(formatUnits(minDeposit, 18));
    const maxDepositNum = parseFloat(formatUnits(maxDeposit, 18));

    if (amountNum < minDepositNum) {
      return { valid: false, error: `Deposit below minimum: ${minDepositNum}` };
    }
    if (amountNum > maxDepositNum) {
      return { valid: false, error: `Deposit exceeds maximum: ${maxDepositNum}` };
    }

    // Check user balance (assuming user has pending_balance field similar to miners)
    const userRows = await query<{ pending_balance: string }>(
      `SELECT pending_balance FROM miners WHERE miner_id = $1`,
      [userId]
    );
    if (!userRows.length) {
      return { valid: false, error: 'User not found' };
    }

    const userBalance = parseFloat(userRows[0].pending_balance);
    if (userBalance < amountNum) {
      return { valid: false, error: 'Insufficient balance' };
    }

    log.info('deposit validation passed', {
      userId,
      poolId,
      amount,
      asset,
      userBalance,
      minDeposit: minDepositNum,
      maxDeposit: maxDepositNum
    });
    return { valid: true };
  } catch (err) {
    log.error('deposit validation error', { userId, poolId, amount, asset, err });
    return { valid: false, error: 'Validation failed due to internal error' };
  }
}

/**
 * Validates withdrawal request against pool rules (cooldowns, caps, shares).
 * V1: No cooldown validation (instant withdrawals), BTCD only.
 * V2: Can add cooldown checks, lockup validation, multi-asset support.
 * 
 * @param userId - User attempting withdrawal
 * @param poolId - Target pool
 * @param sharesAmount - Shares to withdraw (e.g., "10.0")
 * @param contractAddress - Pool contract address
 * @returns Validation result with error message if invalid
 */
export async function validateWithdrawalRequest(
  userId: number,
  poolId: string,
  sharesAmount: string,
  _contractAddress: string
): Promise<ValidationResult> {
  try {
    // V1: Validate single pool
    if (poolId !== POOL_CONFIG.POOL_ID) {
      return { 
        valid: false, 
        error: `Invalid pool: ${poolId}. V1 only supports ${POOL_CONFIG.POOL_ID}` 
      };
    }

    const sharesNum = parseFloat(sharesAmount);
    if (isNaN(sharesNum) || sharesNum <= 0) {
      return { valid: false, error: 'Invalid shares amount' };
    }

    // Check if pool is paused
    const poolState = await getCachedPoolState(poolId);
    if (!poolState) {
      return { valid: false, error: 'Pool not found' };
    }
    if (poolState.paused) {
      return { valid: false, error: 'Pool is paused' };
    }

    // Check user shares
    const position = await getUserPoolPosition(userId, poolId);
    if (!position) {
      return { valid: false, error: 'No pool position found' };
    }

    const userShares = parseFloat(position.sharesOwned);
    if (userShares < sharesNum) {
      return { valid: false, error: 'Insufficient shares' };
    }

    // V1: No cooldown validation (instant withdrawals)
    // COOLDOWN_PERIOD is set to 0 in poolConfig
    // V2 expansion: Add cooldown check when COOLDOWN_PERIOD > 0
    // if (POOL_CONFIG.COOLDOWN_PERIOD > 0 && position.lastDepositTime) {
    //   const timeSinceDeposit = Date.now() - position.lastDepositTime.getTime();
    //   const cooldownMs = POOL_CONFIG.COOLDOWN_PERIOD * 1000;
    //   if (timeSinceDeposit < cooldownMs) {
    //     const remainingSec = Math.ceil((cooldownMs - timeSinceDeposit) / 1000);
    //     return { valid: false, error: `Withdrawal cooldown: ${remainingSec}s remaining` };
    //   }
    // }

    log.info('withdrawal validation passed', {
      userId,
      poolId,
      sharesAmount,
      userShares,
      cooldownPeriod: POOL_CONFIG.COOLDOWN_PERIOD
    });
    return { valid: true };
  } catch (err) {
    log.error('withdrawal validation error', { userId, poolId, sharesAmount, err });
    return { valid: false, error: 'Validation failed due to internal error' };
  }
}

/**
 * Records a successful deposit transaction and updates metrics.
 * V1: Asset is always BTCD.
 * V2: Can expand to support multiple assets.
 * 
 * @param userId - User who deposited
 * @param poolId - Target pool
 * @param amount - Deposit amount
 * @param asset - Asset address (V1: always BTCD)
 * @param sharesReceived - Shares minted
 * @param txHash - Transaction hash
 */
export async function recordDeposit(
  userId: number,
  poolId: string,
  amount: string,
  asset: string,
  sharesReceived: string,
  txHash: string
): Promise<void> {
  try {
    // V1: Assert BTCD asset
    const assetToRecord = POOL_CONFIG.DEPOSIT_ASSET;

    // Increment Prometheus counter
    metrics.poolDepositsTotal.inc({ pool_id: poolId, asset: assetToRecord });

    // Update user shares in DB
    await query(
      `INSERT INTO user_pool_shares (user_id, pool_id, shares_owned, last_deposit_time)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, pool_id)
       DO UPDATE SET
         shares_owned = user_pool_shares.shares_owned + EXCLUDED.shares_owned,
         last_deposit_time = NOW()`,
      [userId, poolId, sharesReceived]
    );

    log.info('deposit recorded', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: { userId, poolId, amount, asset: assetToRecord, sharesReceived, txHash },
      message: 'Pool deposit completed successfully'
    });
  } catch (err) {
    log.error('deposit recording error', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: { userId, poolId, amount, asset, txHash },
      message: 'Failed to record pool deposit',
      error: err
    });
    throw err;
  }
}

/**
 * Records a successful withdrawal transaction and updates metrics.
 * V1: Asset is always BTCD.
 * V2: Can expand to support multiple assets.
 * 
 * @param userId - User who withdrew
 * @param poolId - Target pool
 * @param sharesBurned - Shares burned
 * @param asset - Asset address (V1: always BTCD)
 * @param underlyingAmount - Amount withdrawn
 * @param txHash - Transaction hash
 */
export async function recordWithdrawal(
  userId: number,
  poolId: string,
  sharesBurned: string,
  asset: string,
  underlyingAmount: string,
  txHash: string
): Promise<void> {
  try {
    // V1: Assert BTCD asset
    const assetToRecord = POOL_CONFIG.DEPOSIT_ASSET;

    // Increment Prometheus counter
    metrics.poolWithdrawalsTotal.inc({ pool_id: poolId, asset: assetToRecord });

    // Update user shares in DB
    await query(
      `UPDATE user_pool_shares
       SET shares_owned = shares_owned - $1
       WHERE user_id = $2 AND pool_id = $3`,
      [sharesBurned, userId, poolId]
    );

    // Delete row if shares reach zero
    await query(
      `DELETE FROM user_pool_shares
       WHERE user_id = $1 AND pool_id = $2 AND shares_owned <= 0`,
      [userId, poolId]
    );

    log.info('withdrawal recorded', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: { userId, poolId, sharesBurned, asset: assetToRecord, underlyingAmount, txHash },
      message: 'Pool withdrawal completed successfully'
    });
  } catch (err) {
    log.error('withdrawal recording error', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: { userId, poolId, sharesBurned, asset, txHash },
      message: 'Failed to record pool withdrawal',
      error: err
    });
    throw err;
  }
}

/**
 * Lists all active pools from DB.
 * @returns Array of pool states
 */
export async function listPools(): Promise<PoolState[]> {
  const rows = await query<PoolRow>(
    `SELECT pool_id, asset_address, total_value_locked, total_shares, exchange_rate, paused, last_update_block
     FROM pools
     ORDER BY pool_id`
  );

  return rows.map((row) => ({
    poolId: row.pool_id,
    totalValueLocked: row.total_value_locked,
    totalShares: row.total_shares,
    exchangeRate: row.exchange_rate,
    paused: row.paused,
    lastUpdateBlock: row.last_update_block
  }));
}
