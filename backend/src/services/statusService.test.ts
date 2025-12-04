import { describe, expect, test, vi } from 'vitest';
import { markOfflineMiners } from './statusService';

const mockQuery = vi.fn();

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

vi.mock('../services/configService', () => ({
  getConfig: async () => ({ pingTimeoutSeconds: 150 })
}));

describe('statusService', () => {
  test('uses dynamic ping timeout', async () => {
    await markOfflineMiners();
    const params = mockQuery.mock.calls[0][1];
    expect(params?.[0]).toBe(150);
  });
});
