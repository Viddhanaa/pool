import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { createApp } from '../server';

const mockHealth = vi.fn();

vi.mock('../services/healthService', () => ({
  getHealth: (...args: unknown[]) => mockHealth(...args)
}));

describe('server middleware', () => {
  test('health endpoint works', async () => {
    mockHealth.mockResolvedValue({ ok: true, postgres: { ok: true }, redis: { ok: true }, geth: { ok: true } });
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
