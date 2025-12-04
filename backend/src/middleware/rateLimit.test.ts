import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { rateLimit } from './rateLimit';
import express from 'express';

const redisStore = new Map<string, number>();
vi.mock('../db/redis', () => ({
  redis: {
    incr: vi.fn(async (key: string) => {
      const next = (redisStore.get(key) ?? 0) + 1;
      redisStore.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1)
  }
}));

describe('rateLimit middleware', () => {
  test('blocks when over limit', async () => {
    const app = express();
    app.use(rateLimit({ key: 'test', limit: 1, windowSeconds: 60 }));
    app.get('/', (_req, res) => res.json({ ok: true }));

    await request(app).get('/');
    const res = await request(app).get('/');
    expect(res.status).toBe(429);
  });
});
