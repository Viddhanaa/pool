import { query } from '../db/postgres';
import { MinerStatsResponse } from '../types';
import { getPoolHashrateCached } from './poolHashrateCache';

export async function getMinerStats(minerId: number): Promise<MinerStatsResponse> {
  const [miner] = await query<{
    pending_balance: string;
    total_earned: string;
    hashrate: number;
  }>(`SELECT pending_balance, total_earned, hashrate FROM miners WHERE miner_id = $1`, [minerId]);

  if (!miner) {
    throw new Error('Miner not found');
  }

  const poolHashrate = await getPoolHashrateCached();

  const [activeRow] = await query<{ active_minutes_today: number }>(
    `SELECT COUNT(*)::int AS active_minutes_today
     FROM mining_sessions
     WHERE miner_id = $1 AND start_minute >= date_trunc('day', NOW())`,
    [minerId]
  );

  return {
    pending_balance: miner.pending_balance,
    total_earned: miner.total_earned,
    active_minutes_today: activeRow?.active_minutes_today ?? 0,
    current_hashrate: miner.hashrate,
    pool_hashrate: poolHashrate
  };
}

export async function getEarningsHistory(minerId: number, periodDays = 7) {
  return query<{ date: string; earned_amount: string }>(
    `SELECT date_trunc('day', start_minute) AS date,
            SUM(reward_amount) AS earned_amount
     FROM mining_sessions
     WHERE miner_id = $1 AND start_minute >= NOW() - ($2 || ' days')::interval
     GROUP BY date_trunc('day', start_minute)
     ORDER BY date ASC`,
    [minerId, periodDays]
  );
}

export async function getHashrateHistory(minerId: number) {
  return query<{ timestamp: string; hashrate: number }>(
    `SELECT start_minute as timestamp, hashrate_snapshot as hashrate
     FROM mining_sessions
     WHERE miner_id = $1 AND start_minute >= NOW() - INTERVAL '24 hours'
     ORDER BY start_minute ASC`,
    [minerId]
  );
}

export async function getActiveMinutesHistory(minerId: number) {
  return query<{ date: string; minutes: number }>(
    `SELECT date_trunc('day', start_minute) as date, COUNT(*)::int as minutes
     FROM mining_sessions
     WHERE miner_id = $1 AND start_minute >= NOW() - INTERVAL '7 days'
     GROUP BY date_trunc('day', start_minute)
     ORDER BY date ASC`,
    [minerId]
  );
}
