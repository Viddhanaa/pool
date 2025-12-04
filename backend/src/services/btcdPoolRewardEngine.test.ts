import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  distributePoolRewards,
  resetDistributionTimestamp,
  getLastDistributionTime
} from './btcdPoolRewardEngine';
import * as postgres from '../db/postgres';

// Mock database
vi.mock('../db/postgres');
vi.mock('../lib/logger');

describe('btcdPoolRewardEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDistributionTimestamp();
  });

  describe('distributePoolRewards', () => {
    it('should distribute rewards proportionally to users based on stake', async () => {
      // Mock pool config
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'active'
        }
      ];

      // Mock user positions
      const mockPositions = [
        { user_id: 1, staked_amount: '500' }, // 50% of total
        { user_id: 2, staked_amount: '300' }, // 30% of total
        { user_id: 3, staked_amount: '200' } // 20% of total
      ];

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };

      vi.mocked(postgres.query)
        .mockResolvedValueOnce(mockPoolConfig) // pool_config query
        .mockResolvedValueOnce(mockPositions); // pool_positions query

      vi.mocked(postgres.getClient).mockResolvedValue(mockClient as any);

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(true);
      expect(result.userCount).toBe(3);
      expect(result.totalDistributed).toBeCloseTo(100, 6); // 100 BTCD total

      // Verify user 1 got 50 BTCD (50% of 100)
      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [50, 1]);

      // Verify user 2 got 30 BTCD (30% of 100)
      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [30, 2]);

      // Verify user 3 got 20 BTCD (20% of 100)
      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [20, 3]);
    });

    it('should skip distribution if pool is not active', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'paused'
        }
      ];

      vi.mocked(postgres.query).mockResolvedValueOnce(mockPoolConfig);

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(false);
      expect(result.message).toContain('paused');
      expect(result.totalDistributed).toBe(0);
    });

    it('should skip distribution if no users have staked', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'active'
        }
      ];

      vi.mocked(postgres.query).mockResolvedValueOnce(mockPoolConfig).mockResolvedValueOnce([]); // No positions

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(true);
      expect(result.userCount).toBe(0);
      expect(result.totalDistributed).toBe(0);
      expect(result.message).toContain('No users');
    });

    it('should skip distribution if reward_per_minute is zero', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '0',
          status: 'active'
        }
      ];

      vi.mocked(postgres.query).mockResolvedValueOnce(mockPoolConfig);

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(false);
      expect(result.message).toContain('zero');
      expect(result.totalDistributed).toBe(0);
    });

    it('should return error if pool not found', async () => {
      vi.mocked(postgres.query).mockResolvedValueOnce([]); // No pool found

      const result = await distributePoolRewards('invalid-pool');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.totalDistributed).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(postgres.query).mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
      expect(result.totalDistributed).toBe(0);
    });

    it('should prevent double distribution within minimum interval', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'active'
        }
      ];

      const mockPositions = [{ user_id: 1, staked_amount: '1000' }];

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };

      vi.mocked(postgres.query)
        .mockResolvedValue(mockPoolConfig)
        .mockResolvedValueOnce(mockPoolConfig)
        .mockResolvedValueOnce(mockPositions);

      vi.mocked(postgres.getClient).mockResolvedValue(mockClient as any);

      // First distribution should succeed
      const result1 = await distributePoolRewards('btcd-main-pool');
      expect(result1.success).toBe(true);

      // Immediate second distribution should be skipped
      const result2 = await distributePoolRewards('btcd-main-pool');
      expect(result2.success).toBe(false);
      expect(result2.message).toContain('Skipped');
    });

    it('should handle users with very small stakes correctly', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '0.001', // Very small reward
          status: 'active'
        }
      ];

      const mockPositions = [
        { user_id: 1, staked_amount: '0.000001' }, // Extremely small stake
        { user_id: 2, staked_amount: '1000' } // Large stake
      ];

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };

      vi.mocked(postgres.query)
        .mockResolvedValueOnce(mockPoolConfig)
        .mockResolvedValueOnce(mockPositions);

      vi.mocked(postgres.getClient).mockResolvedValue(mockClient as any);

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(true);
      // User 1's reward might round to zero and be skipped
      // User 2 should get almost all the reward
      expect(result.userCount).toBeGreaterThanOrEqual(1);
    });

    it('should update both pending_balance and total_earned', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'active'
        }
      ];

      const mockPositions = [{ user_id: 1, staked_amount: '1000' }];

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };

      vi.mocked(postgres.query)
        .mockResolvedValueOnce(mockPoolConfig)
        .mockResolvedValueOnce(mockPositions);

      vi.mocked(postgres.getClient).mockResolvedValue(mockClient as any);

      await distributePoolRewards('btcd-main-pool');

      // Verify the UPDATE query includes both pending_balance and total_earned
      const updateCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('UPDATE miners')
      );

      expect(updateCalls.length).toBeGreaterThan(0);
      expect(updateCalls[0][0]).toContain('pending_balance');
      expect(updateCalls[0][0]).toContain('total_earned');
    });
  });

  describe('resetDistributionTimestamp', () => {
    it('should reset the last distribution timestamp', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'active'
        }
      ];

      const mockPositions = [{ user_id: 1, staked_amount: '1000' }];

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };

      vi.mocked(postgres.query)
        .mockResolvedValue(mockPoolConfig)
        .mockResolvedValueOnce(mockPoolConfig)
        .mockResolvedValueOnce(mockPositions);

      vi.mocked(postgres.getClient).mockResolvedValue(mockClient as any);

      // First distribution
      await distributePoolRewards('btcd-main-pool');
      expect(getLastDistributionTime()).not.toBeNull();

      // Reset timestamp
      resetDistributionTimestamp();
      expect(getLastDistributionTime()).toBeNull();

      // Should be able to distribute again immediately after reset
      vi.mocked(postgres.query)
        .mockResolvedValueOnce(mockPoolConfig)
        .mockResolvedValueOnce(mockPositions);

      const result = await distributePoolRewards('btcd-main-pool');
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle equal stakes correctly', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'active'
        }
      ];

      const mockPositions = [
        { user_id: 1, staked_amount: '100' },
        { user_id: 2, staked_amount: '100' },
        { user_id: 3, staked_amount: '100' }
      ];

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };

      vi.mocked(postgres.query)
        .mockResolvedValueOnce(mockPoolConfig)
        .mockResolvedValueOnce(mockPositions);

      vi.mocked(postgres.getClient).mockResolvedValue(mockClient as any);

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(true);
      expect(result.userCount).toBe(3);

      // Each user should get 33.333... BTCD
      const updateCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('UPDATE miners')
      );

      updateCalls.forEach((call) => {
        expect(call[1][0]).toBeCloseTo(33.333333333333336, 10);
      });
    });

    it('should handle single user in pool', async () => {
      const mockPoolConfig = [
        {
          pool_id: 'btcd-main-pool',
          reward_per_minute: '100',
          status: 'active'
        }
      ];

      const mockPositions = [{ user_id: 1, staked_amount: '1000' }];

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };

      vi.mocked(postgres.query)
        .mockResolvedValueOnce(mockPoolConfig)
        .mockResolvedValueOnce(mockPositions);

      vi.mocked(postgres.getClient).mockResolvedValue(mockClient as any);

      const result = await distributePoolRewards('btcd-main-pool');

      expect(result.success).toBe(true);
      expect(result.userCount).toBe(1);
      expect(result.totalDistributed).toBe(100); // Should get full reward

      // Verify user got full 100 BTCD
      expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [100, 1]);
    });
  });
});
