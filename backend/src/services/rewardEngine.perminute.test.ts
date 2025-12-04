import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRewardCycle } from './rewardEngine';

// Mock config to use 5s block time, 2 BTCD reward => 24 BTCD/min
vi.mock('./configService', () => ({
  getConfig: vi.fn().mockResolvedValue({
    blockReward: 2,
    blockTimeSec: 5,
    rewardUpdateIntervalMinutes: 5,
    minWithdrawalThreshold: 100,
    dataRetentionDays: 7,
    pingTimeoutSeconds: 120,
    dailyWithdrawalLimit: null
  })
}));

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();

vi.mock('../db/postgres', () => ({
  query: (...args: any[]) => mockQuery(...args),
  getClient: async () => ({
    query: (...args: any[]) => mockClientQuery(...args),
    release: () => {}
  })
}));

describe('rewardEngine per-minute calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockClientQuery.mockReset();
  });

  it('distributes per-minute rewards correctly for a single miner (5 minutes)', async () => {
    // Mock the per-minute aggregation result: miner 1 gets total_reward 120 over 5 minutes (24 BTCD/min)
    mockQuery.mockResolvedValueOnce([
      { miner_id: 1, total_reward: '120', minutes_count: 5 }
    ]);

    // Client query should handle BEGIN/UPDATE/UPDATE/COMMIT
    mockClientQuery.mockResolvedValue({ rows: [] });

    await expect(runRewardCycle(5)).resolves.not.toThrow();

    const updates = mockClientQuery.mock.calls.filter(
      ([sql]: [string]) => sql.includes('UPDATE miners')
    );
    const sessionUpdates = mockClientQuery.mock.calls.filter(
      ([sql]: [string]) => sql.includes('UPDATE mining_sessions')
    );

    expect(updates.length).toBe(1);
    expect(sessionUpdates.length).toBe(1);

    const rewardArg = updates[0][1][0];
    expect(Number(rewardArg)).toBe(120);

    const perMinuteArg = sessionUpdates[0][1][0];
    expect(Number(perMinuteArg)).toBeCloseTo(24);
  });

  it('skips cycle when no active sessions', async () => {
    mockQuery.mockResolvedValueOnce([]); // no rows
    await expect(runRewardCycle(5)).resolves.not.toThrow();
    expect(mockClientQuery).not.toHaveBeenCalled();
  });
});
