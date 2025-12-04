import { redis } from '../db/redis';
import { query } from '../db/postgres';

const CACHE_KEY = 'pool:hashrate:current';
const CACHE_TTL = 60; // seconds

export async function getPoolHashrateCached(): Promise<number> {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return Number(cached);

  const [row] = await query<{ total: number }>(`SELECT COALESCE(SUM(hashrate),0)::float as total FROM miners WHERE status='online'`);
  const total = Number(row?.total ?? 0);
  await redis.setex(CACHE_KEY, CACHE_TTL, total.toString());
  return total;
}
