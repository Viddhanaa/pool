import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { createApp } from '../server';

const mockHistory = vi.fn();
const mockActive = vi.fn();
const mockHasrateHistory = vi.fn();
const mockPoolCache = vi.fn();

vi.mock('../services/statsService', () => ({
  getEarningsHistory: mockHistory,
  getActiveMinutesHistory: mockActive,
  getHashrateHistory: mockHasrateHistory,
  getPoolHashrateCached: mockPoolCache
}));

vi.mock('../middleware/auth', () => ({ requireAuth: (_req: any, _res: any, next: any) => next(), AuthedRequest: Object }));

describe('stats history endpoints', () => {
  test('returns hashrate history', async () => {
    mockHasrateHistory.mockResolvedValue([{ timestamp: '2024-01-01', hashrate: 1000 }]);
    const app = createApp();
    const res = await request(app).get('/api/miner/hashrate-history?minerId=1');
    expect(res.status).toBe(200);
    expect(res.body[0].hashrate).toBe(1000);
  });

  test('returns active minutes history', async () => {
    mockActive.mockResolvedValue([{ date: '2024-01-01', minutes: 10 }]);
    const app = createApp();
    const res = await request(app).get('/api/miner/active-history?minerId=1');
    expect(res.status).toBe(200);
    expect(res.body[0].minutes).toBe(10);
  });
});
