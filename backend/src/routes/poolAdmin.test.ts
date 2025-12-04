import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';

// Mock services
const mockCreatePool = vi.fn();
const mockPausePool = vi.fn();
const mockResumePool = vi.fn();
const mockSetRewardWeights = vi.fn();
const mockGetRiskStatus = vi.fn();
const mockTriggerCircuitBreaker = vi.fn();
const mockResetCircuitBreaker = vi.fn();
const mockGetPoolList = vi.fn();

vi.mock('../services/poolService', () => ({
  createPool: (...args: unknown[]) => mockCreatePool(...args),
  pausePool: (...args: unknown[]) => mockPausePool(...args),
  resumePool: (...args: unknown[]) => mockResumePool(...args),
  getPoolList: (...args: unknown[]) => mockGetPoolList(...args)
}));

vi.mock('../services/poolRewardService', () => ({
  setRewardWeights: (...args: unknown[]) => mockSetRewardWeights(...args)
}));

vi.mock('../services/poolRiskService', () => ({
  getRiskStatus: (...args: unknown[]) => mockGetRiskStatus(...args)
}));

vi.mock('../services/riskService', () => ({
  triggerCircuitBreaker: (...args: unknown[]) => mockTriggerCircuitBreaker(...args),
  resetCircuitBreaker: (...args: unknown[]) => mockResetCircuitBreaker(...args)
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

describe('pool admin routes', () => {
  let app: any;
  let adminToken: string;
  let nonAdminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePool.mockReset();
    mockPausePool.mockReset();
    mockResumePool.mockReset();
    mockSetRewardWeights.mockReset();
    mockGetRiskStatus.mockReset();
    mockTriggerCircuitBreaker.mockReset();
    mockResetCircuitBreaker.mockReset();
    mockGetPoolList.mockReset();

    app = createApp();
    adminToken = jwt.sign({ role: 'admin' }, config.adminJwtSecret);
    nonAdminToken = jwt.sign({ minerId: 1, wallet: '0xabc' }, config.jwtSecret);
  });

  describe('POST /api/pool/admin/create', () => {
    test('requires admin authentication', async () => {
      const res = await request(app).post('/api/pool/admin/create').send({
        name: 'Test Pool',
        asset: '0x0000000000000000000000000000000000000000',
        cooldownPeriod: 86400,
        rewardWeight: 10
      });
      expect(res.status).toBe(401);
    });

    test('creates pool with valid parameters (V1: cooldown should be 0)', async () => {
      const res = await request(app)
        .post('/api/pool/admin/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'BTCD Main Staking Pool',
          asset: '0x0000000000000000000000000000000000000000',
          cooldownPeriod: 0,
          rewardWeight: 10
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('poolId');
    });

    test('rejects non-admin token', async () => {
      const res = await request(app)
        .post('/api/pool/admin/create')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          name: 'Test Pool',
          asset: '0x0000000000000000000000000000000000000000',
          cooldownPeriod: 86400,
          rewardWeight: 10
        });
      expect(res.status).toBe(401);
      expect(mockCreatePool).not.toHaveBeenCalled();
    });

    test('validates pool name', async () => {
      const res = await request(app)
        .post('/api/pool/admin/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          asset: '0x0000000000000000000000000000000000000000',
          cooldownPeriod: 86400,
          rewardWeight: 10
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid pool name');
    });

    test('validates asset address', async () => {
      const res = await request(app)
        .post('/api/pool/admin/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Pool',
          asset: 'invalid-address',
          cooldownPeriod: 86400,
          rewardWeight: 10
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid asset address');
    });

    test('validates reward weight range', async () => {
      const res = await request(app)
        .post('/api/pool/admin/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Pool',
          asset: '0x0000000000000000000000000000000000000000',
          cooldownPeriod: 86400,
          rewardWeight: 150
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Reward weight');
    });
  });

  describe('POST /api/pool/admin/pause', () => {
    test('requires admin authentication', async () => {
      const res = await request(app).post('/api/pool/admin/pause').send({
        poolId: 'pool-test-1',
        reason: 'Emergency maintenance'
      });
      expect(res.status).toBe(401);
    });

    test('pauses pool with valid parameters', async () => {
      const res = await request(app)
        .post('/api/pool/admin/pause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poolId: 'pool-test-1',
          reason: 'Emergency maintenance'
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    test('requires reason for pausing', async () => {
      const res = await request(app)
        .post('/api/pool/admin/pause')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poolId: 'pool-test-1',
          reason: ''
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Reason required');
    });
  });

  describe('POST /api/pool/admin/resume', () => {
    test('requires admin authentication', async () => {
      const res = await request(app).post('/api/pool/admin/resume').send({
        poolId: 'pool-test-1'
      });
      expect(res.status).toBe(401);
    });

    test('resumes pool with valid poolId', async () => {
      const res = await request(app)
        .post('/api/pool/admin/resume')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poolId: 'pool-test-1'
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  // V1: Circuit breaker and list routes are not yet implemented

  describe('POST /api/pool/admin/set-reward-weights', () => {
    test('requires admin authentication', async () => {
      const res = await request(app).post('/api/pool/admin/set-reward-weights').send({
        poolId: 'pool-test-1',
        weights: { mining: 50, staking: 30 }
      });
      expect(res.status).toBe(401);
    });

    test('sets weights with valid parameters', async () => {
      const res = await request(app)
        .post('/api/pool/admin/set-reward-weights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poolId: 'pool-test-1',
          weights: { mining: 50, staking: 30 }
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    test('validates total weights do not exceed 100', async () => {
      const res = await request(app)
        .post('/api/pool/admin/set-reward-weights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poolId: 'pool-test-1',
          weights: { mining: 60, staking: 50 }
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Total weights');
    });

    test('validates individual weight ranges', async () => {
      const res = await request(app)
        .post('/api/pool/admin/set-reward-weights')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poolId: 'pool-test-1',
          weights: { mining: 150 }
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('between 0 and 100');
    });
  });

  describe('GET /api/pool/admin/risk-status', () => {
    test('requires admin authentication', async () => {
      const res = await request(app)
        .get('/api/pool/admin/risk-status')
        .query({ poolId: 'pool-test-1' });
      expect(res.status).toBe(401);
    });

    test('returns risk status with valid poolId', async () => {
      const res = await request(app)
        .get('/api/pool/admin/risk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ poolId: 'pool-test-1' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('circuitBreakerActive');
      expect(res.body).toHaveProperty('currentTvl');
      expect(res.body).toHaveProperty('oracleStatus');
    });

    test('requires poolId query parameter', async () => {
      const res = await request(app)
        .get('/api/pool/admin/risk-status')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('poolId');
    });
  });
});
