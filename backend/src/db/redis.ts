import Redis from 'ioredis';
import { config } from '../config/env';

// Minimal interface to match the methods we use in the codebase
interface RedisLike {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<'OK' | null>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  lpush(key: string, ...values: string[]): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<'OK'>;
}

// Lightweight in-memory mock for tests to avoid network dependency
class InMemoryRedis implements RedisLike {
  private store = new Map<string, string>();
  async ping(): Promise<string> { return 'PONG'; }
  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }
  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, value);
    // TTL ignored in mock
    return 'OK';
  }
  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }
  async incr(key: string): Promise<number> {
    const cur = Number(this.store.get(key) ?? '0');
    const next = cur + 1;
    this.store.set(key, String(next));
    return next;
  }
  async expire(_key: string, _seconds: number): Promise<number> {
    // TTL ignored in mock
    return 1;
  }
  async lpush(key: string, ...values: string[]): Promise<number> {
    const current = this.store.get(key);
    const list = current ? JSON.parse(current) : [];
    list.unshift(...values);
    this.store.set(key, JSON.stringify(list));
    return list.length;
  }
  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    const current = this.store.get(key);
    if (!current) return 'OK';
    const list = JSON.parse(current);
    const trimmed = list.slice(start, stop + 1);
    this.store.set(key, JSON.stringify(trimmed));
    return 'OK';
  }
}

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST_WORKER_ID !== undefined;

export const redis: RedisLike = isTest
  ? new InMemoryRedis()
  : (new Redis(config.redisUrl, { 
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      // Connection pool settings
      lazyConnect: false,
      keepAlive: 30000, // 30s keepalive
      connectTimeout: 10000, // 10s connection timeout
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 3000); // Exponential backoff up to 3s
      },
      // Performance optimization
      enableAutoPipelining: true, // Auto-batch commands
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
    }) as unknown as RedisLike);

if (!isTest) {
  (redis as any).on?.('error', (err: any) => {
    console.error('[redis] error', err);
  });
  (redis as any).on?.('connect', () => {
    console.log('[redis] connected');
  });
  (redis as any).on?.('ready', () => {
    console.log('[redis] ready');
  });
}
