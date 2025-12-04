import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';

const mockAdminMetrics = vi.fn();

vi.mock('../services/adminMetricsService', () => ({
  getAdminMetrics: (...args: unknown[]) => mockAdminMetrics(...args)
}));

// Allow other middleware imports to resolve while bypassing miner auth usage in shared modules
vi.mock('../middleware/auth', () => ({ requireAuth: (_req: any, _res: any, next: any) => next(), AuthedRequest: Object }));

describe('admin auth', () => {
  beforeEach(() => {
    mockAdminMetrics.mockReset();
    mockAdminMetrics.mockResolvedValue({ active_miners: 0, pool_hashrate: 0, pending_withdrawals: 0 });
  });

  test('login issues admin JWT', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/login').send({ password: config.adminPassword });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const decoded = jwt.verify(res.body.token, config.adminJwtSecret) as any;
    expect(decoded.role).toBe('admin');
  });

  test('rejects bad password', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/login').send({ password: 'nope' });
    expect(res.status).toBe(401);
  });

  test('guards admin routes', async () => {
    const app = createApp();
    const unauth = await request(app).get('/api/admin/metrics');
    expect(unauth.status).toBe(401);

    const token = jwt.sign({ role: 'admin' }, config.adminJwtSecret);
    const authed = await request(app).get('/api/admin/metrics').set('Authorization', `Bearer ${token}`);
    expect(authed.status).toBe(200);
    expect(mockAdminMetrics).toHaveBeenCalled();
  });
});
