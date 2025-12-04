import { redis } from '../db/redis';
import { query } from '../db/postgres';
import { log } from '../lib/logger';

const lastPingKey = (minerId: number) => `ping:${minerId}`;
const minuteKey = (minerId: number, minuteBucket: number) => `minute:${minerId}:${minuteBucket}`;
const rateKey = (minerId: number, minuteBucket: number) => `ping-rate:${minerId}:${minuteBucket}`;
const RATE_LIMIT_PER_MINUTE = 15;
const HASHRATE_CACHE_TTL_MS = 60_000;

const hashrateCache = new Map<number, { value: number; expiresAt: number }>();

export function clearHashrateCache(minerId: number) {
  hashrateCache.delete(minerId);
}

export class RateLimitError extends Error {
  status = 429;
  constructor(message = 'Rate limit exceeded') {
    super(message);
  }
}

export class NotFoundError extends Error {
  status = 404;
  constructor(message = 'Miner not found') {
    super(message);
  }
}

export class MinerNotFoundError extends Error {
  status = 404;
  constructor(minerId: number) {
    super(`Miner ${minerId} not found`);
  }
}

export async function handlePing(minerId: number, ipAddress?: string) {
  const now = new Date();
  const minuteBucket = Math.floor(now.getTime() / 60_000);

  const [minerExists] = await query<{ miner_id: number }>('SELECT miner_id FROM miners WHERE miner_id = $1', [minerId]);
  if (!minerExists) {
    throw new NotFoundError();
  }

  const count = await redis.incr(rateKey(minerId, minuteBucket));
  if (count === 1) {
    await redis.expire(rateKey(minerId, minuteBucket), 60);
  }
  if (count > RATE_LIMIT_PER_MINUTE) {
    throw new RateLimitError();
  }

  // Track last ping with a small grace window for retries
  await redis.setex(lastPingKey(minerId), 300, now.toISOString());

  // Only first ping per minute creates a mining_session entry
  const didSet = await redis.set(minuteKey(minerId, minuteBucket), '1', 'EX', 120, 'NX');
  if (didSet) {
    await recordMinuteActivity(minerId, now, ipAddress);
  }

  await query(
    `UPDATE miners
     SET last_ping_time = NOW(), status = 'online'
     WHERE miner_id = $1`,
    [minerId]
  );
}

async function recordMinuteActivity(minerId: number, now: Date, ipAddress?: string) {
  const hashrate = await getMinerHashrate(minerId);

  const startMinuteIso = new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();

  try {
    await query(
      `INSERT INTO mining_sessions (miner_id, start_minute, hashrate_snapshot, reward_amount, expires_at)
       VALUES ($1, $2, $3, 0, NOW() + INTERVAL '7 days')
       ON CONFLICT DO NOTHING`,
      [minerId, startMinuteIso, hashrate]
    );
  } catch (err: any) {
    if (err?.message?.includes('partition') || err?.code === '23514') {
      await query(`SELECT ensure_mining_session_partition($1::timestamptz)`, [startMinuteIso]);
      await query(
        `INSERT INTO mining_sessions (miner_id, start_minute, hashrate_snapshot, reward_amount, expires_at)
         VALUES ($1, $2, $3, 0, NOW() + INTERVAL '7 days')
         ON CONFLICT DO NOTHING`,
        [minerId, startMinuteIso, hashrate]
      );
    } else {
      throw err;
    }
  }

  await query(
    `INSERT INTO ping_logs (miner_id, timestamp, ip_address, expires_at)
     VALUES ($1, NOW(), $2, NOW() + INTERVAL '1 hour')`,
    [minerId, ipAddress ?? null]
  );
}

async function getMinerHashrate(minerId: number): Promise<number> {
  const cached = hashrateCache.get(minerId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const [miner] = await query<{ hashrate: number }>('SELECT hashrate FROM miners WHERE miner_id = $1', [minerId]);
  if (!miner) {
    throw new MinerNotFoundError(minerId);
  }

  hashrateCache.set(minerId, { value: Number(miner.hashrate ?? 0), expiresAt: now + HASHRATE_CACHE_TTL_MS });
  return Number(miner.hashrate ?? 0);
}
