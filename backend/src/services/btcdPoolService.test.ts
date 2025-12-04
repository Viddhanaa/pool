/**
 * BTCD Pool Service Tests
 * 
 * Tests for pool read operations:
 * - getPoolInfo()
 * - getUserPosition()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPoolInfo, getUserPosition } from './btcdPoolService';
import * as postgres from '../db/postgres';

// Mock postgres query function
vi.mock('../db/postgres', () => ({
  query: vi.fn()
}));

describe('btcdPoolService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPoolInfo', () => {
    it('should return pool info with calculated APR and APY', async () => {
      // Mock pool config data
      const mockPoolConfig = {
        pool_id: 'btcd-main-pool',
        deposit_asset: 'BTCD',
        reward_asset: 'BTCD',
        min_withdraw_threshold: '100',
        reward_per_minute: '24',
        tvl: '1000000',
        status: 'active' as const
      };

      vi.mocked(postgres.query).mockResolvedValueOnce([mockPoolConfig]);

      const result = await getPoolInfo('btcd-main-pool');

      expect(result).toBeDefined();
      expect(result?.pool_id).toBe('btcd-main-pool');
      expect(result?.name).toBe('BTCD Main Pool');
      expect(result?.deposit_asset).toBe('BTCD');
      expect(result?.reward_asset).toBe('BTCD');
      expect(result?.tvl).toBe('1000000');
      expect(result?.status).toBe('active');
      expect(result?.min_withdraw_threshold).toBe('100');
      
      // APR calculation: (24 * 60 * 24 * 365) / 1000000 * 100 = 1.2614%
      expect(parseFloat(result?.apr || '0')).toBeGreaterThan(0);
      
      // APY should be slightly higher than APR due to compounding
      expect(parseFloat(result?.apy || '0')).toBeGreaterThan(parseFloat(result?.apr || '0'));
    });

    it('should return zero APR/APY when TVL is zero', async () => {
      const mockPoolConfig = {
        pool_id: 'btcd-main-pool',
        deposit_asset: 'BTCD',
        reward_asset: 'BTCD',
        min_withdraw_threshold: '100',
        reward_per_minute: '24',
        tvl: '0',
        status: 'active' as const
      };

      vi.mocked(postgres.query).mockResolvedValueOnce([mockPoolConfig]);

      const result = await getPoolInfo('btcd-main-pool');

      expect(result?.apr).toBe('0');
      expect(result?.apy).toBe('0');
    });

    it('should return zero APR/APY when reward per minute is zero', async () => {
      const mockPoolConfig = {
        pool_id: 'btcd-main-pool',
        deposit_asset: 'BTCD',
        reward_asset: 'BTCD',
        min_withdraw_threshold: '100',
        reward_per_minute: '0',
        tvl: '1000000',
        status: 'active' as const
      };

      vi.mocked(postgres.query).mockResolvedValueOnce([mockPoolConfig]);

      const result = await getPoolInfo('btcd-main-pool');

      expect(result?.apr).toBe('0');
      expect(result?.apy).toBe('0');
    });

    it('should return null when pool not found', async () => {
      vi.mocked(postgres.query).mockResolvedValueOnce([]);

      const result = await getPoolInfo('non-existent-pool');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(postgres.query).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(getPoolInfo('btcd-main-pool')).rejects.toThrow('Failed to fetch pool info');
    });
  });

  describe('getUserPosition', () => {
    it('should return user position with staked amount and pending rewards', async () => {
      const mockMiner = {
        miner_id: 1,
        wallet_address: '0x1234567890123456789012345678901234567890',
        total_earned: '500',
        pending_balance: '125.50'
      };

      const mockPosition = {
        staked_amount: '5000',
        last_updated: new Date('2025-12-03T12:00:00Z')
      };

      // First call for miner lookup
      vi.mocked(postgres.query).mockResolvedValueOnce([mockMiner]);
      
      // Second call for position lookup
      vi.mocked(postgres.query).mockResolvedValueOnce([mockPosition]);

      const result = await getUserPosition('0x1234567890123456789012345678901234567890', 'btcd-main-pool');

      expect(result).toBeDefined();
      expect(result?.wallet_address).toBe('0x1234567890123456789012345678901234567890');
      expect(result?.pool_id).toBe('btcd-main-pool');
      expect(result?.staked_amount).toBe('5000');
      expect(result?.pending_rewards).toBe('125.50');
      expect(result?.total_earned).toBe('500');
      expect(result?.last_updated).toBe('2025-12-03T12:00:00.000Z');
    });

    it('should return zeros for user with no position', async () => {
      const mockMiner = {
        miner_id: 1,
        wallet_address: '0x1234567890123456789012345678901234567890',
        total_earned: '0',
        pending_balance: '0'
      };

      // First call for miner lookup
      vi.mocked(postgres.query).mockResolvedValueOnce([mockMiner]);
      
      // Second call for position lookup (empty)
      vi.mocked(postgres.query).mockResolvedValueOnce([]);

      const result = await getUserPosition('0x1234567890123456789012345678901234567890', 'btcd-main-pool');

      expect(result).toBeDefined();
      expect(result?.staked_amount).toBe('0');
      expect(result?.pending_rewards).toBe('0');
      expect(result?.total_earned).toBe('0');
    });

    it('should return null when user not found', async () => {
      vi.mocked(postgres.query).mockResolvedValueOnce([]);

      const result = await getUserPosition('0x9999999999999999999999999999999999999999', 'btcd-main-pool');

      expect(result).toBeNull();
    });

    it('should handle case-insensitive wallet address lookup', async () => {
      const mockMiner = {
        miner_id: 1,
        wallet_address: '0x1234567890123456789012345678901234567890',
        total_earned: '100',
        pending_balance: '50'
      };

      const mockPosition = {
        staked_amount: '1000',
        last_updated: new Date('2025-12-03T12:00:00Z')
      };

      vi.mocked(postgres.query).mockResolvedValueOnce([mockMiner]);
      vi.mocked(postgres.query).mockResolvedValueOnce([mockPosition]);

      // Test with uppercase address
      const result = await getUserPosition('0X1234567890123456789012345678901234567890', 'btcd-main-pool');

      expect(result).toBeDefined();
      expect(result?.wallet_address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(postgres.query).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        getUserPosition('0x1234567890123456789012345678901234567890', 'btcd-main-pool')
      ).rejects.toThrow('Failed to fetch user position');
    });
  });
});
