import { query } from '../db/postgres';
import { log } from '../lib/logger';
import { getConfig } from './configService';

export async function cleanupOldData() {
  const cfg = await getConfig();
  const days = cfg.dataRetentionDays;
  await query(`DELETE FROM mining_sessions WHERE start_minute < NOW() - INTERVAL '${days} days'`);
  await query(`DELETE FROM withdrawals WHERE status = 'completed' AND completed_at < NOW() - INTERVAL '90 days'`);
  await query(`DELETE FROM ping_logs WHERE expires_at < NOW()`);
  log.info('cleanup done', { retentionDays: days });
}
