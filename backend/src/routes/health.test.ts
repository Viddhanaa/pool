import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { createApp } from '../server';

const mockHealth = vi.fn();

vi.mock('../services/healthService', () => ({
  getHealth: (...args: unknown[]) => mockHealth(...args)
}));

vi.mock('../middleware/auth', () => ({ requireAuth: (_req: any, _res: any, next: any) => next(), AuthedRequest: Object }));

describe('GET /health', () => {
  test('returns health object', async () => {
    mockHealth.mockResolvedValue({ postgres: { ok: true }, redis: { ok: true }, geth: { ok: true } });
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.postgres.ok).toBe(true);
  });
});
