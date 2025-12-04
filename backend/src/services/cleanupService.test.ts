import { describe, expect, test, vi } from 'vitest';
import { cleanupOldData } from './cleanupService';

const mockQuery = vi.fn();

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

vi.mock('../services/configService', () => ({
  getConfig: async () => ({ dataRetentionDays: 5 })
}));

describe('cleanupService', () => {
  test('uses dynamic data retention days', async () => {
    mockQuery.mockResolvedValue([]);
    await cleanupOldData();
    const firstCall = mockQuery.mock.calls[0]?.[0];
    expect(firstCall).toContain("INTERVAL '5 days'");
  });
});
