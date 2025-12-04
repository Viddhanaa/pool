import { redis } from '../db/redis';
import { getClient } from '../db/postgres';
import { log } from '../lib/logger';
import { clearHashrateCache } from './pingService';

const UPDATE_LIMIT = 5;
const UPDATE_WINDOW_SECONDS = 3600;
const MAX_HASHRATE = 1_000_000_000_000; // cap to 1e12 H/s to prevent abuse

const rateKey = (minerId: number) => `hashrate-update:${minerId}`;

export async function updateHashrate(minerId: number, newHashrate: number, deviceType?: string) {
  const count = await redis.incr(rateKey(minerId));
  if (count === 1) await redis.expire(rateKey(minerId), UPDATE_WINDOW_SECONDS);
  if (count > UPDATE_LIMIT) {
    throw new Error('Hashrate update rate limit exceeded');
  }

  if (!Number.isFinite(newHashrate) || newHashrate <= 0 || newHashrate > MAX_HASHRATE) {
    throw new Error('Invalid hashrate');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT hashrate FROM miners WHERE miner_id = $1 FOR UPDATE`,
      [minerId]
    );
    const current = existing.rows[0] as { hashrate: number } | undefined;
    if (!current) throw new Error('Miner not found');

    await client.query(
      `UPDATE miners
       SET hashrate = $1, device_type = COALESCE($2, device_type)
       WHERE miner_id = $3`,
      [newHashrate, deviceType ?? null, minerId]
    );

    await client.query(
      `INSERT INTO hashrate_audit (miner_id, old_hashrate, new_hashrate)
       VALUES ($1, $2, $3)`,
      [minerId, current.hashrate, newHashrate]
    );

    await client.query('COMMIT');
    clearHashrateCache(minerId);
    log.info('hashrate updated and cache cleared', { minerId, newHashrate });
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('hashrate update failed', err);
    throw err;
  } finally {
    client.release();
  }
}
