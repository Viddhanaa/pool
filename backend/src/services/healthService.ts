import { config } from '../config/env';
import { query as dbQuery } from '../db/postgres';
import { redis } from '../db/redis';
import { JsonRpcProvider } from 'ethers';

async function checkPostgres() {
  const started = Date.now();
  try {
    await dbQuery('SELECT 1');
    return { ok: true, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - started, error: String(err) };
  }
}

async function checkRedis() {
  const started = Date.now();
  try {
    await redis.ping();
    return { ok: true, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - started, error: String(err) };
  }
}

async function checkGeth() {
  const results = await Promise.all(
    config.rpcUrls.map(async (url) => {
      const started = Date.now();
      try {
        const provider = new JsonRpcProvider(url);
        await provider.getBlockNumber();
        return { url, ok: true, latency_ms: Date.now() - started };
      } catch (err) {
        return { url, ok: false, latency_ms: Date.now() - started, error: String(err) };
      }
    })
  );
  const ok = results.some((r) => r.ok);
  return { ok, nodes: results };
}

export async function getHealth() {
  const [postgres, redisHealth, geth] = await Promise.all([checkPostgres(), checkRedis(), checkGeth()]);
  return { ok: postgres.ok && redisHealth.ok && geth.ok, postgres, redis: redisHealth, geth };
}
