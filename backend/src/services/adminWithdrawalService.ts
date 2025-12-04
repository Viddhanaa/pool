import { getClient, query } from '../db/postgres';

export async function listAdminWithdrawals() {
  return query(
    `SELECT withdrawal_id, miner_id, amount, status, tx_hash, requested_at, error_message
     FROM withdrawals
     WHERE status IN ('pending','processing','failed')
     ORDER BY requested_at`
  );
}

export async function retryWithdrawalAdmin(withdrawalId: number) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `SELECT withdrawal_id, miner_id, amount, status
       FROM withdrawals
       WHERE withdrawal_id = $1
       FOR UPDATE`,
      [withdrawalId]
    );
    const withdrawal = res.rows[0] as {
      withdrawal_id: number;
      miner_id: number;
      amount: number | string;
      status: string;
    } | undefined;
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }
    if (withdrawal.status === 'completed') {
      throw new Error('Withdrawal already completed');
    }

    if (withdrawal.status === 'failed') {
      const minerRes = await client.query(
        `SELECT pending_balance FROM miners WHERE miner_id = $1 FOR UPDATE`,
        [withdrawal.miner_id]
      );
      const miner = minerRes.rows[0] as { pending_balance: string } | undefined;
      const pendingBalance = Number(miner?.pending_balance ?? 0);
      const amount = Number(withdrawal.amount);
      if (!Number.isFinite(pendingBalance) || pendingBalance < amount) {
        throw new Error('Insufficient balance to retry');
      }
      await client.query(`UPDATE miners SET pending_balance = pending_balance - $1 WHERE miner_id = $2`, [
        amount,
        withdrawal.miner_id
      ]);
    }

    await client.query(
      `UPDATE withdrawals
       SET status = 'pending',
           error_message = NULL,
           tx_hash = NULL,
           requested_at = NOW()
       WHERE withdrawal_id = $1`,
      [withdrawalId]
    );
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackErr) {
      // noop
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function markWithdrawalFailed(withdrawalId: number, reason?: string) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `SELECT withdrawal_id, miner_id, amount, status
       FROM withdrawals
       WHERE withdrawal_id = $1
       FOR UPDATE`,
      [withdrawalId]
    );

    const withdrawal = res.rows[0] as {
      withdrawal_id: number;
      miner_id: number;
      amount: number | string;
      status: string;
    } | undefined;

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'failed') {
      await client.query(`UPDATE miners SET pending_balance = pending_balance + $1 WHERE miner_id = $2`, [
        Number(withdrawal.amount),
        withdrawal.miner_id
      ]);
    }

    await client.query(
      `UPDATE withdrawals
       SET status = 'failed',
           error_message = $2
       WHERE withdrawal_id = $1`,
      [withdrawalId, reason ?? 'Marked failed by admin']
    );
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackErr) {
      // noop
    }
    throw err;
  } finally {
    client.release();
  }
}
