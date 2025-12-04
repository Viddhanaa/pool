import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockRedisGet = vi.fn();
const mockRedisSetex = vi.fn();
const mockRedisDel = vi.fn();

vi.mock('../db/redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    setex: (...args: unknown[]) => mockRedisSetex(...args),
    del: (...args: unknown[]) => mockRedisDel(...args)
  }
}));

// Mock ethers contract
const mockContractLatestRoundData = vi.fn();
vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
    Contract: vi.fn().mockImplementation(() => ({
      latestRoundData: mockContractLatestRoundData
    }))
  };
});

import { fetchPrice, checkStaleness, getCachedPrice, invalidateCache } from './oracleService';

describe('oracleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockReset();
    mockRedisSetex.mockReset();
    mockRedisDel.mockReset();
    mockContractLatestRoundData.mockReset();
  });

  describe('fetchPrice', () => {
    it('fetches price from oracle contract', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockContractLatestRoundData.mockResolvedValueOnce({
        roundId: 100n,
        answer: 2000_00000000n, // $2000 with 8 decimals
        startedAt: BigInt(now - 60),
        updatedAt: BigInt(now - 30),
        answeredInRound: 100n
      });

      const price = await fetchPrice('ETH');

      expect(price).toEqual({
        asset: 'ETH',
        price: '2000000000000000000000',
        decimals: 8,
        timestamp: now - 30
      });
    });

    it('normalizes price to 18 decimals', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockContractLatestRoundData.mockResolvedValueOnce({
        roundId: 100n,
        answer: 100_00000000n, // $100 with 8 decimals
        startedAt: BigInt(now - 60),
        updatedAt: BigInt(now - 30),
        answeredInRound: 100n
      });

      const price = await fetchPrice('USDC');

      // 100 * 10^10 = 1000000000000 (normalized to 18 decimals)
      expect(price.price).toBe('100000000000000000000');
    });

    it('throws on zero price', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockContractLatestRoundData.mockResolvedValueOnce({
        roundId: 100n,
        answer: 0n,
        startedAt: BigInt(now - 60),
        updatedAt: BigInt(now - 30),
        answeredInRound: 100n
      });

      await expect(fetchPrice('ETH')).rejects.toThrow('Invalid price: zero');
    });

    it('throws on negative price', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockContractLatestRoundData.mockResolvedValueOnce({
        roundId: 100n,
        answer: -1000n,
        startedAt: BigInt(now - 60),
        updatedAt: BigInt(now - 30),
        answeredInRound: 100n
      });

      await expect(fetchPrice('ETH')).rejects.toThrow('Invalid price: negative');
    });

    it('handles oracle contract errors', async () => {
      mockContractLatestRoundData.mockRejectedValueOnce(new Error('Contract reverted'));

      await expect(fetchPrice('ETH')).rejects.toThrow('Contract reverted');
    });
  });

  describe('checkStaleness', () => {
    it('returns not stale for recent update', async () => {
      const now = Math.floor(Date.now() / 1000);
      const recentTimestamp = now - 300; // 5 minutes ago

      const result = await checkStaleness('ETH', recentTimestamp);

      expect(result.isStale).toBe(false);
      expect(result.age).toBe(300);
    });

    it('detects stale data beyond threshold', async () => {
      const now = Math.floor(Date.now() / 1000);
      const staleTimestamp = now - 7200; // 2 hours ago

      const result = await checkStaleness('ETH', staleTimestamp, 3600);

      expect(result.isStale).toBe(true);
      expect(result.age).toBe(7200);
      expect(result.threshold).toBe(3600);
    });

    it('uses default threshold when not specified', async () => {
      const now = Math.floor(Date.now() / 1000);
      const timestamp = now - 4000; // 66 minutes ago

      const result = await checkStaleness('ETH', timestamp);

      // Default threshold is 3600 (1 hour)
      expect(result.isStale).toBe(true);
      expect(result.threshold).toBe(3600);
    });

    it('returns not stale at exact threshold', async () => {
      const now = Math.floor(Date.now() / 1000);
      const timestamp = now - 3600;

      const result = await checkStaleness('ETH', timestamp, 3600);

      expect(result.isStale).toBe(false);
    });
  });

  describe('getCachedPrice', () => {
    it('returns cached price when available', async () => {
      const cachedData = JSON.stringify({
        asset: 'ETH',
        price: '200000000000',
        decimals: 8,
        timestamp: Math.floor(Date.now() / 1000) - 60
      });

      mockRedisGet.mockResolvedValueOnce(cachedData);

      const price = await getCachedPrice('ETH');

      expect(price).toBeDefined();
      expect(price?.asset).toBe('ETH');
      expect(price?.price).toBe('200000000000');
      expect(mockRedisGet).toHaveBeenCalledWith('oracle:price:ETH');
    });

    it('returns null when cache miss', async () => {
      mockRedisGet.mockResolvedValueOnce(null);

      const price = await getCachedPrice('ETH');

      expect(price).toBeNull();
    });

    it('returns null on invalid cached data', async () => {
      mockRedisGet.mockResolvedValueOnce('invalid json');

      const price = await getCachedPrice('ETH');

      expect(price).toBeNull();
    });

    it('fetches from oracle on cache miss', async () => {
      mockRedisGet.mockResolvedValueOnce(null);

      const now = Math.floor(Date.now() / 1000);
      mockContractLatestRoundData.mockResolvedValueOnce({
        roundId: 100n,
        answer: 2000_00000000n,
        startedAt: BigInt(now - 60),
        updatedAt: BigInt(now - 30),
        answeredInRound: 100n
      });

      const price = await getCachedPrice('ETH', true);

      expect(price).toBeDefined();
      expect(price?.price).toBe('2000000000000000000000');
      expect(mockRedisSetex).toHaveBeenCalledWith(
        'oracle:price:ETH',
        300,
        expect.any(String)
      );
    });

    it('handles redis errors gracefully', async () => {
      mockRedisGet.mockRejectedValueOnce(new Error('Redis connection failed'));

      const price = await getCachedPrice('ETH');

      expect(price).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('deletes cached price', async () => {
      mockRedisDel.mockResolvedValueOnce(1);

      await invalidateCache('ETH');

      expect(mockRedisDel).toHaveBeenCalledWith('oracle:price:ETH');
    });

    it('handles redis deletion errors', async () => {
      mockRedisDel.mockRejectedValueOnce(new Error('Redis error'));

      await expect(invalidateCache('ETH')).rejects.toThrow('Redis error');
    });

    it('invalidates multiple assets', async () => {
      mockRedisDel.mockResolvedValue(1);

      await invalidateCache(['ETH', 'BTC', 'USDC']);

      expect(mockRedisDel).toHaveBeenCalledTimes(3);
      expect(mockRedisDel).toHaveBeenCalledWith('oracle:price:ETH');
      expect(mockRedisDel).toHaveBeenCalledWith('oracle:price:BTC');
      expect(mockRedisDel).toHaveBeenCalledWith('oracle:price:USDC');
    });
  });

  describe('error handling for failed oracle reads', () => {
    it('throws descriptive error on RPC timeout', async () => {
      mockContractLatestRoundData.mockRejectedValueOnce(new Error('timeout of 5000ms exceeded'));

      await expect(fetchPrice('ETH')).rejects.toThrow('timeout');
    });

    it('throws on missing oracle data', async () => {
      mockContractLatestRoundData.mockResolvedValueOnce({
        roundId: 0n,
        answer: 0n,
        startedAt: 0n,
        updatedAt: 0n,
        answeredInRound: 0n
      });

      await expect(fetchPrice('ETH')).rejects.toThrow('Invalid price: zero');
    });

    it('detects stale round data', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockContractLatestRoundData.mockResolvedValueOnce({
        roundId: 100n,
        answer: 2000_00000000n,
        startedAt: BigInt(now - 7200),
        updatedAt: BigInt(now - 7200),
        answeredInRound: 100n
      });

      const price = await fetchPrice('ETH');
      const staleness = await checkStaleness('ETH', price.timestamp, 3600);

      expect(staleness.isStale).toBe(true);
    });
  });
});

// Helper implementations for oracleService
interface PriceData {
  asset: string;
  price: string;
  decimals: number;
  timestamp: number;
}

export async function fetchPrice(asset: string): Promise<PriceData> {
  const { Contract, JsonRpcProvider } = await import('ethers');
  const provider = new JsonRpcProvider('http://localhost:8545');
  const oracleAddress = getOracleAddress(asset);
  const contract = new Contract(oracleAddress, ['function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'], provider);

  const roundData = await contract.latestRoundData();
  const answer = roundData.answer;

  if (answer <= 0n) {
    throw new Error(answer === 0n ? 'Invalid price: zero' : 'Invalid price: negative');
  }

  // Normalize to 18 decimals (assuming oracle returns 8 decimals)
  const normalized = (answer * 10n ** 10n).toString();

  return {
    asset,
    price: normalized,
    decimals: 8,
    timestamp: Number(roundData.updatedAt)
  };
}

export async function checkStaleness(
  asset: string,
  timestamp: number,
  thresholdSeconds: number = 3600
): Promise<{ isStale: boolean; age: number; threshold: number }> {
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;
  const isStale = age > thresholdSeconds;

  return { isStale, age, threshold: thresholdSeconds };
}

export async function getCachedPrice(asset: string, fetchOnMiss: boolean = false): Promise<PriceData | null> {
  const { redis } = await import('../db/redis');
  const cacheKey = `oracle:price:${asset}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }

    if (fetchOnMiss) {
      const price = await fetchPrice(asset);
      await redis.setex(cacheKey, 300, JSON.stringify(price));
      return price;
    }

    return null;
  } catch (err) {
    return null;
  }
}

export async function invalidateCache(assetOrAssets: string | string[]): Promise<void> {
  const { redis } = await import('../db/redis');
  const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets];

  for (const asset of assets) {
    await redis.del(`oracle:price:${asset}`);
  }
}

function getOracleAddress(asset: string): string {
  const oracles: Record<string, string> = {
    ETH: '0x1111111111111111111111111111111111111111',
    BTC: '0x2222222222222222222222222222222222222222',
    USDC: '0x3333333333333333333333333333333333333333'
  };
  return oracles[asset] || '0x0000000000000000000000000000000000000000';
}
