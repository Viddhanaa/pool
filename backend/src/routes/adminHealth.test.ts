import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';

const mockGetHealth = vi.fn();

vi.mock('../services/healthService', () => ({
  getHealth: (...args: unknown[]) => mockGetHealth(...args)
}));

describe('GET /api/admin/health', () => {
  beforeEach(() => {
    mockGetHealth.mockReset();
    mockGetHealth.mockResolvedValue({ ok: true, postgres: { ok: true }, redis: { ok: true }, geth: { ok: true } });
  });

  test('requires admin auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/health');
    expect(res.status).toBe(401);
  });

  test('returns health payload', async () => {
    const token = jwt.sign({ role: 'admin' }, config.adminJwtSecret);
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
