import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestWithdrawal,
  processWithdrawals,
  sendBTCDTransfer,
  getWithdrawalStatus
} from './btcdPoolWithdrawalService';
import * as postgres from '../db/postgres';
import * as blockchain from './blockchain';
import { config } from '../config/env';

// Mock dependencies
vi.mock('../db/postgres');
vi.mock('./blockchain');
vi.mock('../lib/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('btcdPoolWithdrawalService', () => {
  let mockClient: any;

  beforeEach(() => {
    // Setup mock client with transaction methods
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };

    vi.mocked(postgres.getClient).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('requestWithdrawal', () => {
    it('should create withdrawal request successfully', async () => {
      const userId = 1;
      const poolId = 'btcd-main-pool';
      const amount = 150;

      // Mock miner data with sufficient balance
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              miner_id: userId,
              wallet_address: '0x1234567890123456789012345678901234567890',
              pending_balance: '200.5'
            }
          ]
        }) // SELECT miner
        .mockResolvedValueOnce({ rows: [] }) // UPDATE pending_balance
        .mockResolvedValueOnce({ rows: [{ withdrawal_id: 42 }] }) // INSERT withdrawal
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const withdrawalId = await requestWithdrawal(userId, poolId, amount);

      expect(withdrawalId).toBe(42);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error when amount is below minimum threshold', async () => {
      const userId = 1;
      const poolId = 'btcd-main-pool';
      const amount = 50; // Below default threshold of 100

      await expect(requestWithdrawal(userId, poolId, amount)).rejects.toThrow(/at least 100 BTCD/);

      expect(mockClient.release).not.toHaveBeenCalled();
    });

    it('should throw error when amount exceeds pending balance', async () => {
      const userId = 1;
      const poolId = 'btcd-main-pool';
      const amount = 500;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              miner_id: userId,
              wallet_address: '0x1234567890123456789012345678901234567890',
              pending_balance: '200'
            }
          ]
        }); // SELECT miner

      await expect(requestWithdrawal(userId, poolId, amount)).rejects.toThrow(
        /Insufficient balance/
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      const userId = 999;
      const poolId = 'btcd-main-pool';
      const amount = 150;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT miner (not found)

      await expect(requestWithdrawal(userId, poolId, amount)).rejects.toThrow('User not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const userId = 1;
      const poolId = 'btcd-main-pool';
      const amount = 150;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // SELECT fails

      await expect(requestWithdrawal(userId, poolId, amount)).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('sendBTCDTransfer', () => {
    it('should send BTCD transfer successfully', async () => {
      const toAddress = '0x1234567890123456789012345678901234567890';
      const amount = 150;
      const expectedTxHash = '0xabcdef1234567890';

      vi.mocked(blockchain.transferBtcd).mockResolvedValueOnce(expectedTxHash);

      const txHash = await sendBTCDTransfer(toAddress, amount);

      expect(txHash).toBe(expectedTxHash);
      expect(blockchain.transferBtcd).toHaveBeenCalledWith(toAddress, amount);
    });

    it('should throw error for invalid address format', async () => {
      const invalidAddress = 'invalid-address';
      const amount = 150;

      await expect(sendBTCDTransfer(invalidAddress, amount)).rejects.toThrow(
        /Invalid wallet address format/
      );

      expect(blockchain.transferBtcd).not.toHaveBeenCalled();
    });

    it('should throw error for invalid amount', async () => {
      const toAddress = '0x1234567890123456789012345678901234567890';
      const amount = -50;

      await expect(sendBTCDTransfer(toAddress, amount)).rejects.toThrow(/Invalid amount/);

      expect(blockchain.transferBtcd).not.toHaveBeenCalled();
    });

    it('should handle blockchain transfer failure', async () => {
      const toAddress = '0x1234567890123456789012345678901234567890';
      const amount = 150;

      vi.mocked(blockchain.transferBtcd).mockRejectedValueOnce(new Error('Insufficient gas'));

      await expect(sendBTCDTransfer(toAddress, amount)).rejects.toThrow(/Failed to send BTCD/);

      expect(blockchain.transferBtcd).toHaveBeenCalledWith(toAddress, amount);
    });
  });

  describe('processWithdrawals', () => {
    it('should process pending withdrawals successfully', async () => {
      const pendingWithdrawals = [
        {
          withdrawal_id: 1,
          user_id: 1,
          pool_id: 'btcd-main-pool',
          amount: '150',
          wallet_address: '0x1234567890123456789012345678901234567890'
        }
      ];

      const txHash = '0xabcdef1234567890';

      // Mock queries for processWithdrawals
      mockClient.query
        .mockResolvedValueOnce({ rows: pendingWithdrawals }) // SELECT pending withdrawals
        .mockResolvedValueOnce({ rows: [] }) // BEGIN (for single withdrawal)
        .mockResolvedValueOnce({
          rows: [{ withdrawal_id: 1, status: 'pending' }]
        }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }) // UPDATE to processing
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      vi.mocked(blockchain.transferBtcd).mockResolvedValueOnce(txHash);

      // Mock the final UPDATE to completed
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await processWithdrawals();

      expect(blockchain.transferBtcd).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        150
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle empty pending withdrawals queue', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // No pending withdrawals

      await processWithdrawals();

      expect(blockchain.transferBtcd).not.toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should restore balance on transfer failure', async () => {
      const pendingWithdrawals = [
        {
          withdrawal_id: 1,
          user_id: 1,
          pool_id: 'btcd-main-pool',
          amount: '150',
          wallet_address: '0x1234567890123456789012345678901234567890'
        }
      ];

      // Mock queries
      mockClient.query
        .mockResolvedValueOnce({ rows: pendingWithdrawals }) // SELECT pending
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ withdrawal_id: 1, status: 'pending' }]
        }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }) // UPDATE to processing
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      vi.mocked(blockchain.transferBtcd).mockRejectedValueOnce(new Error('Transfer failed'));

      // Setup separate mock client for restore balance transaction
      const restoreClient = {
        query: vi.fn(),
        release: vi.fn()
      };

      vi.mocked(postgres.getClient)
        .mockResolvedValueOnce(mockClient) // Main processWithdrawals call
        .mockResolvedValueOnce(mockClient) // processSingleWithdrawal call
        .mockResolvedValueOnce(restoreClient); // restoreBalanceOnFailure call

      restoreClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE miners (restore balance)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE withdrawals (set failed)
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await processWithdrawals();

      expect(blockchain.transferBtcd).toHaveBeenCalled();
      expect(restoreClient.query).toHaveBeenCalledWith('BEGIN');
      expect(restoreClient.query).toHaveBeenCalledWith('COMMIT');
      expect(restoreClient.release).toHaveBeenCalled();
    });
  });

  describe('getWithdrawalStatus', () => {
    it('should return withdrawal status', async () => {
      const withdrawalId = 42;
      const mockWithdrawal = {
        withdrawal_id: 42,
        user_id: 1,
        pool_id: 'btcd-main-pool',
        amount: '150',
        wallet_address: '0x1234567890123456789012345678901234567890',
        status: 'completed',
        tx_hash: '0xabcdef1234567890',
        error_message: null,
        requested_at: new Date(),
        completed_at: new Date()
      };

      mockClient.query.mockResolvedValueOnce({ rows: [mockWithdrawal] });

      const result = await getWithdrawalStatus(withdrawalId);

      expect(result).toEqual(mockWithdrawal);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null for non-existent withdrawal', async () => {
      const withdrawalId = 999;

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await getWithdrawalStatus(withdrawalId);

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
