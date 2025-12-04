/**
 * BTCD Pool v1 Service
 * 
 * Provides read-only operations for BTCD Pool v1:
 * - Pool info (TVL, APR, APY, status)
 * - User positions (staked amount, pending rewards, total earned)
 * 
 * V1 Features:
 * - Single pool: btcd-main-pool
 * - Single asset: BTCD
 * - No cooldown periods
 * 
 * Based on: docs/btcd-pool-v1.md
 */

import { query } from '../db/postgres';
import { log } from '../lib/logger';

/**
 * Pool info response structure
 */
export interface PoolInfoResponse {
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

/**
 * User position response structure
 */
export interface UserPositionResponse {
  wallet_address: string;
  pool_id: string;
  staked_amount: string;
  pending_rewards: string;
  total_earned: string;
  last_updated: string;
}

/**
 * Internal pool config row from DB
 */
interface PoolConfigRow {
  pool_id: string;
  deposit_asset: string;
  reward_asset: string;
  min_withdraw_threshold: string;
  reward_per_minute: string;
  tvl: string;
  status: 'active' | 'paused';
}

/**
 * Internal pool position row from DB
 */
interface PoolPositionRow {
  staked_amount: string;
  last_updated: Date;
}

/**
 * Internal miner row from DB
 */
interface MinerRow {
  miner_id: number;
  wallet_address: string;
  total_earned: string;
  pending_balance: string;
}

/**
 * Retrieves pool information including TVL, APR, APY, and status.
 * 
 * @param poolId - Pool identifier (default: 'btcd-main-pool')
 * @returns Pool info response or null if pool not found
 */
export async function getPoolInfo(poolId: string = 'btcd-main-pool'): Promise<PoolInfoResponse | null> {
  try {
    log.info('fetching pool info', { poolId });

    // Fetch pool config from DB
    const configRows = await query<PoolConfigRow>(
      `SELECT 
        pool_id,
        deposit_asset,
        reward_asset,
        min_withdraw_threshold,
        reward_per_minute,
        tvl,
        status
      FROM pool_config
      WHERE pool_id = $1`,
      [poolId]
    );

    if (!configRows.length) {
      log.warn('pool not found', { poolId });
      return null;
    }

    const config = configRows[0];

    // Calculate APR and APY (basic formula)
    // APR = (reward_per_minute * 60 * 24 * 365) / TVL * 100
    // APY = (1 + APR/365)^365 - 1 (compound daily)
    const tvl = parseFloat(config.tvl);
    const rewardPerMinute = parseFloat(config.reward_per_minute);
    
    let apr = '0';
    let apy = '0';

    if (tvl > 0 && rewardPerMinute > 0) {
      // Annual rewards = reward per minute * 60 min * 24 hr * 365 days
      const annualRewards = rewardPerMinute * 60 * 24 * 365;
      const aprValue = (annualRewards / tvl) * 100;
      apr = aprValue.toFixed(2);

      // APY with daily compounding
      const apyValue = (Math.pow(1 + aprValue / 100 / 365, 365) - 1) * 100;
      apy = apyValue.toFixed(2);
    }

    const response: PoolInfoResponse = {
      pool_id: config.pool_id,
      name: config.pool_id === 'btcd-main-pool' ? 'BTCD Main Pool' : config.pool_id,
      deposit_asset: config.deposit_asset,
      reward_asset: config.reward_asset,
      tvl: config.tvl,
      apr,
      apy,
      status: config.status,
      min_withdraw_threshold: config.min_withdraw_threshold
    };

    log.info('pool info retrieved', { 
      poolId, 
      tvl: config.tvl, 
      apr, 
      apy, 
      status: config.status 
    });

    return response;
  } catch (err) {
    log.error('error fetching pool info', { poolId, err });
    throw new Error(`Failed to fetch pool info for ${poolId}: ${err}`);
  }
}

/**
 * Retrieves user position in a pool including staked amount, pending rewards, and total earned.
 * 
 * @param walletAddress - User's wallet address
 * @param poolId - Pool identifier (default: 'btcd-main-pool')
 * @returns User position response or null if user/position not found
 */
export async function getUserPosition(
  walletAddress: string,
  poolId: string = 'btcd-main-pool'
): Promise<UserPositionResponse | null> {
  try {
    log.info('fetching user position', { walletAddress, poolId });

    // Find user by wallet address
    const minerRows = await query<MinerRow>(
      `SELECT miner_id, wallet_address, total_earned, pending_balance
       FROM miners
       WHERE LOWER(wallet_address) = LOWER($1)`,
      [walletAddress]
    );

    if (!minerRows.length) {
      log.warn('user not found', { walletAddress });
      return null;
    }

    const miner = minerRows[0];

    // Fetch user's pool position
    const positionRows = await query<PoolPositionRow>(
      `SELECT staked_amount, last_updated
       FROM pool_positions
       WHERE user_id = $1 AND pool_id = $2`,
      [miner.miner_id, poolId]
    );

    // If no position exists, return zeros (user exists but hasn't deposited)
    const stakedAmount = positionRows.length ? positionRows[0].staked_amount : '0';
    const lastUpdated = positionRows.length 
      ? positionRows[0].last_updated.toISOString() 
      : new Date().toISOString();

    const response: UserPositionResponse = {
      wallet_address: miner.wallet_address,
      pool_id: poolId,
      staked_amount: stakedAmount,
      pending_rewards: miner.pending_balance, // pending_balance is claimable rewards
      total_earned: miner.total_earned,
      last_updated: lastUpdated
    };

    log.info('user position retrieved', { 
      walletAddress, 
      poolId, 
      stakedAmount, 
      pendingRewards: miner.pending_balance 
    });

    return response;
  } catch (err) {
    log.error('error fetching user position', { walletAddress, poolId, err });
    throw new Error(`Failed to fetch user position for ${walletAddress}: ${err}`);
  }
}

/**
 * Records a deposit after on-chain transaction succeeds.
 * Updates pool_positions and creates miner record if needed.
 * 
 * @param walletAddress - User's wallet address
 * @param poolId - Pool identifier (default: 'btcd-main-pool')
 * @param amount - Amount deposited (in BTCD, as string)
 * @returns Success indicator
 */
export async function recordDeposit(
  walletAddress: string,
  poolId: string = 'btcd-main-pool',
  amount: string
): Promise<{ success: boolean; message: string }> {
  try {
    log.info('recording deposit', { walletAddress, poolId, amount });

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error(`Invalid deposit amount: ${amount}`);
    }

    // Ensure user exists in miners table
    let minerRows = await query<MinerRow>(
      `SELECT miner_id, wallet_address FROM miners WHERE LOWER(wallet_address) = LOWER($1)`,
      [walletAddress]
    );

    let minerId: number;

    if (!minerRows.length) {
      // Create new miner record
      const insertRes = await query<{ miner_id: number }>(
        `INSERT INTO miners (wallet_address, total_earned, pending_balance) 
         VALUES ($1, 0, 0) 
         RETURNING miner_id`,
        [walletAddress]
      );
      minerId = insertRes[0].miner_id;
      log.info('created new miner record', { walletAddress, minerId });
    } else {
      minerId = minerRows[0].miner_id;
    }

    // Upsert pool_positions
    await query(
      `INSERT INTO pool_positions (user_id, pool_id, staked_amount, last_updated)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, pool_id) 
       DO UPDATE SET 
         staked_amount = pool_positions.staked_amount + EXCLUDED.staked_amount,
         last_updated = NOW()`,
      [minerId, poolId, amount]
    );

    log.info('deposit recorded successfully', { 
      walletAddress, 
      poolId, 
      amount, 
      minerId 
    });

    return {
      success: true,
      message: `Deposited ${amount} BTCD to ${poolId}`
    };
  } catch (err) {
    log.error('error recording deposit', { walletAddress, poolId, amount, err });
    throw new Error(`Failed to record deposit: ${err}`);
  }
}
