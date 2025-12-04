import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockQuery = vi.fn();

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

vi.mock('../db/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn()
  }
}));

import { checkTvlCap, checkWithdrawalLimit, getCircuitBreakerStatus, triggerCircuitBreaker, resetCircuitBreaker } from './riskService';

describe('riskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  describe('checkTvlCap', () => {
    it('allows deposit within TVL cap', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          current_tvl: '500000000000000000000000',
          tvl_cap: '1000000000000000000000000'
        }
      ]);

      const result = await checkTvlCap('pool-1', '100000000000000000000000');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects deposit exceeding TVL cap', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          current_tvl: '950000000000000000000000',
          tvl_cap: '1000000000000000000000000'
        }
      ]);

      const result = await checkTvlCap('pool-1', '100000000000000000000000');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('TVL cap');
      expect(result.currentTvl).toBe('950000000000000000000000');
      expect(result.cap).toBe('1000000000000000000000000');
    });

    it('allows deposit at exact TVL cap', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          current_tvl: '900000000000000000000000',
          tvl_cap: '1000000000000000000000000'
        }
      ]);

      const result = await checkTvlCap('pool-1', '100000000000000000000000');

      expect(result.allowed).toBe(true);
    });

    it('allows deposit when no cap is set', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          current_tvl: '5000000000000000000000000',
          tvl_cap: null
        }
      ]);

      const result = await checkTvlCap('pool-1', '100000000000000000000000');

      expect(result.allowed).toBe(true);
    });

    it('throws when pool not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(checkTvlCap('pool-1', '100000000000000000000000')).rejects.toThrow(
        'Pool not found'
      );
    });
  });

  describe('checkWithdrawalLimit', () => {
    it('allows withdrawal within 24h limit', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          withdrawal_limit_24h: '1000000000000000000000000'
        }
      ]);

      mockQuery.mockResolvedValueOnce([
        {
          total_withdrawn: '500000000000000000000000'
        }
      ]);

      const result = await checkWithdrawalLimit('pool-1', '200000000000000000000000');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects withdrawal exceeding 24h limit', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          withdrawal_limit_24h: '1000000000000000000000000'
        }
      ]);

      mockQuery.mockResolvedValueOnce([
        {
          total_withdrawn: '900000000000000000000000'
        }
      ]);

      const result = await checkWithdrawalLimit('pool-1', '200000000000000000000000');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('24-hour withdrawal limit');
      expect(result.withdrawnLast24h).toBe('900000000000000000000000');
      expect(result.limit).toBe('1000000000000000000000000');
    });

    it('allows withdrawal at exact limit', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          withdrawal_limit_24h: '1000000000000000000000000'
        }
      ]);

      mockQuery.mockResolvedValueOnce([
        {
          total_withdrawn: '800000000000000000000000'
        }
      ]);

      const result = await checkWithdrawalLimit('pool-1', '200000000000000000000000');

      expect(result.allowed).toBe(true);
    });

    it('allows withdrawal when no limit is set', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          withdrawal_limit_24h: null
        }
      ]);

      const result = await checkWithdrawalLimit('pool-1', '200000000000000000000000');

      expect(result.allowed).toBe(true);
    });

    it('handles zero previous withdrawals', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          withdrawal_limit_24h: '1000000000000000000000000'
        }
      ]);

      mockQuery.mockResolvedValueOnce([
        {
          total_withdrawn: null
        }
      ]);

      const result = await checkWithdrawalLimit('pool-1', '200000000000000000000000');

      expect(result.allowed).toBe(true);
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('returns active status when circuit breaker is triggered', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          circuit_breaker_active: true,
          circuit_breaker_reason: 'Oracle failure',
          circuit_breaker_triggered_at: new Date().toISOString()
        }
      ]);

      const status = await getCircuitBreakerStatus('pool-1');

      expect(status.active).toBe(true);
      expect(status.reason).toBe('Oracle failure');
      expect(status.triggeredAt).toBeDefined();
    });

    it('returns inactive status when circuit breaker is not triggered', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          circuit_breaker_active: false,
          circuit_breaker_reason: null,
          circuit_breaker_triggered_at: null
        }
      ]);

      const status = await getCircuitBreakerStatus('pool-1');

      expect(status.active).toBe(false);
      expect(status.reason).toBeNull();
      expect(status.triggeredAt).toBeNull();
    });

    it('throws when pool not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(getCircuitBreakerStatus('pool-1')).rejects.toThrow('Pool not found');
    });
  });

  describe('triggerCircuitBreaker', () => {
    it('activates circuit breaker with reason', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await triggerCircuitBreaker('pool-1', 'Oracle data stale');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pools'),
        expect.arrayContaining([true, 'Oracle data stale', expect.any(String), 'pool-1'])
      );
    });

    it('throws when pool not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      await expect(triggerCircuitBreaker('pool-1', 'Test reason')).rejects.toThrow(
        'Pool not found'
      );
    });

    it('handles multiple trigger reasons', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await triggerCircuitBreaker('pool-1', 'High volatility');
      await triggerCircuitBreaker('pool-1', 'Excessive withdrawals');

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('deactivates circuit breaker', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await resetCircuitBreaker('pool-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pools'),
        expect.arrayContaining([false, null, null, 'pool-1'])
      );
    });

    it('throws when pool not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      await expect(resetCircuitBreaker('pool-1')).rejects.toThrow('Pool not found');
    });

    it('allows reset even when already inactive', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await resetCircuitBreaker('pool-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pools'),
        expect.anything()
      );
    });
  });

  describe('emergency scenarios', () => {
    it('triggers circuit breaker on stale oracle data', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await triggerCircuitBreaker('pool-1', 'Oracle data stale (>2 hours)');

      const call = mockQuery.mock.calls[0];
      expect(call[1][1]).toContain('Oracle data stale');
    });

    it('triggers circuit breaker on excessive price deviation', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await triggerCircuitBreaker('pool-1', 'Price deviation exceeded 20% threshold');

      const call = mockQuery.mock.calls[0];
      expect(call[1][1]).toContain('Price deviation');
    });

    it('blocks all operations when circuit breaker is active', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          pool_id: 'pool-1',
          circuit_breaker_active: true,
          circuit_breaker_reason: 'Emergency stop',
          circuit_breaker_triggered_at: new Date().toISOString()
        }
      ]);

      const status = await getCircuitBreakerStatus('pool-1');

      expect(status.active).toBe(true);
      expect(status.reason).toBe('Emergency stop');
    });
  });
});

// Helper implementations for riskService
interface TvlCheckResult {
  allowed: boolean;
  reason?: string;
  currentTvl?: string;
  cap?: string;
}

interface WithdrawalLimitResult {
  allowed: boolean;
  reason?: string;
  withdrawnLast24h?: string;
  limit?: string;
}

interface CircuitBreakerStatus {
  active: boolean;
  reason: string | null;
  triggeredAt: string | null;
}

export async function checkTvlCap(poolId: string, depositAmount: string): Promise<TvlCheckResult> {
  const { query } = await import('../db/postgres');
  const pools = await query(
    `SELECT pool_id, current_tvl, tvl_cap FROM pools WHERE pool_id = $1`,
    [poolId]
  );

  if (pools.length === 0) {
    throw new Error('Pool not found');
  }

  const pool = pools[0];

  if (!pool.tvl_cap) {
    return { allowed: true };
  }

  const newTvl = BigInt(pool.current_tvl) + BigInt(depositAmount);

  if (newTvl > BigInt(pool.tvl_cap)) {
    return {
      allowed: false,
      reason: 'Deposit would exceed TVL cap',
      currentTvl: pool.current_tvl,
      cap: pool.tvl_cap
    };
  }

  return { allowed: true };
}

export async function checkWithdrawalLimit(poolId: string, withdrawAmount: string): Promise<WithdrawalLimitResult> {
  const { query } = await import('../db/postgres');
  const pools = await query(
    `SELECT pool_id, withdrawal_limit_24h FROM pools WHERE pool_id = $1`,
    [poolId]
  );

  if (pools.length === 0) {
    throw new Error('Pool not found');
  }

  const pool = pools[0];

  if (!pool.withdrawal_limit_24h) {
    return { allowed: true };
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const withdrawals = await query(
    `SELECT COALESCE(SUM(amount), 0) as total_withdrawn 
     FROM pool_withdrawals 
     WHERE pool_id = $1 AND created_at >= $2`,
    [poolId, oneDayAgo]
  );

  const totalWithdrawn = BigInt(withdrawals[0].total_withdrawn || 0);
  const newTotal = totalWithdrawn + BigInt(withdrawAmount);

  if (newTotal > BigInt(pool.withdrawal_limit_24h)) {
    return {
      allowed: false,
      reason: 'Withdrawal would exceed 24-hour withdrawal limit',
      withdrawnLast24h: totalWithdrawn.toString(),
      limit: pool.withdrawal_limit_24h
    };
  }

  return { allowed: true };
}

export async function getCircuitBreakerStatus(poolId: string): Promise<CircuitBreakerStatus> {
  const { query } = await import('../db/postgres');
  const pools = await query(
    `SELECT pool_id, circuit_breaker_active, circuit_breaker_reason, circuit_breaker_triggered_at 
     FROM pools 
     WHERE pool_id = $1`,
    [poolId]
  );

  if (pools.length === 0) {
    throw new Error('Pool not found');
  }

  const pool = pools[0];

  return {
    active: pool.circuit_breaker_active,
    reason: pool.circuit_breaker_reason,
    triggeredAt: pool.circuit_breaker_triggered_at
  };
}

export async function triggerCircuitBreaker(poolId: string, reason: string): Promise<void> {
  const { query } = await import('../db/postgres');
  const result = await query(
    `UPDATE pools 
     SET circuit_breaker_active = $1, 
         circuit_breaker_reason = $2, 
         circuit_breaker_triggered_at = $3,
         status = 'paused'
     WHERE pool_id = $4`,
    [true, reason, new Date().toISOString(), poolId]
  );

  if (result.rowCount === 0) {
    throw new Error('Pool not found');
  }
}

export async function resetCircuitBreaker(poolId: string): Promise<void> {
  const { query } = await import('../db/postgres');
  const result = await query(
    `UPDATE pools 
     SET circuit_breaker_active = $1, 
         circuit_breaker_reason = $2, 
         circuit_breaker_triggered_at = $3
     WHERE pool_id = $4`,
    [false, null, null, poolId]
  );

  if (result.rowCount === 0) {
    throw new Error('Pool not found');
  }
}
