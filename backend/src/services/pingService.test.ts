import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { handlePing } from './pingService';

const redisStore = new Map<string, number>();
const mockQuery = vi.fn();

vi.mock('../db/redis', () => ({
  redis: {
    get: vi.fn(async (key: string) => {
      return redisStore.has(key) ? String(redisStore.get(key)) : null;
    }),
    setex: vi.fn(async (key: string, _ttl: number, _val: string) => {
      redisStore.set(key, Date.now());
    }),
    set: vi.fn(async () => 'OK'),
    exists: vi.fn(async (key: string) => Number(redisStore.has(key))),
    incr: vi.fn(async (key: string) => {
      const next = (redisStore.get(key) ?? 0) + 1;
      redisStore.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1)
  }
}));

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

describe('handlePing rate limiting', () => {
  beforeEach(() => {
    redisStore.clear();
    mockQuery.mockReset();
    // default miner hashrate row
    mockQuery.mockResolvedValue([{ hashrate: 1000 }]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('allows up to 15 pings per minute', async () => {
    for (let i = 0; i < 15; i++) {
      await expect(handlePing(1)).resolves.not.toThrow();
    }
  });

  test('16th ping within same minute is rate-limited', async () => {
    for (let i = 0; i < 15; i++) {
      await handlePing(1);
    }
    await expect(handlePing(1)).rejects.toThrow(/rate limit/i);
  });
});
