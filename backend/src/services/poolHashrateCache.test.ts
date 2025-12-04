import { describe, expect, test, vi } from 'vitest';
import { getPoolHashrateCached } from './poolHashrateCache';

const redisStore = new Map<string, string>();
const mockQuery = vi.fn();

vi.mock('../db/redis', () => ({
  redis: {
    get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
    setex: vi.fn(async (k: string, _ttl: number, v: string) => {
      redisStore.set(k, v);
    })
  }
}));

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

describe('poolHashrateCache', () => {
  test('caches pool hashrate', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 123 }]);
    const first = await getPoolHashrateCached();
    expect(first).toBe(123);
    const second = await getPoolHashrateCached();
    expect(second).toBe(123);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
