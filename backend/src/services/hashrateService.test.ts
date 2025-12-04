import { describe, expect, test, vi, beforeEach } from 'vitest';
import { updateHashrate } from './hashrateService';

const redisStore = new Map<string, number>();
const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

vi.mock('../db/redis', () => ({
  redis: {
    incr: vi.fn(async (key: string) => {
      const next = (redisStore.get(key) ?? 0) + 1;
      redisStore.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1)
  }
}));

vi.mock('../db/postgres', () => ({
  getClient: async () => mockClient
}));

describe('hashrateService', () => {
  beforeEach(() => {
    redisStore.clear();
    mockClient.query.mockReset();
  });

  test('rate limits hashrate updates', async () => {
    redisStore.set('hashrate-update:1', 6);
    await expect(updateHashrate(1, 1000)).rejects.toThrow(/rate limit/i);
  });
});
