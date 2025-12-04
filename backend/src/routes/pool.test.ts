import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';
import { Wallet } from 'ethers';

// Mock services (legacy generic services are currently unused but kept for future multi-pool support)
const mockGetPoolInfo = vi.fn();
const mockGetUserBalance = vi.fn();
const mockRequestDeposit = vi.fn();
const mockRequestWithdraw = vi.fn();
const mockGetUserRewards = vi.fn();
const mockValidateDeposit = vi.fn();
const mockValidateWithdraw = vi.fn();
const mockCheckCircuitBreaker = vi.fn();

vi.mock('../services/poolService', () => ({
  getPoolInfo: (...args: unknown[]) => mockGetPoolInfo(...args),
  getUserBalance: (...args: unknown[]) => mockGetUserBalance(...args),
  requestDeposit: (...args: unknown[]) => mockRequestDeposit(...args),
  requestWithdraw: (...args: unknown[]) => mockRequestWithdraw(...args),
  validateDeposit: (...args: unknown[]) => mockValidateDeposit(...args),
  validateWithdraw: (...args: unknown[]) => mockValidateWithdraw(...args)
}));

vi.mock('../services/poolRewardService', () => ({
  getUserRewards: (...args: unknown[]) => mockGetUserRewards(...args)
}));

vi.mock('../services/riskService', () => ({
  getCircuitBreakerStatus: (...args: unknown[]) => mockCheckCircuitBreaker(...args)
}));

// Mock BTCD Pool v1 service used by canonical endpoints
const mockBtcdGetPoolInfo = vi.fn();
const mockBtcdGetUserPosition = vi.fn();

vi.mock('../services/btcdPoolService', () => ({
  getPoolInfo: (...args: unknown[]) => mockBtcdGetPoolInfo(...args),
  getUserPosition: (...args: unknown[]) => mockBtcdGetUserPosition(...args),
  recordDeposit: vi.fn()
}));

vi.mock('../db/postgres', () => ({
  query: vi.fn().mockResolvedValue([]),
  pool: {
    query: vi.fn().mockResolvedValue([]),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  }
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.minerId = 1;
    req.walletAddress = req.headers['x-wallet-address'] || '0xabc123';
    next();
  },
  AuthedRequest: Object
}));

vi.mock('../middleware/rateLimit', () => ({
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
  rateLimit: () => (_req: any, _res: any, next: any) => next()
}));

describe('pool routes', () => {
  let app: any;
  let wallet: Wallet;
  let authToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPoolInfo.mockReset();
    mockGetUserBalance.mockReset();
    mockRequestDeposit.mockReset();
    mockRequestWithdraw.mockReset();
    mockGetUserRewards.mockReset();
    mockValidateDeposit.mockReset();
    mockValidateWithdraw.mockReset();
    mockCheckCircuitBreaker.mockReset();
    mockBtcdGetPoolInfo.mockReset();
    mockBtcdGetUserPosition.mockReset();

    app = createApp();
    wallet = Wallet.createRandom();
    authToken = jwt.sign({ minerId: 1, wallet: wallet.address }, config.jwtSecret);
  });

  describe('GET /api/pool/info/:poolId', () => {
    test('returns pool info for valid poolId', async () => {
      mockBtcdGetPoolInfo.mockResolvedValueOnce({
        pool_id: 'btcd-main-pool',
        name: 'BTCD Main Pool',
        deposit_asset: 'BTCD',
        reward_asset: 'BTCD',
        tvl: '1000000',
        apr: '12.34',
        apy: '13.00',
        status: 'active',
        min_withdraw_threshold: '100'
      });

      const res = await request(app).get('/api/pool/info/btcd-main-pool');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('poolId');
      expect(res.body).toHaveProperty('tvl');
      expect(res.body).toHaveProperty('apy');
      expect(res.body.poolId).toBe('btcd-main-pool');
      expect(res.body.asset).toBe('BTCD');
      expect(res.body.cooldownPeriod).toBe(0);
      expect(mockBtcdGetPoolInfo).toHaveBeenCalledWith('btcd-main-pool');
    });

    test('defaults to btcd-main-pool when no poolId provided', async () => {
      mockBtcdGetPoolInfo.mockResolvedValueOnce({
        pool_id: 'btcd-main-pool',
        name: 'BTCD Main Pool',
        deposit_asset: 'BTCD',
        reward_asset: 'BTCD',
        tvl: '1000000',
        apr: '12.34',
        apy: '13.00',
        status: 'active',
        min_withdraw_threshold: '100'
      });

      const res = await request(app).get('/api/pool/info');
      expect(res.status).toBe(200);
      expect(res.body.poolId).toBe('btcd-main-pool');
      expect(res.body.asset).toBe('BTCD');
      expect(mockBtcdGetPoolInfo).toHaveBeenCalledWith('btcd-main-pool');
    });

    test('rejects invalid poolId format', async () => {
      const res = await request(app).get('/api/pool/info/invalid@pool');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid pool ID');
    });
  });

  describe('GET /api/pool/user/:address', () => {
    test('returns user balance for valid address with auth', async () => {
      mockBtcdGetUserPosition.mockResolvedValueOnce({
        wallet_address: wallet.address,
        pool_id: 'btcd-main-pool',
        staked_amount: '5000',
        pending_rewards: '100',
        total_earned: '600',
        last_updated: new Date().toISOString()
      });

      const res = await request(app)
        .get(`/api/pool/user/${wallet.address}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ poolId: 'btcd-main-pool' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('shares');
      expect(res.body).toHaveProperty('underlyingBalance');
      expect(res.body.shares).toBe('5000');
      expect(res.body.underlyingBalance).toBe('5000');
      expect(res.body.pendingRewards).toBe('100');
      expect(res.body).not.toHaveProperty('cooldownEndTime');
      expect(mockBtcdGetUserPosition).toHaveBeenCalledWith(wallet.address, 'btcd-main-pool');
    });

    test('defaults to btcd-main-pool when no poolId provided', async () => {
      mockBtcdGetUserPosition.mockResolvedValueOnce({
        wallet_address: wallet.address,
        pool_id: 'btcd-main-pool',
        staked_amount: '0',
        pending_rewards: '0',
        total_earned: '0',
        last_updated: new Date().toISOString()
      });

      const res = await request(app)
        .get(`/api/pool/user/${wallet.address}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.poolId).toBe('btcd-main-pool');
      expect(mockBtcdGetUserPosition).toHaveBeenCalledWith(wallet.address, 'btcd-main-pool');
    });

    test('rejects invalid address format', async () => {
      const res = await request(app)
        .get('/api/pool/user/invalid-address')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ poolId: 'btcd-main-pool' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid address');
    });

    test('returns 404 when user not found', async () => {
      mockBtcdGetUserPosition.mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/pool/user/${wallet.address}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ poolId: 'btcd-main-pool' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('User not found');
    });
  });

  describe('POST /api/pool/deposit', () => {
    test('processes valid deposit with BTCD', async () => {
      const timestamp = Date.now();
      const nonce = Math.random().toString();
      const message = `pool:${wallet.address}:${timestamp}:${nonce}`;
      const signature = await wallet.signMessage(message);

      const res = await request(app)
        .post('/api/pool/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          poolId: 'btcd-main-pool',
          amount: '1000000000000000000000',
          asset: 'BTCD',
          address: wallet.address,
          signature,
          timestamp,
          nonce
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.shares).toBe('0'); // Placeholder returns '0'
    });

    test('rejects non-BTCD asset', async () => {
      const timestamp = Date.now();
      const nonce = Math.random().toString();
      const message = `pool:${wallet.address}:${timestamp}:${nonce}`;
      const signature = await wallet.signMessage(message);

      const res = await request(app)
        .post('/api/pool/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          poolId: 'btcd-main-pool',
          amount: '1000000000000000000000',
          asset: 'ETH',
          address: wallet.address,
          signature,
          timestamp,
          nonce
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Only BTCD is supported');
    });

    test('requires authentication', async () => {
      const res = await request(app).post('/api/pool/deposit').send({
        poolId: 'btcd-main-pool',
        amount: '1000000000000000000',
        asset: 'BTCD'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    test('validates amount format', async () => {
      const timestamp = Date.now();
      const nonce = Math.random().toString();
      const message = `pool:${wallet.address}:${timestamp}:${nonce}`;
      const signature = await wallet.signMessage(message);

      const res = await request(app)
        .post('/api/pool/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          poolId: 'btcd-main-pool',
          amount: 'invalid',
          asset: 'BTCD',
          address: wallet.address,
          signature,
          timestamp,
          nonce
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid amount');
    });


  });

  describe('POST /api/pool/withdraw', () => {
    test('processes valid withdrawal (V1: no cooldown)', async () => {
      const timestamp = Date.now();
      const nonce = Math.random().toString();
      const message = `pool:${wallet.address}:${timestamp}:${nonce}`;
      const signature = await wallet.signMessage(message);

      const res = await request(app)
        .post('/api/pool/withdraw')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          poolId: 'btcd-main-pool',
          amount: '1000000000000000000000',
          address: wallet.address,
          signature,
          timestamp,
          nonce
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.underlyingAmount).toBe('0'); // Placeholder returns '0'
    });

    test('requires authentication', async () => {
      const res = await request(app).post('/api/pool/withdraw').send({
        poolId: 'btcd-main-pool',
        amount: '1000000000000000000'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

  });

  describe('GET /api/pool/rewards/:address', () => {
    test('returns rewards for valid address with auth', async () => {
      const res = await request(app)
        .get(`/api/pool/rewards/${wallet.address}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalPending');
      expect(res.body).toHaveProperty('totalClaimed');
      expect(res.body).toHaveProperty('rewardsByPool');
      expect(res.body.totalPending).toBe('0'); // Placeholder returns '0'
      expect(res.body.rewardsByPool).toHaveLength(0); // Placeholder returns empty array
    });

    test('rejects invalid address format', async () => {
      const res = await request(app)
        .get('/api/pool/rewards/invalid-address')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid address');
    });

    test('returns empty rewards for user with no deposits', async () => {
      const res = await request(app)
        .get(`/api/pool/rewards/${wallet.address}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.totalPending).toBe('0');
      expect(res.body.rewardsByPool).toHaveLength(0);
    });
  });
});
