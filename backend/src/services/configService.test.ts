import { beforeEach, describe, expect, test, vi } from 'vitest';
import { config as envConfig } from '../config/env';
import { getConfig, clearConfigCache } from './configService';

const mockQuery = vi.fn();

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

describe('configService', () => {
  beforeEach(() => {
    clearConfigCache();
    mockQuery.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('reads from DB and caches for 30s', async () => {
    mockQuery.mockResolvedValue([
      { config_key: 'min_withdrawal_threshold', config_value: 200 },
      { config_key: 'reward_update_interval_minutes', config_value: 2 },
      { config_key: 'data_retention_days', config_value: 10 },
      { config_key: 'ping_timeout_seconds', config_value: 90 }
    ]);

    const first = await getConfig();
    expect(first.minWithdrawalThreshold).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1);

    const second = await getConfig();
    expect(second.rewardUpdateIntervalMinutes).toBe(2);
    expect(mockQuery).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);
    const third = await getConfig();
    expect(third.dataRetentionDays).toBe(10);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  test('falls back to env when DB missing', async () => {
    const original = envConfig.minWithdrawalThreshold;
    // mutate env config for fallback check
    (envConfig as any).minWithdrawalThreshold = 150;
    mockQuery.mockResolvedValue([]);
    const cfg = await getConfig();
    expect(cfg.minWithdrawalThreshold).toBe(150);
    expect(cfg.rewardUpdateIntervalMinutes).toBeGreaterThan(0);
    (envConfig as any).minWithdrawalThreshold = original;
  });
});
