import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../server';

const mockRegister = vi.fn();
const mockChallenge = vi.fn();
const mockValidate = vi.fn();
const mockVerify = vi.fn();
const mockQuery = vi.fn();
const mockJwtSign = vi.fn(() => 'jwt-token');

vi.mock('../services/authService', () => ({
  registerMiner: (...args: unknown[]) => mockRegister(...args)
}));

vi.mock('../services/signatureService', () => ({
  generateChallenge: (...args: unknown[]) => mockChallenge(...args),
  validateChallenge: (...args: unknown[]) => mockValidate(...args),
  verifySignature: (...args: unknown[]) => mockVerify(...args)
}));

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  }
}));

vi.mock('jsonwebtoken', () => ({
  sign: (...args: unknown[]) => mockJwtSign(...args)
}));

describe('auth routes', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockChallenge.mockReset();
    mockValidate.mockReset();
    mockVerify.mockReset();
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ miner_id: 1 }]); // default row so login passes unless overridden
    mockJwtSign.mockReset();
  });

  test('issues challenge', async () => {
    mockChallenge.mockResolvedValue({ challenge: 'msg', expiresAt: Date.now() + 1000 });
    const app = createApp();
    const res = await request(app).post('/api/auth/challenge').send({ wallet_address: '0xabc' });
    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe('msg');
  });

  test('register verifies signature and challenge', async () => {
    mockValidate.mockResolvedValue(true);
    mockVerify.mockReturnValue(true);
    mockRegister.mockResolvedValue({ minerId: 1, token: 'jwt', message: 'msg' });
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ wallet_address: '0xabc', signature: 'sig', challenge: 'c', hashrate: 100 });
    expect(res.status).toBe(200);
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: '0xabc', signature: 'sig', message: 'c', hashrate: 100 })
    );
  });

  test('login route is disabled (returns 404)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ wallet_address: '0xabc', signature: 'sig', challenge: 'c' });
    expect(res.status).toBe(404);
  });
});
