import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';

const mockAdminMetrics = vi.fn();

vi.mock('../services/adminMetricsService', () => ({
  getAdminMetrics: (...args: unknown[]) => mockAdminMetrics(...args)
}));

vi.mock('../middleware/auth', () => ({ requireAuth: (_req: any, _res: any, next: any) => next(), AuthedRequest: Object }));

describe('GET /api/admin/metrics', () => {
  test('returns metrics', async () => {
    mockAdminMetrics.mockResolvedValue({ active_miners: 5, pool_hashrate: 3000, pending_withdrawals: 2 });
    const app = createApp();
    const token = jwt.sign({ role: 'admin' }, config.adminJwtSecret);
    const res = await request(app).get('/api/admin/metrics').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pool_hashrate).toBe(3000);
  });

  test('requires auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(401);
  });
});
