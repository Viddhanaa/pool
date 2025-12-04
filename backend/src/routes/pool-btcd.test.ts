/**
 * BTCD Pool Routes Tests
 * 
 * Tests for BTCD Pool v1 read endpoints:
 * - GET /api/pool/btcd/info/:poolId?
 * - GET /api/pool/btcd/user/:walletAddress
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import poolRouter from './pool';
import * as btcdPoolService from '../services/btcdPoolService';

// Mock the btcdPoolService
vi.mock('../services/btcdPoolService', () => ({
  getPoolInfo: vi.fn(),
  getUserPosition: vi.fn()
}));

// Mock redis
vi.mock('../db/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn()
  }
}));

// Mock postgres
vi.mock('../db/postgres', () => ({
  query: vi.fn()
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/pool', poolRouter);

describe('BTCD Pool Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/pool/btcd/info/:poolId', () => {
    it('should return pool info for valid pool', async () => {
      const mockPoolInfo = {
        pool_id: 'btcd-main-pool',
        name: 'BTCD Main Pool',
        deposit_asset: 'BTCD',
        reward_asset: 'BTCD',
        tvl: '1000000',
        apr: '12.50',
        apy: '13.20',
        status: 'active' as const,
        min_withdraw_threshold: '100'
      };

      vi.mocked(btcdPoolService.getPoolInfo).mockResolvedValueOnce(mockPoolInfo);

      const response = await request(app)
        .get('/api/pool/btcd/info/btcd-main-pool')
        .expect(200);

      expect(response.body).toEqual(mockPoolInfo);
      expect(btcdPoolService.getPoolInfo).toHaveBeenCalledWith('btcd-main-pool');
    });

    it('should use default pool ID when not provided', async () => {
      const mockPoolInfo = {
        pool_id: 'btcd-main-pool',
        name: 'BTCD Main Pool',
        deposit_asset: 'BTCD',
        reward_asset: 'BTCD',
        tvl: '1000000',
        apr: '12.50',
        apy: '13.20',
        status: 'active' as const,
        min_withdraw_threshold: '100'
      };

      vi.mocked(btcdPoolService.getPoolInfo).mockResolvedValueOnce(mockPoolInfo);

      const response = await request(app)
        .get('/api/pool/btcd/info')
        .expect(200);

      expect(response.body).toEqual(mockPoolInfo);
      expect(btcdPoolService.getPoolInfo).toHaveBeenCalledWith('btcd-main-pool');
    });

    it('should return 404 when pool not found', async () => {
      vi.mocked(btcdPoolService.getPoolInfo).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/pool/btcd/info/non-existent-pool')
        .expect(404);

      expect(response.body).toEqual({ error: 'Pool not found' });
    });

    it('should return 400 for invalid pool ID format', async () => {
      const response = await request(app)
        .get('/api/pool/btcd/info/invalid@pool!')
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid pool ID format' });
    });

    it('should handle service errors', async () => {
      vi.mocked(btcdPoolService.getPoolInfo).mockRejectedValueOnce(
        new Error('Database error')
      );

      await request(app)
        .get('/api/pool/btcd/info/btcd-main-pool')
        .expect(500);
    });
  });

  describe('GET /api/pool/btcd/user/:walletAddress', () => {
    it('should return user position for valid address', async () => {
      const mockPosition = {
        wallet_address: '0x1234567890123456789012345678901234567890',
        pool_id: 'btcd-main-pool',
        staked_amount: '5000',
        pending_rewards: '125.50',
        total_earned: '350.75',
        last_updated: '2025-12-03T12:00:00.000Z'
      };

      vi.mocked(btcdPoolService.getUserPosition).mockResolvedValueOnce(mockPosition);

      const response = await request(app)
        .get('/api/pool/btcd/user/0x1234567890123456789012345678901234567890')
        .expect(200);

      expect(response.body).toEqual(mockPosition);
      expect(btcdPoolService.getUserPosition).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        'btcd-main-pool'
      );
    });

    it('should use custom pool ID from query param', async () => {
      const mockPosition = {
        wallet_address: '0x1234567890123456789012345678901234567890',
        pool_id: 'btcd-test-pool',
        staked_amount: '5000',
        pending_rewards: '125.50',
        total_earned: '350.75',
        last_updated: '2025-12-03T12:00:00.000Z'
      };

      vi.mocked(btcdPoolService.getUserPosition).mockResolvedValueOnce(mockPosition);

      const response = await request(app)
        .get('/api/pool/btcd/user/0x1234567890123456789012345678901234567890?poolId=btcd-test-pool')
        .expect(200);

      expect(response.body).toEqual(mockPosition);
      expect(btcdPoolService.getUserPosition).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        'btcd-test-pool'
      );
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(btcdPoolService.getUserPosition).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/pool/btcd/user/0x9999999999999999999999999999999999999999')
        .expect(404);

      expect(response.body).toEqual({
        error: 'User not found',
        message: 'No user found with this wallet address'
      });
    });

    it('should return 400 for invalid wallet address format', async () => {
      const response = await request(app)
        .get('/api/pool/btcd/user/invalid-address')
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid wallet address format' });
    });

    it('should return 400 for invalid pool ID format in query', async () => {
      const response = await request(app)
        .get('/api/pool/btcd/user/0x1234567890123456789012345678901234567890?poolId=invalid@pool!')
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid pool ID format' });
    });

    it('should handle service errors', async () => {
      vi.mocked(btcdPoolService.getUserPosition).mockRejectedValueOnce(
        new Error('Database error')
      );

      await request(app)
        .get('/api/pool/btcd/user/0x1234567890123456789012345678901234567890')
        .expect(500);
    });
  });
});
