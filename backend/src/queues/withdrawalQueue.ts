import { getClient } from '../db/postgres';
import { log } from '../lib/logger';

export type WithdrawalJobHandler = (withdrawalId: number) => Promise<void>;
export type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

class WithdrawalQueue {
  private timer: NodeJS.Timeout | null = null;
  private handler: WithdrawalJobHandler | null = null;
  private staleProcessingSeconds = 300; // 5 minutes to avoid duplicate tx on slow RPC

  start(handler: WithdrawalJobHandler, intervalMs = 2000) {
    this.handler = handler;
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (!this.handler) return;

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const job = await selectNextWithdrawalJob(client, this.staleProcessingSeconds);
      if (!job) {
        await client.query('COMMIT');
        return;
      }

      await client.query(`UPDATE withdrawals SET status = 'processing' WHERE withdrawal_id = $1`, [job.withdrawal_id]);
      await client.query('COMMIT');
      await this.handler(job.withdrawal_id);
    } catch (err) {
      await client.query('ROLLBACK');
      log.error('withdrawal queue tick failed', err);
    } finally {
      client.release();
    }
  }
}

export const withdrawalQueue = new WithdrawalQueue();

export async function selectNextWithdrawalJob(client: DbClient, staleProcessingSeconds: number) {
  const pending = await client.query(
    `SELECT withdrawal_id
     FROM withdrawals
     WHERE status = 'pending'
     ORDER BY requested_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1`
  );

  const pendingRow = pending.rows[0] as { withdrawal_id: number } | undefined;
  if (pendingRow) {
    return pendingRow;
  }

  const stale = await client.query(
    `SELECT withdrawal_id
     FROM withdrawals
     WHERE status = 'processing'
       AND requested_at < NOW() - ($1 || ' seconds')::interval
     ORDER BY requested_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1`,
    [staleProcessingSeconds]
  );

  const staleRow = stale.rows[0] as { withdrawal_id: number } | undefined;
  return staleRow ?? null;
}
