import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestWithdrawal } from './withdrawalService';

vi.mock('./configService', () => ({
  getConfig: vi.fn().mockResolvedValue({
    minWithdrawalThreshold: 100,
    rewardUpdateIntervalMinutes: 5,
    dataRetentionDays: 7,
    pingTimeoutSeconds: 120,
    dailyWithdrawalLimit: null,
    blockReward: 2,
    blockTimeSec: 5
  })
}));

const mockClientQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock('../db/postgres', () => ({
  getClient: async () => ({
    query: (...args: any[]) => mockClientQuery(...args),
    release: () => mockRelease()
  })
}));

describe('withdrawalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientQuery.mockReset();
  });

  it('rejects below minimum threshold', async () => {
    await expect(requestWithdrawal(1, 50)).rejects.toThrow('Below minimum threshold');
  });

  it('deducts balance with conditional update and returns withdrawal id', async () => {
    // Call order:
    // 1) BEGIN
    // 2) SELECT pending_balance, wallet_address FOR UPDATE
    // 3) UPDATE miners SET pending_balance = pending_balance - $1 ... RETURNING pending_balance
    // 4) INSERT INTO withdrawals RETURNING withdrawal_id
    // 5) COMMIT
    mockClientQuery.mockImplementation((sql: string) => {
      if (sql.startsWith('BEGIN')) return Promise.resolve();
      if (sql.includes('SELECT pending_balance')) {
        return Promise.resolve({ rows: [{ pending_balance: '150', wallet_address: '0xabc' }] });
      }
      if (sql.includes('UPDATE miners')) {
        return Promise.resolve({ rows: [{ pending_balance: '50' }] });
      }
      if (sql.includes('INSERT INTO withdrawals')) {
        return Promise.resolve({ rows: [{ withdrawal_id: 99 }] });
      }
      if (sql.startsWith('COMMIT')) return Promise.resolve();
      return Promise.resolve({ rows: [] });
    });

    const id = await requestWithdrawal(1, 100, 'key-1');
    expect(id).toBe(99);

    const updateCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
      sql.includes('UPDATE miners')
    );
    expect(updateCall).toBeDefined();
    const withdrawCall = mockClientQuery.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO withdrawals')
    );
    expect(withdrawCall?.[1][3]).toBe('key-1'); // idempotency_key passed
  });

  it('blocks when insufficient after conditional update', async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (sql.startsWith('BEGIN')) return Promise.resolve();
      if (sql.includes('SELECT pending_balance')) {
        return Promise.resolve({ rows: [{ pending_balance: '80', wallet_address: '0xabc' }] });
      }
      if (sql.includes('UPDATE miners')) {
        return Promise.resolve({ rows: [] }); // conditional update failed
      }
      if (sql.startsWith('ROLLBACK') || sql.startsWith('COMMIT')) return Promise.resolve();
      return Promise.resolve({ rows: [] });
    });

    await expect(requestWithdrawal(1, 100)).rejects.toThrow('Insufficient balance');
  });
});
