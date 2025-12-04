import { describe, expect, test, vi, beforeEach } from 'vitest';
import { runRewardCycle } from './rewardEngine';

const mockQuery = vi.fn();
const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  getClient: async () => mockClient
}));

vi.mock('../services/configService', () => ({
  getConfig: async () => ({
    rewardUpdateIntervalMinutes: 1,
    blockReward: 2,
    blockTimeSec: 5
  })
}));

describe('rewardEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    mockQuery.mockReset();
    mockClient.query.mockReset();
  });

  test('distributes exactly 24 VIDDHANA per minute across pool', async () => {
    mockQuery.mockResolvedValue([
      { miner_id: 1, total_reward: '8', minutes_count: 1 },
      { miner_id: 2, total_reward: '16', minutes_count: 1 }
    ]);

    await runRewardCycle(1);

    // miner1 should get 8, miner2 should get 16
    const updates = mockClient.query.mock.calls.filter(([sql]: [string]) => sql.includes('UPDATE miners'));
    const rewards = updates.map(([, params]: [string, any[]]) => params?.[0]);
    expect(rewards).toContain(8);
    expect(rewards).toContain(16);
    const total = rewards.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(24, 6);
  });

  test('is idempotent when rerun with same sessions', async () => {
    mockQuery
      .mockResolvedValueOnce([
        { miner_id: 1, total_reward: '24', minutes_count: 1 }
      ])
      .mockResolvedValueOnce([]);

    await runRewardCycle(1);
    const firstUpdates = mockClient.query.mock.calls.length;
    await runRewardCycle(1);
    const secondUpdates = mockClient.query.mock.calls.length;
    expect(secondUpdates).toBe(firstUpdates);
  });
});
