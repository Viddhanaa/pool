import { getClient, query } from '../db/postgres';
import { log } from '../lib/logger';

interface PoolConfigRow {
  pool_id: string;
  reward_per_minute: string;
  status: string;
}

interface PoolPositionRow {
  user_id: number;
  staked_amount: string;
}

interface RewardDistribution {
  userId: number;
  stakedAmount: string;
  rewardAmount: number;
}

// Track last distribution timestamp to ensure idempotency
let lastDistributionTime: Date | null = null;
const MIN_DISTRIBUTION_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes minimum between distributions

/**
 * Distributes BTCD rewards to all pool participants proportionally based on their stake.
 *
 * Logic:
 * 1. Read pool config (reward_per_minute, status)
 * 2. Get all users with staked_amount > 0
 * 3. Calculate total stake across all users
 * 4. For each user: reward = (userStake / totalStake) * reward_per_minute
 * 5. Update miners table: pending_balance += reward, total_earned += reward
 *
 * Idempotency:
 * - Tracks last distribution timestamp
 * - Prevents running more than once per MIN_DISTRIBUTION_INTERVAL_MS
 * - Uses atomic transactions per user to prevent double-counting
 *
 * @param poolId - Pool identifier (default: 'btcd-main-pool')
 * @returns Distribution summary with total distributed and user count
 */
export async function distributePoolRewards(poolId: string = 'btcd-main-pool'): Promise<{
  success: boolean;
  totalDistributed: number;
  userCount: number;
  message: string;
}> {
  const startTime = new Date();

  // Idempotency check: prevent rapid re-runs
  if (lastDistributionTime) {
    const timeSinceLastRun = startTime.getTime() - lastDistributionTime.getTime();
    if (timeSinceLastRun < MIN_DISTRIBUTION_INTERVAL_MS) {
      const waitTimeMs = MIN_DISTRIBUTION_INTERVAL_MS - timeSinceLastRun;
      log.info('distributePoolRewards: skipped (too soon)', {
        poolId,
        timeSinceLastRun,
        waitTimeMs,
        message: 'Distribution skipped to prevent double-counting'
      });
      return {
        success: false,
        totalDistributed: 0,
        userCount: 0,
        message: `Skipped: last run was ${(timeSinceLastRun / 1000).toFixed(0)}s ago (minimum ${MIN_DISTRIBUTION_INTERVAL_MS / 1000}s)`
      };
    }
  }

  try {
    // Step 1: Read pool config
    const configRows = await query<PoolConfigRow>(
      `SELECT pool_id, reward_per_minute, status
       FROM pool_config
       WHERE pool_id = $1`,
      [poolId]
    );

    if (!configRows.length) {
      log.error('distributePoolRewards: pool not found', { poolId });
      return {
        success: false,
        totalDistributed: 0,
        userCount: 0,
        message: `Pool '${poolId}' not found in pool_config`
      };
    }

    const config = configRows[0];

    // Check if pool is active
    if (config.status !== 'active') {
      log.warn('distributePoolRewards: pool not active', {
        poolId,
        status: config.status
      });
      return {
        success: false,
        totalDistributed: 0,
        userCount: 0,
        message: `Pool '${poolId}' is ${config.status}, not distributing rewards`
      };
    }

    const rewardPerMinute = parseFloat(config.reward_per_minute);

    if (rewardPerMinute <= 0) {
      log.warn('distributePoolRewards: reward_per_minute is zero', { poolId });
      return {
        success: false,
        totalDistributed: 0,
        userCount: 0,
        message: 'reward_per_minute is zero or negative'
      };
    }

    // Step 2: Get all users with non-zero stake
    const positions = await query<PoolPositionRow>(
      `SELECT user_id, staked_amount
       FROM pool_positions
       WHERE pool_id = $1 AND staked_amount > 0`,
      [poolId]
    );

    if (!positions.length) {
      log.info('distributePoolRewards: no users to reward', { poolId });
      lastDistributionTime = startTime; // Update timestamp even if no users
      return {
        success: true,
        totalDistributed: 0,
        userCount: 0,
        message: 'No users with staked amount > 0'
      };
    }

    // Step 3: Calculate total stake
    const totalStake = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.staked_amount);
    }, 0);

    if (totalStake === 0) {
      log.warn('distributePoolRewards: totalStake is zero', { poolId });
      lastDistributionTime = startTime;
      return {
        success: true,
        totalDistributed: 0,
        userCount: 0,
        message: 'Total stake is zero'
      };
    }

    // Step 4 & 5: Calculate and distribute rewards to each user
    const distributions: RewardDistribution[] = [];
    let totalDistributed = 0;

    for (const position of positions) {
      const userStake = parseFloat(position.staked_amount);
      const userReward = (userStake / totalStake) * rewardPerMinute;

      // Round to 18 decimal places (BTCD precision)
      const userRewardRounded = parseFloat(userReward.toFixed(18));

      if (userRewardRounded <= 0) {
        continue; // Skip if reward rounds to zero
      }

      distributions.push({
        userId: position.user_id,
        stakedAmount: position.staked_amount,
        rewardAmount: userRewardRounded
      });

      totalDistributed += userRewardRounded;
    }

    // Atomic update for each user
    const client = await getClient();
    let successfulUpdates = 0;

    try {
      for (const dist of distributions) {
        try {
          await client.query('BEGIN');

          await client.query(
            `UPDATE miners
             SET pending_balance = pending_balance + $1,
                 total_earned = total_earned + $1
             WHERE miner_id = $2`,
            [dist.rewardAmount, dist.userId]
          );

          await client.query('COMMIT');
          successfulUpdates++;

          log.info('distributePoolRewards: user rewarded', {
            poolId,
            userId: dist.userId,
            stakedAmount: dist.stakedAmount,
            rewardAmount: dist.rewardAmount,
            message: 'User pool reward distributed'
          });
        } catch (err) {
          await client.query('ROLLBACK');
          log.error('distributePoolRewards: user update failed', {
            poolId,
            userId: dist.userId,
            error: err,
            message: 'Failed to update user balance'
          });
        }
      }
    } finally {
      client.release();
    }

    // Update last distribution time on success
    lastDistributionTime = startTime;

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    log.info('distributePoolRewards: completed', {
      poolId,
      rewardPerMinute,
      totalStake,
      totalDistributed: totalDistributed.toFixed(18),
      userCount: distributions.length,
      successfulUpdates,
      durationMs: duration,
      message: `Distributed ${totalDistributed.toFixed(6)} BTCD to ${successfulUpdates} users`
    });

    return {
      success: true,
      totalDistributed,
      userCount: successfulUpdates,
      message: `Distributed ${totalDistributed.toFixed(6)} BTCD to ${successfulUpdates} users`
    };
  } catch (err) {
    log.error('distributePoolRewards: error', {
      poolId,
      error: err,
      message: 'Failed to distribute pool rewards'
    });

    return {
      success: false,
      totalDistributed: 0,
      userCount: 0,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Resets the last distribution timestamp.
 * Useful for testing or manual intervention.
 */
export function resetDistributionTimestamp(): void {
  lastDistributionTime = null;
  log.info('distributePoolRewards: timestamp reset', {
    message: 'Last distribution timestamp has been reset'
  });
}

/**
 * Gets the last distribution timestamp.
 * @returns Last distribution time or null if never run
 */
export function getLastDistributionTime(): Date | null {
  return lastDistributionTime;
}
