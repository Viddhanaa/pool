import { getClient, query } from '../db/postgres';
import { log } from '../lib/logger';
import { getConfig } from './configService';

interface ActiveSessionRow {
  miner_id: number;
  total_reward: string;
  minutes_count: number;
}

export async function runRewardCycle(intervalMinutes?: number) {
  const cfg = await getConfig();
  const interval = Math.max(1, intervalMinutes ?? cfg.rewardUpdateIntervalMinutes);
  const rewardPerMinute = (60 / Math.max(cfg.blockTimeSec, 1)) * cfg.blockReward;

  const end = new Date();
  const start = new Date(end.getTime() - interval * 60_000);

  const activeSessions = await query<ActiveSessionRow>(
    `WITH minute_totals AS (
      SELECT 
        start_minute,
        SUM(hashrate_snapshot) AS pool_hashrate_at_minute
      FROM mining_sessions
      WHERE start_minute >= $1 AND start_minute < $2 
        AND reward_amount = 0
      GROUP BY start_minute
    ),
    minute_rewards AS (
      SELECT 
        ms.miner_id,
        ms.start_minute,
        ms.hashrate_snapshot,
        mt.pool_hashrate_at_minute,
        CASE 
          WHEN mt.pool_hashrate_at_minute > 0 
          THEN (ms.hashrate_snapshot::numeric / mt.pool_hashrate_at_minute) * $3
          ELSE 0
        END AS reward_for_minute
      FROM mining_sessions ms
      JOIN minute_totals mt ON ms.start_minute = mt.start_minute
      WHERE ms.start_minute >= $1 AND ms.start_minute < $2
        AND ms.reward_amount = 0
    )
    SELECT 
      miner_id,
      SUM(reward_for_minute)::numeric(38,18) AS total_reward,
      COUNT(*)::int AS minutes_count
    FROM minute_rewards
    GROUP BY miner_id`,
    [start.toISOString(), end.toISOString(), rewardPerMinute]
  );

  if (!activeSessions.length) {
    log.info('reward cycle skipped (no active sessions)');
    return;
  }

  for (const session of activeSessions) {
    const minerMinutes = session.minutes_count;
    const rewardTotal = Number(session.total_reward);
    if (minerMinutes === 0 || rewardTotal === 0) continue;

    const rewardPerMinuteForSession = rewardTotal / minerMinutes;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE miners
         SET pending_balance = pending_balance + $1,
             total_earned = total_earned + $1
         WHERE miner_id = $2`,
        [rewardTotal, session.miner_id]
      );

      await client.query(
        `UPDATE mining_sessions
         SET reward_amount = $1
         WHERE miner_id = $2
           AND start_minute >= $3 AND start_minute < $4
           AND reward_amount = 0`,
        [rewardPerMinuteForSession, session.miner_id, start.toISOString(), end.toISOString()]
      );

      await client.query('COMMIT');
      log.info('reward allocated', { minerId: session.miner_id, amount: rewardTotal });
    } catch (err) {
      await client.query('ROLLBACK');
      log.error('reward cycle error', err);
    } finally {
      client.release();
    }
  }
}
