import { getClient } from '../db/postgres';
import { log } from '../lib/logger';
import { transferBtcd } from './blockchain';
import { config } from '../config/env';

/**
 * Request a withdrawal from BTCD Pool v1
 *
 * @param userId - Miner ID from miners table
 * @param poolId - Pool identifier (default: btcd-main-pool)
 * @param amount - Amount of BTCD to withdraw (in BTCD units)
 * @returns withdrawal_id of created withdrawal request
 * @throws Error if validation fails or transaction fails
 */
export async function requestWithdrawal(
  userId: number,
  poolId: string,
  amount: number
): Promise<number> {
  const minWithdrawThreshold = config.minWithdrawalThreshold;

  // Input validation
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  if (amount < minWithdrawThreshold) {
    throw new Error(
      `Withdrawal amount must be at least ${minWithdrawThreshold} BTCD. Requested: ${amount} BTCD`
    );
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock miner row and validate balance
    const minerRes = await client.query(
      `SELECT miner_id, wallet_address, pending_balance 
       FROM miners 
       WHERE miner_id = $1 
       FOR UPDATE`,
      [userId]
    );

    const miner = minerRes.rows[0] as
      | { miner_id: number; wallet_address: string; pending_balance: string }
      | undefined;

    if (!miner) {
      throw new Error('User not found');
    }

    const pendingBalance = Number(miner.pending_balance);

    if (amount > pendingBalance) {
      throw new Error(
        `Insufficient balance. Available: ${pendingBalance} BTCD, Requested: ${amount} BTCD`
      );
    }

    // Atomically decrease pending_balance
    await client.query(
      `UPDATE miners 
       SET pending_balance = pending_balance - $1 
       WHERE miner_id = $2`,
      [amount, userId]
    );

    // Create withdrawal record with pending status
    const withdrawalRes = await client.query(
      `INSERT INTO pool_withdrawals (user_id, pool_id, amount, wallet_address, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING withdrawal_id`,
      [userId, poolId, amount, miner.wallet_address]
    );

    await client.query('COMMIT');

    const withdrawalId = (withdrawalRes.rows[0] as { withdrawal_id: number }).withdrawal_id;

    log.info('Withdrawal request created', {
      withdrawalId,
      userId,
      poolId,
      amount,
      walletAddress: miner.wallet_address
    });

    return withdrawalId;
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('Failed to create withdrawal request', { userId, poolId, amount, error: err });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Process pending withdrawals from the queue
 * Picks up to 10 pending withdrawals and processes them
 * On success: marks as 'completed' with tx_hash
 * On failure: marks as 'failed' and restores pending_balance
 */
export async function processWithdrawals(): Promise<void> {
  const client = await getClient();

  try {
    // Fetch pending withdrawals (limit 10 per batch)
    const pendingRes = await client.query(
      `SELECT withdrawal_id, user_id, pool_id, amount, wallet_address
       FROM pool_withdrawals
       WHERE status = 'pending'
       ORDER BY requested_at ASC
       LIMIT 10`
    );

    const pendingWithdrawals = pendingRes.rows as Array<{
      withdrawal_id: number;
      user_id: number;
      pool_id: string;
      amount: string;
      wallet_address: string;
    }>;

    if (pendingWithdrawals.length === 0) {
      // No pending withdrawals to process
      return;
    }

    log.info(`Processing ${pendingWithdrawals.length} pending withdrawals`);

    // Process each withdrawal
    for (const withdrawal of pendingWithdrawals) {
      await processSingleWithdrawal(
        withdrawal.withdrawal_id,
        withdrawal.user_id,
        withdrawal.pool_id,
        Number(withdrawal.amount),
        withdrawal.wallet_address
      );
    }
  } catch (err) {
    log.error('Error in processWithdrawals batch', { error: err });
  } finally {
    client.release();
  }
}

/**
 * Process a single withdrawal
 * Internal function called by processWithdrawals
 */
async function processSingleWithdrawal(
  withdrawalId: number,
  userId: number,
  poolId: string,
  amount: number,
  walletAddress: string
): Promise<void> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock the withdrawal row
    const lockRes = await client.query(
      `SELECT withdrawal_id, status 
       FROM pool_withdrawals 
       WHERE withdrawal_id = $1 
       FOR UPDATE`,
      [withdrawalId]
    );

    const withdrawal = lockRes.rows[0] as { withdrawal_id: number; status: string } | undefined;

    if (!withdrawal) {
      log.warn('Withdrawal not found', { withdrawalId });
      await client.query('ROLLBACK');
      return;
    }

    // Skip if already processed
    if (withdrawal.status !== 'pending') {
      log.info('Withdrawal already processed', { withdrawalId, status: withdrawal.status });
      await client.query('ROLLBACK');
      return;
    }

    // Mark as processing
    await client.query(
      `UPDATE pool_withdrawals 
       SET status = 'processing' 
       WHERE withdrawal_id = $1`,
      [withdrawalId]
    );

    await client.query('COMMIT');

    // Attempt to send BTCD on-chain (outside transaction)
    try {
      const txHash = await sendBTCDTransfer(walletAddress, amount);

      // Mark as completed
      await client.query(
        `UPDATE pool_withdrawals 
         SET status = 'completed', tx_hash = $1, completed_at = NOW() 
         WHERE withdrawal_id = $2`,
        [txHash, withdrawalId]
      );

      log.info('Withdrawal completed successfully', {
        withdrawalId,
        userId,
        poolId,
        amount,
        txHash
      });
    } catch (transferErr) {
      // Transfer failed - restore balance and mark as failed
      await restoreBalanceOnFailure(withdrawalId, userId, amount, transferErr);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('Error processing single withdrawal', { withdrawalId, error: err });
  } finally {
    client.release();
  }
}

/**
 * Restore user balance when withdrawal fails
 * Marks withdrawal as failed and returns funds to pending_balance
 */
async function restoreBalanceOnFailure(
  withdrawalId: number,
  userId: number,
  amount: number,
  error: unknown
): Promise<void> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Restore pending_balance
    await client.query(
      `UPDATE miners 
       SET pending_balance = pending_balance + $1 
       WHERE miner_id = $2`,
      [amount, userId]
    );

    // Mark withdrawal as failed with error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    await client.query(
      `UPDATE pool_withdrawals 
       SET status = 'failed', error_message = $1 
       WHERE withdrawal_id = $2`,
      [errorMessage.substring(0, 500), withdrawalId] // Limit error message length
    );

    await client.query('COMMIT');

    log.error('Withdrawal failed, balance restored', {
      withdrawalId,
      userId,
      amount,
      error: errorMessage
    });
  } catch (restoreErr) {
    await client.query('ROLLBACK');
    log.error('CRITICAL: Failed to restore balance after withdrawal failure', {
      withdrawalId,
      userId,
      amount,
      originalError: error,
      restoreError: restoreErr
    });
  } finally {
    client.release();
  }
}

/**
 * Send BTCD transfer on-chain using admin wallet
 *
 * @param toAddress - Recipient wallet address
 * @param amount - Amount of BTCD to send
 * @returns Transaction hash
 * @throws Error if transfer fails
 */
export async function sendBTCDTransfer(toAddress: string, amount: number): Promise<string> {
  // Validate address format
  if (!toAddress || !toAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error(`Invalid wallet address format: ${toAddress}`);
  }

  if (amount <= 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  log.info('Sending BTCD transfer', { toAddress, amount });

  try {
    // Use blockchain service to send BTCD (which is native VIDDHANA token)
    const txHash = await transferBtcd(toAddress, amount);

    log.info('BTCD transfer successful', { toAddress, amount, txHash });

    return txHash;
  } catch (err) {
    log.error('BTCD transfer failed', { toAddress, amount, error: err });
    throw new Error(`Failed to send BTCD: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get withdrawal status by ID
 *
 * @param withdrawalId - Withdrawal ID
 * @returns Withdrawal record or null if not found
 */
export async function getWithdrawalStatus(withdrawalId: number): Promise<{
  withdrawal_id: number;
  user_id: number;
  pool_id: string;
  amount: string;
  wallet_address: string;
  status: string;
  tx_hash: string | null;
  error_message: string | null;
  requested_at: Date;
  completed_at: Date | null;
} | null> {
  const client = await getClient();

  try {
    const res = await client.query(
      `SELECT withdrawal_id, user_id, pool_id, amount, wallet_address, 
              status, tx_hash, error_message, requested_at, completed_at
       FROM pool_withdrawals
       WHERE withdrawal_id = $1`,
      [withdrawalId]
    );

    return res.rows[0] || null;
  } finally {
    client.release();
  }
}
