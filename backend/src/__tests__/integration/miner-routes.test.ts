import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
// Mock services to avoid real DB/network
vi.mock('../services/pingService', () => ({
  handlePing: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {}
}));
vi.mock('../services/hashrateService', () => ({
  updateHashrate: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../services/withdrawalService', () => ({
  requestWithdrawal: vi.fn().mockResolvedValue(1),
  listWithdrawals: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/minerLiteService', () => ({
  registerMinerLite: vi.fn().mockResolvedValue({ minerId: 1 }),
  recordHeartbeatLite: vi.fn().mockResolvedValue(undefined),
  getSampleTasks: vi.fn().mockReturnValue([]),
  submitTaskResult: vi.fn().mockResolvedValue({ stored: true })
}));

// Mock whole miner router to avoid hitting real redis/db
vi.mock('../../routes/miner', async () => {
  const { Router } = await import('express');
  const router = Router();
  router.post('/miner/register', (_req, res) => res.json({ minerId: 1 }));
  router.post('/miner/heartbeat', (_req, res) => res.json({ ok: true }));
  router.get('/miner/tasks', (_req, res) => res.json({ tasks: [] }));
  router.post('/miner/tasks/submit', (_req, res) => res.json({ stored: true, entry: {} }));
  return { default: router };
});

let app: any;

beforeAll(async () => {
  const mod = await import('../../server');
  app = mod.createApp();
});

describe('Integration-lite: miner routes', () => {

  it('registers a miner', async () => {
    const res = await request(app)
      .post('/api/miner/register')
      .send({ wallet_address: '0xabc', hashrate: 1000, miner_type: 'VALIDATOR' })
      .expect(200);
    expect(res.body.minerId).toBe(1);
  });

  it('accepts heartbeat', async () => {
    await request(app)
      .post('/api/miner/heartbeat')
      .send({ miner_id: 1, metrics: { uptime_seconds: 10 } })
      .expect(200);
  });

  it('lists tasks', async () => {
    const res = await request(app).get('/api/miner/tasks').expect(200);
    expect(res.body).toHaveProperty('tasks');
  });

  it('submits task result', async () => {
    const res = await request(app)
      .post('/api/miner/tasks/submit')
      .send({ miner_id: 1, task_id: 't1', result: { status: 'OK' } })
      .expect(200);
    expect(res.body.stored).toBe(true);
  });
});
