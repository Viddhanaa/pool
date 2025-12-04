import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getPartitionName, getPartitionBounds, ensureMiningPartitions } from './partitionService';

const mockQuery = vi.fn();

vi.mock('../db/postgres', () => ({
  query: (...args: unknown[]) => mockQuery(...args)
}));

describe('partitionService', () => {
  beforeEach(() => mockQuery.mockReset());

  test('builds partition name per month', () => {
    const name = getPartitionName(new Date(Date.UTC(2024, 0, 15)));
    expect(name).toBe('mining_sessions_202401');
  });

  test('computes month bounds', () => {
    const { start, end } = getPartitionBounds(new Date(Date.UTC(2024, 2, 5)));
    expect(start.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });

  test('ensures current and next month partitions', async () => {
    mockQuery.mockResolvedValue([]);
    const baseDate = new Date(Date.UTC(2024, 4, 12));
    await ensureMiningPartitions(baseDate);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ensure_mining_session_partition'), [
      '2024-05-01T00:00:00.000Z'
    ]);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ensure_mining_session_partition'), [
      '2024-06-01T00:00:00.000Z'
    ]);
  });
});
