import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';

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
    setex: vi.fn()
  }
}));

// Mock ethers provider
const mockProviderCall = vi.fn();
vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      call: mockProviderCall,
      getBlockNumber: vi.fn().mockResolvedValue(1000000)
    })),
    Contract: vi.fn().mockImplementation(() => ({
      balanceOf: vi.fn().mockResolvedValue(ethers.parseUnits('1000', 18)),
      totalSupply: vi.fn().mockResolvedValue(ethers.parseUnits('10000', 18)),
      exchangeRate: vi.fn().mockResolvedValue(ethers.parseUnits('1.05', 18)),
      paused: vi.fn().mockResolvedValue(false)
    }))
  };
});

import { syncPoolAccounting, getUserPoolBalance, validateDeposit, validateWithdraw } from './poolService';

describe('poolService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockClientQuery.mockReset();
    mockProviderCall.mockReset();
  });

  describe('syncPoolAccounting', () => {
    it('syncs pool state from blockchain', async () => {
      const mockContract = {
        totalSupply: vi.fn().mockResolvedValue(ethers.parseUnits('10000', 18)),
        exchangeRate: vi.fn().mockResolvedValue(ethers.parseUnits('1.05', 18)),
        paused: vi.fn().mockResolvedValue(false)
      };

      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          contract_address: '0x1234567890123456789012345678901234567890',
          name: 'Test Pool'
        }
      ]);

      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) return Promise.resolve();
        if (sql.includes('UPDATE pools')) return Promise.resolve({ rowCount: 1 });
        if (sql.includes('COMMIT')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      await syncPoolAccounting('pool-1', mockContract as any);

      const updateCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('UPDATE pools')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall?.[1][0]).toBe('10000000000000000000000');
      expect(updateCall?.[1][1]).toBe('1050000000000000000');
      expect(updateCall?.[1][2]).toBe('active');
    });

    it('handles blockchain read errors gracefully', async () => {
      const mockContract = {
        totalSupply: vi.fn().mockRejectedValue(new Error('RPC timeout')),
        exchangeRate: vi.fn().mockResolvedValue(ethers.parseUnits('1.0', 18)),
        paused: vi.fn().mockResolvedValue(false)
      };

      await expect(syncPoolAccounting('pool-1', mockContract as any)).rejects.toThrow(
        'RPC timeout'
      );
    });

    it('rolls back on database error', async () => {
      const mockContract = {
        totalSupply: vi.fn().mockResolvedValue(ethers.parseUnits('10000', 18)),
        exchangeRate: vi.fn().mockResolvedValue(ethers.parseUnits('1.05', 18)),
        paused: vi.fn().mockResolvedValue(false)
      };

      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) return Promise.resolve();
        if (sql.includes('UPDATE pools')) return Promise.reject(new Error('DB error'));
        if (sql.includes('ROLLBACK')) return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      await expect(syncPoolAccounting('pool-1', mockContract as any)).rejects.toThrow('DB error');

      const rollbackCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
        sql.includes('ROLLBACK')
      );
      expect(rollbackCall).toBeDefined();
    });
  });

  describe('getUserPoolBalance', () => {
    it('calculates user balance from shares and exchange rate', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          shares: '1000000000000000000000',
          exchange_rate: '1050000000000000000',
          pending_rewards: '50000000000000000000'
        }
      ]);

      const balance = await getUserPoolBalance('0xabc', 'pool-1');

      expect(balance).toEqual({
        shares: '1000000000000000000000',
        underlyingBalance: '1050000000000000000000',
        pendingRewards: '50000000000000000000'
      });
    });

    it('returns zero balance for non-existent user', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const balance = await getUserPoolBalance('0xabc', 'pool-1');

      expect(balance).toEqual({
        shares: '0',
        underlyingBalance: '0',
        pendingRewards: '0'
      });
    });

    it('handles database query errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(getUserPoolBalance('0xabc', 'pool-1')).rejects.toThrow(
        'DB connection failed'
      );
    });
  });

  describe('validateDeposit', () => {
    it('validates successful deposit', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          status: 'active',
          deposit_cap: '1000000000000000000000000',
          current_tvl: '500000000000000000000000',
          asset: 'VDHN'
        }
      ]);

      const result = await validateDeposit({
        poolId: 'pool-1',
        amount: '100000000000000000000',
        asset: 'VDHN',
        address: '0xabc'
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects deposit to paused pool', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          status: 'paused',
          deposit_cap: '1000000000000000000000000',
          current_tvl: '500000000000000000000000',
          asset: 'VDHN'
        }
      ]);

      const result = await validateDeposit({
        poolId: 'pool-1',
        amount: '100000000000000000000',
        asset: 'VDHN',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Pool is paused');
    });

    it('rejects deposit exceeding TVL cap', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          status: 'active',
          deposit_cap: '1000000000000000000000000',
          current_tvl: '999000000000000000000000',
          asset: 'VDHN'
        }
      ]);

      const result = await validateDeposit({
        poolId: 'pool-1',
        amount: '2000000000000000000000',
        asset: 'VDHN',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('TVL cap');
    });

    it('rejects zero amount deposit', async () => {
      const result = await validateDeposit({
        poolId: 'pool-1',
        amount: '0',
        asset: 'VDHN',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });

    it('rejects mismatched asset', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          status: 'active',
          deposit_cap: '1000000000000000000000000',
          current_tvl: '500000000000000000000000',
          asset: 'VDHN'
        }
      ]);

      const result = await validateDeposit({
        poolId: 'pool-1',
        amount: '100000000000000000000',
        asset: 'ETH',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Asset mismatch');
    });
  });

  describe('validateWithdraw', () => {
    it('validates successful withdrawal', async () => {
      mockQuery
        .mockResolvedValueOnce([
          {
            pool_id: 'pool-1',
            status: 'active',
            cooldown_period: 3600
          }
        ])
        .mockResolvedValueOnce([
          {
            shares: '1000000000000000000000',
            last_deposit_time: new Date(Date.now() - 7200000).toISOString()
          }
        ]);

      const result = await validateWithdraw({
        poolId: 'pool-1',
        amount: '500000000000000000000',
        address: '0xabc'
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects withdrawal during cooldown period', async () => {
      mockQuery
        .mockResolvedValueOnce([
          {
            pool_id: 'pool-1',
            status: 'active',
            cooldown_period: 3600
          }
        ])
        .mockResolvedValueOnce([
          {
            shares: '1000000000000000000000',
            last_deposit_time: new Date(Date.now() - 1800000).toISOString()
          }
        ]);

      const result = await validateWithdraw({
        poolId: 'pool-1',
        amount: '500000000000000000000',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('cooldown');
    });

    it('rejects withdrawal exceeding balance', async () => {
      mockQuery
        .mockResolvedValueOnce([
          {
            pool_id: 'pool-1',
            status: 'active',
            cooldown_period: 3600
          }
        ])
        .mockResolvedValueOnce([
          {
            shares: '1000000000000000000000',
            last_deposit_time: new Date(Date.now() - 7200000).toISOString()
          }
        ]);

      const result = await validateWithdraw({
        poolId: 'pool-1',
        amount: '2000000000000000000000',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Insufficient balance');
    });

    it('rejects withdrawal from paused pool', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          status: 'paused',
          cooldown_period: 3600
        }
      ]);

      const result = await validateWithdraw({
        poolId: 'pool-1',
        amount: '500000000000000000000',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Pool is paused');
    });

    it('rejects zero amount withdrawal', async () => {
      const result = await validateWithdraw({
        poolId: 'pool-1',
        amount: '0',
        address: '0xabc'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });
  });
});

// Helper mock implementations for poolService
export async function syncPoolAccounting(poolId: string, contract: any): Promise<void> {
  const totalSupply = await contract.totalSupply();
  const exchangeRate = await contract.exchangeRate();
  const paused = await contract.paused();

  const client = await (await import('../db/postgres')).getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE pools 
       SET total_shares = $1, exchange_rate = $2, status = $3, updated_at = NOW()
       WHERE pool_id = $4`,
      [totalSupply.toString(), exchangeRate.toString(), paused ? 'paused' : 'active', poolId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserPoolBalance(
  address: string,
  poolId: string
): Promise<{ shares: string; underlyingBalance: string; pendingRewards: string }> {
  const { query } = await import('../db/postgres');
  const rows = await query(
    `SELECT shares, exchange_rate, pending_rewards 
     FROM pool_balances 
     WHERE address = $1 AND pool_id = $2`,
    [address, poolId]
  );

  if (rows.length === 0) {
    return { shares: '0', underlyingBalance: '0', pendingRewards: '0' };
  }

  const { shares, exchange_rate, pending_rewards } = rows[0];
  const underlyingBalance = (
    (BigInt(shares) * BigInt(exchange_rate)) /
    BigInt(10 ** 18)
  ).toString();

  return {
    shares: shares.toString(),
    underlyingBalance,
    pendingRewards: pending_rewards.toString()
  };
}

export async function validateDeposit(params: {
  poolId: string;
  amount: string;
  asset: string;
  address: string;
}): Promise<{ valid: boolean; error?: string }> {
  if (BigInt(params.amount) <= 0n) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  const { query } = await import('../db/postgres');
  const pools = await query(
    `SELECT pool_id, status, deposit_cap, current_tvl, asset 
     FROM pools 
     WHERE pool_id = $1`,
    [params.poolId]
  );

  if (pools.length === 0) {
    return { valid: false, error: 'Pool not found' };
  }

  const pool = pools[0];

  if (pool.status === 'paused') {
    return { valid: false, error: 'Pool is paused' };
  }

  if (pool.asset !== params.asset) {
    return { valid: false, error: 'Asset mismatch' };
  }

  if (pool.deposit_cap) {
    const newTvl = BigInt(pool.current_tvl) + BigInt(params.amount);
    if (newTvl > BigInt(pool.deposit_cap)) {
      return { valid: false, error: 'Deposit would exceed TVL cap' };
    }
  }

  return { valid: true };
}

export async function validateWithdraw(params: {
  poolId: string;
  amount: string;
  address: string;
}): Promise<{ valid: boolean; error?: string }> {
  if (BigInt(params.amount) <= 0n) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  const { query } = await import('../db/postgres');
  const pools = await query(
    `SELECT pool_id, status, cooldown_period 
     FROM pools 
     WHERE pool_id = $1`,
    [params.poolId]
  );

  if (pools.length === 0) {
    return { valid: false, error: 'Pool not found' };
  }

  const pool = pools[0];

  if (pool.status === 'paused') {
    return { valid: false, error: 'Pool is paused' };
  }

  const balances = await query(
    `SELECT shares, last_deposit_time 
     FROM pool_balances 
     WHERE address = $1 AND pool_id = $2`,
    [params.address, params.poolId]
  );

  if (balances.length === 0) {
    return { valid: false, error: 'No balance found' };
  }

  const balance = balances[0];

  if (BigInt(params.amount) > BigInt(balance.shares)) {
    return { valid: false, error: 'Insufficient balance' };
  }

  const cooldownEndTime = new Date(balance.last_deposit_time).getTime() + pool.cooldown_period * 1000;
  if (Date.now() < cooldownEndTime) {
    return { valid: false, error: 'Withdrawal still in cooldown period' };
  }

  return { valid: true };
}
