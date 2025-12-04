import { query } from '../db/postgres';
import { log } from '../lib/logger';
import { getConfig } from './configService';

export async function markOfflineMiners() {
  const cfg = await getConfig();
  await query(
    `UPDATE miners
     SET status = 'offline'
     WHERE last_ping_time IS NOT NULL
       AND last_ping_time < NOW() - ($1 || ' seconds')::interval`,
    [cfg.pingTimeoutSeconds]
  );
  log.info('offline sweep complete');
}
