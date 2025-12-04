import { beforeEach, describe, expect, test, vi } from 'vitest';
import { markWithdrawalFailed, retryWithdrawalAdmin } from './adminWithdrawalService';

const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

vi.mock('../db/postgres', () => ({
  getClient: async () => mockClient
}));

describe('adminWithdrawalService', () => {
  beforeEach(() => {
    mockClient.query.mockReset();
    mockClient.release.mockReset();
  });

  test('re-locks funds when retrying failed withdrawal', async () => {
    mockClient.query
      // BEGIN
      .mockResolvedValueOnce({})
      // select withdrawal
      .mockResolvedValueOnce({ rows: [{ withdrawal_id: 1, miner_id: 2, amount: 50, status: 'failed' }] })
      // select miner balance
      .mockResolvedValueOnce({ rows: [{ pending_balance: '120' }] })
      // update miner balance
      .mockResolvedValueOnce({})
      // update withdrawal
      .mockResolvedValueOnce({})
      // COMMIT
      .mockResolvedValueOnce({});

    await retryWithdrawalAdmin(1);
    expect(
      mockClient.query
    ).toHaveBeenCalledWith(expect.stringContaining('pending_balance = pending_balance - $1'), [50, 2]);
  });

  test('throws when retrying without enough balance', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ withdrawal_id: 1, miner_id: 2, amount: 80, status: 'failed' }] })
      .mockResolvedValueOnce({ rows: [{ pending_balance: '10' }] })
      .mockResolvedValueOnce({});

    await expect(retryWithdrawalAdmin(1)).rejects.toThrow(/insufficient/i);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('marks processing withdrawal as failed and refunds', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ withdrawal_id: 5, miner_id: 3, amount: 75, status: 'processing' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await markWithdrawalFailed(5, 'manual failure');
    expect(
      mockClient.query
    ).toHaveBeenCalledWith(expect.stringContaining('pending_balance = pending_balance + $1'), [75, 3]);
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('status = \'failed\''), [
      5,
      'manual failure'
    ]);
  });
});
