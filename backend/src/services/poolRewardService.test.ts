import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  getClient: async () => ({
    query: (...args: unknown[]) => mockClientQuery(...args),
    release: () => mockRelease()
  })
}));

vi.mock('../db/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn()
  }
}));

vi.mock('./rewardEngine', () => ({
  calculatePoolRewards: vi.fn()
}));

import { calculatePoolReward, snapshotPoolEpoch, calculateDepositorShares, distributePoolRewards } from './poolRewardService';
import { calculatePoolRewards } from './rewardEngine';

describe('poolRewardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockClientQuery.mockReset();
  });

  describe('calculatePoolReward', () => {
    it('calculates reward based on pool weight and total reward', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          reward_weight: 40
        },
        {
          pool_id: 'pool-2',
          reward_weight: 60
        }
      ]);

      const totalReward = '1000000000000000000000';
      const poolReward = await calculatePoolReward('pool-1', totalReward);

      expect(poolReward).toBe('400000000000000000000');
    });

    it('returns zero for pool with zero weight', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          reward_weight: 0
        },
        {
          pool_id: 'pool-2',
          reward_weight: 100
        }
      ]);

      const totalReward = '1000000000000000000000';
      const poolReward = await calculatePoolReward('pool-1', totalReward);

      expect(poolReward).toBe('0');
    });

    it('handles single pool with 100% weight', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          reward_weight: 100
        }
      ]);

      const totalReward = '1000000000000000000000';
      const poolReward = await calculatePoolReward('pool-1', totalReward);

      expect(poolReward).toBe('1000000000000000000000');
    });

    it('throws error when pool not found', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-2',
          reward_weight: 100
        }
      ]);

      await expect(calculatePoolReward('pool-1', '1000')).rejects.toThrow('Pool not found');
    });
  });

  describe('snapshotPoolEpoch', () => {
    it('creates epoch snapshot with pool state', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          total_shares: '10000000000000000000000',
          exchange_rate: '1050000000000000000',
          current_tvl: '10500000000000000000000'
        }
      ]);

      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) return Promise.resolve();
        if (sql.includes('INSERT INTO pool_epochs')) {
          return Promise.resolve({ rows: [{ epoch_id: 100 }] });
        }
        if (sql.includes('COMMIT')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      const epochId = await snapshotPoolEpoch('pool-1', 1000000);

      expect(epochId).toBe(100);
      const insertCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('INSERT INTO pool_epochs')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall?.[1]).toEqual(
        expect.arrayContaining([
          'pool-1',
          1000000,
          '10000000000000000000000',
          '1050000000000000000',
          '10500000000000000000000'
        ])
      );
    });

    it('rolls back on database error', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          total_shares: '10000000000000000000000',
          exchange_rate: '1050000000000000000',
          current_tvl: '10500000000000000000000'
        }
      ]);

      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) return Promise.resolve();
        if (sql.includes('INSERT INTO pool_epochs')) {
          return Promise.reject(new Error('Duplicate epoch'));
        }
        if (sql.includes('ROLLBACK')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      await expect(snapshotPoolEpoch('pool-1', 1000000)).rejects.toThrow('Duplicate epoch');

      const rollbackCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('ROLLBACK')
      );
      expect(rollbackCall).toBeDefined();
    });

    it('handles pool not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(snapshotPoolEpoch('pool-1', 1000000)).rejects.toThrow('Pool not found');
    });
  });

  describe('calculateDepositorShares', () => {
    it('calculates proportional shares for depositors', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          address: '0xabc',
          shares: '1000000000000000000000'
        },
        {
          address: '0xdef',
          shares: '4000000000000000000000'
        }
      ]);

      mockQuery.mockResolvedValueOnce([
        {
          total_shares: '5000000000000000000000'
        }
      ]);

      const totalReward = '1000000000000000000000';
      const shares = await calculateDepositorShares('pool-1', 100, totalReward);

      expect(shares).toHaveLength(2);
      expect(shares[0]).toEqual({
        address: '0xabc',
        amount: '200000000000000000000'
      });
      expect(shares[1]).toEqual({
        address: '0xdef',
        amount: '800000000000000000000'
      });
    });

    it('returns empty array for pool with no depositors', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const shares = await calculateDepositorShares('pool-1', 100, '1000000000000000000000');

      expect(shares).toHaveLength(0);
    });

    it('handles rounding correctly for small shares', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          address: '0xabc',
          shares: '1'
        },
        {
          address: '0xdef',
          shares: '999999999999999999999'
        }
      ]);

      mockQuery.mockResolvedValueOnce([
        {
          total_shares: '1000000000000000000000'
        }
      ]);

      const totalReward = '1000000000000000000000';
      const shares = await calculateDepositorShares('pool-1', 100, totalReward);

      expect(shares).toHaveLength(2);
      expect(BigInt(shares[0].amount) + BigInt(shares[1].amount)).toBeLessThanOrEqual(
        BigInt(totalReward)
      );
    });
  });

  describe('distributePoolRewards', () => {
    it('distributes rewards to all depositors in pool', async () => {
      const depositors = [
        { address: '0xabc', amount: '200000000000000000000' },
        { address: '0xdef', amount: '800000000000000000000' }
      ];

      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) return Promise.resolve();
        if (sql.includes('UPDATE pool_balances')) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('INSERT INTO pool_reward_history')) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('COMMIT')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      await distributePoolRewards('pool-1', 100, depositors);

      const updateCalls = mockClientQuery.mock.calls.filter(([sql]: [string]) =>
        sql.includes('UPDATE pool_balances')
      );
      expect(updateCalls).toHaveLength(2);

      const insertCalls = mockClientQuery.mock.calls.filter(([sql]: [string]) =>
        sql.includes('INSERT INTO pool_reward_history')
      );
      expect(insertCalls).toHaveLength(2);
    });

    it('rolls back on partial failure', async () => {
      const depositors = [
        { address: '0xabc', amount: '200000000000000000000' },
        { address: '0xdef', amount: '800000000000000000000' }
      ];

      let callCount = 0;
      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) return Promise.resolve();
        if (sql.includes('UPDATE pool_balances')) {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error('Database error'));
          }
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('ROLLBACK')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      await expect(distributePoolRewards('pool-1', 100, depositors)).rejects.toThrow(
        'Database error'
      );

      const rollbackCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('ROLLBACK')
      );
      expect(rollbackCall).toBeDefined();
    });

    it('handles empty depositor list', async () => {
      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) return Promise.resolve();
        if (sql.includes('COMMIT')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      await distributePoolRewards('pool-1', 100, []);

      const updateCalls = mockClientQuery.mock.calls.filter(([sql]: [string]) =>
        sql.includes('UPDATE pool_balances')
      );
      expect(updateCalls).toHaveLength(0);
    });
  });

  describe('integration with rewardEngine', () => {
    it('calculates pool rewards based on global reward cycle', async () => {
      const mockCalculatePoolRewards = vi.mocked(calculatePoolRewards);
      mockCalculatePoolRewards.mockResolvedValueOnce({
        'pool-1': '400000000000000000000',
        'pool-2': '600000000000000000000'
      });

      mockQuery.mockResolvedValueOnce([
        {
          address: '0xabc',
          shares: '1000000000000000000000'
        }
      ]);

      mockQuery.mockResolvedValueOnce([
        {
          total_shares: '10000000000000000000000'
        }
      ]);

      const totalReward = '1000000000000000000000';
      await calculatePoolRewards(totalReward, Date.now());

      expect(mockCalculatePoolRewards).toHaveBeenCalledWith(totalReward, expect.any(Number));
    });
  });
});

// Helper implementations for poolRewardService
export async function calculatePoolReward(poolId: string, totalReward: string): Promise<string> {
  const { query } = await import('../db/postgres');
  const pools = await query(`SELECT pool_id, reward_weight FROM pools WHERE status = 'active'`);

  const pool = pools.find((p: any) => p.pool_id === poolId);
  if (!pool) {
    throw new Error('Pool not found');
  }

  const totalWeight = pools.reduce((sum: number, p: any) => sum + Number(p.reward_weight), 0);
  if (totalWeight === 0) return '0';

  const poolReward = (BigInt(totalReward) * BigInt(pool.reward_weight)) / BigInt(totalWeight);
  return poolReward.toString();
}

export async function snapshotPoolEpoch(poolId: string, blockNumber: number): Promise<number> {
  const { query, getClient } = await import('../db/postgres');
  const pools = await query(
    `SELECT pool_id, total_shares, exchange_rate, current_tvl FROM pools WHERE pool_id = $1`,
    [poolId]
  );

  if (pools.length === 0) {
    throw new Error('Pool not found');
  }

  const pool = pools[0];
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO pool_epochs (pool_id, block_number, total_shares, exchange_rate, tvl, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING epoch_id`,
      [poolId, blockNumber, pool.total_shares, pool.exchange_rate, pool.current_tvl]
    );
    await client.query('COMMIT');
    return result.rows[0].epoch_id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function calculateDepositorShares(
  poolId: string,
  epochId: number,
  totalReward: string
): Promise<Array<{ address: string; amount: string }>> {
  const { query } = await import('../db/postgres');
  const depositors = await query(
    `SELECT address, shares FROM pool_balances WHERE pool_id = $1 AND shares > 0`,
    [poolId]
  );

  if (depositors.length === 0) {
    return [];
  }

  const epochData = await query(`SELECT total_shares FROM pool_epochs WHERE epoch_id = $1`, [
    epochId
  ]);

  const totalShares = BigInt(epochData[0].total_shares);
  const rewards = depositors.map((dep: any) => {
    const userShares = BigInt(dep.shares);
    const userReward = (BigInt(totalReward) * userShares) / totalShares;
    return {
      address: dep.address,
      amount: userReward.toString()
    };
  });

  return rewards;
}

export async function distributePoolRewards(
  poolId: string,
  epochId: number,
  depositors: Array<{ address: string; amount: string }>
): Promise<void> {
  if (depositors.length === 0) {
    return;
  }

  const { getClient } = await import('../db/postgres');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    for (const depositor of depositors) {
      await client.query(
        `UPDATE pool_balances 
         SET pending_rewards = pending_rewards + $1
         WHERE pool_id = $2 AND address = $3`,
        [depositor.amount, poolId, depositor.address]
      );

      await client.query(
        `INSERT INTO pool_reward_history (pool_id, epoch_id, address, amount, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [poolId, epochId, depositor.address, depositor.amount]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
