import { describe, expect, test, vi, beforeEach } from 'vitest';
import { selectNextWithdrawalJob } from './withdrawalQueue';

const mockQuery = vi.fn();
const mockClient = { query: mockQuery } as any;

beforeEach(() => {
  mockQuery.mockReset();
});

describe('withdrawalQueue', () => {
  test('picks pending job first', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ withdrawal_id: 1 }] });
    const job = await selectNextWithdrawalJob(mockClient, 60);
    expect(job?.withdrawal_id).toBe(1);
  });

  test('falls back to stale processing job', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ withdrawal_id: 2 }] });

    const job = await selectNextWithdrawalJob(mockClient, 60);
    expect(job?.withdrawal_id).toBe(2);
  });
});
