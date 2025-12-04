import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { config } from '../config/env';

const mockList = vi.fn();

vi.mock('../services/withdrawalService', () => ({
  requestWithdrawal: vi.fn(),
  processWithdrawal: vi.fn(),
  listWithdrawals: (...args: unknown[]) => mockList(...args)
}));

describe('GET /api/withdrawals', () => {
  test('returns withdrawals for miner', async () => {
    mockList.mockResolvedValue([
      { withdrawal_id: 1, amount: '100', status: 'completed', tx_hash: '0xabc', requested_at: '2024-01-01' }
    ]);

    const app = createApp();
    const token = jwt.sign({ minerId: 1 }, config.jwtSecret);
    const res = await request(app)
      .get('/api/withdrawals?minerId=1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].withdrawal_id).toBe(1);
    expect(mockList).toHaveBeenCalledWith(1, { limit: 20, offset: 0 });
  });

  test('400 on missing minerId', async () => {
    const app = createApp();
    const token = jwt.sign({ minerId: 1 }, config.jwtSecret);
    const res = await request(app).get('/api/withdrawals').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
