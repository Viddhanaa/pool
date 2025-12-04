import { getClient, query } from '../db/postgres';
import { log } from '../lib/logger';
import { POOL_CONFIG } from '../config/poolConfig';
import { getConfig } from './configService';
import { metrics } from './prometheusMetrics';

// Epoch snapshot for reward calculation
export interface RewardEpoch {
  epochId: number;
  poolId: string;
  startBlock: number;
  endBlock: number;
  totalReward: string;
  snapshotAt: Date;
}

// Per-pool reward weight configuration
export interface PoolRewardWeight {
  poolId: string;
  weight: number; // e.g., 0.5 = 50% of total rewards
  updatedAt: Date;
}

// User reward snapshot
export interface UserRewardSnapshot {
  userId: number;
  poolId: string;
  epochId: number;
  sharesSnapshot: string;
  rewardAmount: string;
  claimed: boolean;
}

interface RewardEpochRow {
  epoch_id: number;
  pool_id: string;
  start_block: number;
  end_block: number;
  total_reward: string;
  snapshot_at: Date;
}

interface PoolWeightRow {
  pool_id: string;
  weight: number;
  updated_at: Date;
}

interface UserRewardRow {
  user_id: number;
  pool_id: string;
  epoch_id: number;
  shares_snapshot: string;
  reward_amount: string;
  claimed: boolean;
}

/**
 * Creates a new reward epoch snapshot for a pool.
 * V1: Reward token is always BTCD.
 * V2: Can expand to support multiple reward tokens.
 * 
 * @param poolId - Target pool
 * @param startBlock - Epoch start block
 * @param endBlock - Epoch end block
 * @param totalReward - Total reward allocated to this epoch (in BTCD for V1)
 * @returns Created epoch ID
 */
export async function createRewardEpoch(
  poolId: string,
  startBlock: number,
  endBlock: number,
  totalReward: string
): Promise<number> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO pool_reward_epochs (pool_id, start_block, end_block, total_reward, snapshot_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING epoch_id`,
      [poolId, startBlock, endBlock, totalReward]
    );

    const epochId = (result.rows[0] as { epoch_id: number }).epoch_id;

    await client.query('COMMIT');
    log.info('reward epoch created', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: { 
        poolId, 
        epochId, 
        startBlock, 
        endBlock, 
        totalReward,
        rewardAsset: POOL_CONFIG.REWARD_ASSET // V1: Always BTCD
      },
      message: 'Pool reward epoch created successfully'
    });
    return epochId;
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('create reward epoch error', { poolId, err });
    throw new Error(`Failed to create reward epoch for ${poolId}: ${err}`);
  } finally {
    client.release();
  }
}

/**
 * Calculates and distributes rewards to all depositors for a given epoch.
 * V1: Single token flow - rewards are always in BTCD.
 * V2: Can expand to support multi-token rewards, bonus multipliers, lockup tiers.
 * 
 * @param epochId - Epoch ID
 * @returns Number of users rewarded
 */
export async function distributeEpochRewards(epochId: number): Promise<number> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Fetch epoch details
    const epochRows = await client.query(
      `SELECT epoch_id, pool_id, start_block, end_block, total_reward, snapshot_at
       FROM pool_reward_epochs
       WHERE epoch_id = $1`,
      [epochId]
    );

    if (!epochRows.rows.length) {
      throw new Error(`Epoch ${epochId} not found`);
    }

    const epoch = epochRows.rows[0] as RewardEpochRow;

    // V1: Simplified single asset query (assumes single pool)
    // V2: Can add WHERE conditions for multiple assets, lockup tiers, etc.
    const sharesRows = await client.query(
      `SELECT user_id, shares_owned
       FROM user_pool_shares
       WHERE pool_id = $1 AND shares_owned > 0`,
      [epoch.pool_id]
    );

    if (!sharesRows.rows.length) {
      log.warn('no users to reward in epoch', { epochId, poolId: epoch.pool_id });
      await client.query('COMMIT');
      return 0;
    }

    // Calculate total shares
    const totalShares = sharesRows.rows.reduce(
      (sum: number, row: { user_id: number; shares_owned: string }) => 
        sum + parseFloat(row.shares_owned),
      0
    );

    if (totalShares === 0) {
      log.warn('total shares zero in epoch', { epochId, poolId: epoch.pool_id });
      await client.query('COMMIT');
      return 0;
    }

    const totalReward = parseFloat(epoch.total_reward);

    // V1: Simplified proportional distribution (no lockup multipliers)
    // V2: Can add lockup multipliers, bonus calculations, etc.
    let rewardedCount = 0;
    for (const row of sharesRows.rows as Array<{ user_id: number; shares_owned: string }>) {
      const userShares = parseFloat(row.shares_owned);
      const userReward = ((userShares / totalShares) * totalReward).toFixed(18);

      // Insert user reward snapshot
      await client.query(
        `INSERT INTO pool_rewards (user_id, pool_id, epoch_id, shares_snapshot, reward_amount, claimed)
         VALUES ($1, $2, $3, $4, $5, false)
         ON CONFLICT (user_id, pool_id, epoch_id)
         DO UPDATE SET
           shares_snapshot = EXCLUDED.shares_snapshot,
           reward_amount = EXCLUDED.reward_amount`,
        [row.user_id, epoch.pool_id, epochId, row.shares_owned, userReward]
      );

      rewardedCount++;
    }

    await client.query('COMMIT');
    log.info('epoch rewards distributed', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: {
        epochId,
        poolId: epoch.pool_id,
        totalReward: epoch.total_reward,
        rewardAsset: POOL_CONFIG.REWARD_ASSET, // V1: Always BTCD
        totalShares,
        rewardedCount
      },
      message: 'Pool epoch rewards distributed to users'
    });
    return rewardedCount;
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('distribute epoch rewards error', { epochId, err });
    throw new Error(`Failed to distribute rewards for epoch ${epochId}: ${err}`);
  } finally {
    client.release();
  }
}

/**
 * Runs a pool reward cycle (extends existing mining reward logic).
 * Creates epoch and distributes rewards based on pool weights.
 * @param currentBlock - Current blockchain block number
 * @returns Number of pools processed
 */
export async function runPoolRewardCycle(currentBlock: number): Promise<number> {
  try {
    const cfg = await getConfig();
    const rewardPerMinute = (60 / Math.max(cfg.blockTimeSec, 1)) * cfg.blockReward;

    // Fetch active pools with reward weights
    const poolWeights = await getPoolRewardWeights();
    if (!poolWeights.length) {
      log.info('no pools with reward weights configured');
      return 0;
    }

    const totalWeight = poolWeights.reduce((sum, pw) => sum + pw.weight, 0);
    if (totalWeight === 0) {
      log.warn('total pool weight is zero');
      return 0;
    }

    // Assume epoch length is configurable (e.g., 100 blocks or 5 minutes)
    const epochBlocks = 100; // TODO: move to config
    const startBlock = Math.max(0, currentBlock - epochBlocks);
    const endBlock = currentBlock;

    let processedPools = 0;
    for (const poolWeight of poolWeights) {
      // Calculate pool-specific reward based on weight
      const poolReward = ((poolWeight.weight / totalWeight) * rewardPerMinute * epochBlocks).toFixed(
        18
      );

      // Create epoch
      const epochId = await createRewardEpoch(
        poolWeight.poolId,
        startBlock,
        endBlock,
        poolReward
      );

      // Distribute to users
      await distributeEpochRewards(epochId);

      processedPools++;
    }

    log.info('pool reward cycle completed', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: {
        currentBlock,
        processedPools,
        totalWeight,
        epochBlocks,
        startBlock,
        endBlock
      },
      message: 'Pool reward cycle completed successfully'
    });
    return processedPools;
  } catch (err) {
    log.error('pool reward cycle error', { currentBlock, err });
    throw new Error(`Pool reward cycle failed: ${err}`);
  }
}

/**
 * Retrieves pool reward weight configurations.
 * @returns Array of pool weights
 */
export async function getPoolRewardWeights(): Promise<PoolRewardWeight[]> {
  const rows = await query<PoolWeightRow>(
    `SELECT pool_id, weight, updated_at
     FROM pool_reward_weights
     WHERE weight > 0
     ORDER BY pool_id`
  );

  return rows.map((row) => ({
    poolId: row.pool_id,
    weight: row.weight,
    updatedAt: row.updated_at
  }));
}

/**
 * Sets or updates pool reward weight.
 * @param poolId - Target pool
 * @param weight - Reward weight (0.0 - 1.0)
 */
export async function setPoolRewardWeight(poolId: string, weight: number): Promise<void> {
  if (weight < 0 || weight > 1) {
    throw new Error('Pool weight must be between 0 and 1');
  }

  await query(
    `INSERT INTO pool_reward_weights (pool_id, weight)
     VALUES ($1, $2)
     ON CONFLICT (pool_id)
     DO UPDATE SET weight = EXCLUDED.weight, updated_at = NOW()`,
    [poolId, weight]
  );

  log.info('pool reward weight updated', {
    level: 'info',
    timestamp: new Date().toISOString(),
    context: { poolId, weight },
    message: 'Pool reward weight configuration updated'
  });
}

/**
 * Fetches user's pending pool rewards across all pools.
 * @param userId - User ID
 * @returns Array of unclaimed reward snapshots
 */
export async function getUserPendingRewards(userId: number): Promise<UserRewardSnapshot[]> {
  const rows = await query<UserRewardRow>(
    `SELECT user_id, pool_id, epoch_id, shares_snapshot, reward_amount, claimed
     FROM pool_rewards
     WHERE user_id = $1 AND claimed = false
     ORDER BY epoch_id DESC`,
    [userId]
  );

  return rows.map((row) => ({
    userId: row.user_id,
    poolId: row.pool_id,
    epochId: row.epoch_id,
    sharesSnapshot: row.shares_snapshot,
    rewardAmount: row.reward_amount,
    claimed: row.claimed
  }));
}

/**
 * Updates APY metric for a pool based on recent reward distribution.
 * @param poolId - Pool identifier
 * @param apyPercent - Calculated APY percentage
 */
export async function updatePoolApyMetric(poolId: string, apyPercent: number): Promise<void> {
  try {
    metrics.poolApyPercent.set({ pool_id: poolId }, apyPercent);
    log.info('pool APY metric updated', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: { poolId, apyPercent },
      message: 'Pool APY metric updated in Prometheus'
    });
  } catch (err) {
    log.error('pool APY metric update error', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: { poolId, apyPercent },
      message: 'Failed to update pool APY metric',
      error: err
    });
  }
}

/**
 * Claims all pending rewards for a user in a pool.
 * Updates pending_balance and marks rewards as claimed.
 * V1: Rewards are always in BTCD, single asset flow.
 * V2: Can expand to support claiming multiple reward tokens.
 * 
 * @param userId - User ID
 * @param poolId - Pool ID
 * @returns Total claimed amount (in BTCD for V1)
 */
export async function claimPoolRewards(userId: number, poolId: string): Promise<string> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // V1: Single asset query (BTCD only)
    // V2: Can add WHERE conditions for specific reward tokens
    const sumRows = await client.query(
      `SELECT COALESCE(SUM(reward_amount), 0)::numeric(38,18) AS total_rewards
       FROM pool_rewards
       WHERE user_id = $1 AND pool_id = $2 AND claimed = false`,
      [userId, poolId]
    );

    const totalRewards = (sumRows.rows[0] as { total_rewards: string }).total_rewards;
    const rewardNum = parseFloat(totalRewards);

    if (rewardNum === 0) {
      await client.query('COMMIT');
      log.info('no rewards to claim', { userId, poolId });
      return '0';
    }

    // V1: Update user balance (single BTCD balance in miners table)
    // V2: Can add multi-asset balance tracking
    await client.query(
      `UPDATE miners
       SET pending_balance = pending_balance + $1,
           total_earned = total_earned + $1
       WHERE miner_id = $2`,
      [totalRewards, userId]
    );

    // Mark rewards as claimed
    await client.query(
      `UPDATE pool_rewards
       SET claimed = true
       WHERE user_id = $1 AND pool_id = $2 AND claimed = false`,
      [userId, poolId]
    );

    await client.query('COMMIT');
    log.info('pool rewards claimed', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: { 
        userId, 
        poolId, 
        amount: totalRewards,
        rewardAsset: POOL_CONFIG.REWARD_ASSET // V1: Always BTCD
      },
      message: 'Pool rewards claimed by user'
    });
    return totalRewards;
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('claim pool rewards error', { userId, poolId, err });
    throw new Error(`Failed to claim rewards: ${err}`);
  } finally {
    client.release();
  }
}
