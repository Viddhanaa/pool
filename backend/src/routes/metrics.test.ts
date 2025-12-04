import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createApp } from '../server';

describe('GET /api/metrics', () => {
  test('returns placeholder metrics', async () => {
    const app = createApp();
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('# HELP');
    expect(res.headers['content-type']).toContain('text/plain');
  });
});
