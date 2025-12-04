import { query } from '../db/postgres';

export async function getAdminMetrics() {
  const [active] = await query<{ count: string }>(`SELECT COUNT(*)::int as count FROM miners WHERE status='online'`);
  const [pool] = await query<{ total: number }>(`SELECT COALESCE(SUM(hashrate),0)::float as total FROM miners`);
  const [pendingWithdrawals] = await query<{ count: string }>(
    `SELECT COUNT(*)::int as count FROM withdrawals WHERE status IN ('pending','processing')`
  );
  const [distributed] = await query<{ today: string; week: string; month: string }>(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE completed_at >= date_trunc('day', NOW())),0) AS today,
       COALESCE(SUM(amount) FILTER (WHERE completed_at >= date_trunc('week', NOW())),0) AS week,
       COALESCE(SUM(amount) FILTER (WHERE completed_at >= date_trunc('month', NOW())),0) AS month
     FROM withdrawals
     WHERE status = 'completed'`
  );

  return {
    active_miners: Number(active?.count ?? 0),
    pool_hashrate: Number(pool?.total ?? 0),
    pending_withdrawals: Number(pendingWithdrawals?.count ?? 0),
    viddhana_distributed: {
      today: distributed?.today ?? '0',
      week: distributed?.week ?? '0',
      month: distributed?.month ?? '0'
    }
  };
}
