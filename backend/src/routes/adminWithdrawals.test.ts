import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';

const mockList = vi.fn();
const mockRetry = vi.fn();
const mockMarkFailed = vi.fn();

vi.mock('../services/adminWithdrawalService', () => ({
  listAdminWithdrawals: (...args: unknown[]) => mockList(...args),
  retryWithdrawalAdmin: (...args: unknown[]) => mockRetry(...args),
  markWithdrawalFailed: (...args: unknown[]) => mockMarkFailed(...args)
}));

const adminToken = () => jwt.sign({ role: 'admin' }, config.adminJwtSecret);

describe('admin withdrawal routes', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockRetry.mockReset();
    mockMarkFailed.mockReset();
  });

  test('lists pending/processing withdrawals', async () => {
    mockList.mockResolvedValue([
      { withdrawal_id: 1, miner_id: 2, amount: '50', status: 'pending', error_message: null }
    ]);
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/withdrawals')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].withdrawal_id).toBe(1);
    expect(mockList).toHaveBeenCalled();
  });

  test('retries a withdrawal', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/withdrawals/42/retry')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(mockRetry).toHaveBeenCalledWith(42);
  });

  test('marks withdrawal failed with reason', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/withdrawals/7/mark-failed')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'manually failed' });
    expect(res.status).toBe(200);
    expect(mockMarkFailed).toHaveBeenCalledWith(7, 'manually failed');
  });
});
