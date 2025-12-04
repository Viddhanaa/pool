import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';

const mockQuery = vi.fn();
const mockClearCache = vi.fn();

vi.mock('../db/postgres', () => {
  const pool = {
    query: (...args: unknown[]) => mockQuery(...args),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  };
  return {
    query: (...args: unknown[]) => mockQuery(...args),
    pool
  };
});

vi.mock('../services/configService', () => ({
  clearConfigCache: () => mockClearCache()
}));

const adminToken = () => jwt.sign({ role: 'admin' }, config.adminJwtSecret);

describe('admin config routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockClearCache.mockReset();
  });

  test('requires admin auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/config');
    expect(res.status).toBe(401);
  });

  test('validates keys and numeric bounds', async () => {
    const app = createApp();
    let res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ key: 'unknown_key', value: 10 });
    expect(res.status).toBe(400);

    res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ key: 'min_withdrawal_threshold', value: 0 });
    expect(res.status).toBe(400);
  });

  test('saves numeric values and clears config cache', async () => {
    mockQuery.mockResolvedValueOnce([]); // upsert

    const app = createApp();
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ key: 'reward_update_interval_minutes', value: 3 });

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO system_config'), [
      'reward_update_interval_minutes',
      3
    ]);
    expect(mockClearCache).toHaveBeenCalled();
  });

  test('returns config rows', async () => {
    mockQuery.mockResolvedValueOnce([
      { config_key: 'min_withdrawal_threshold', config_value: 100, updated_at: '2024-01-01T00:00:00Z' }
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].config_key).toBe('min_withdrawal_threshold');
  });
});
