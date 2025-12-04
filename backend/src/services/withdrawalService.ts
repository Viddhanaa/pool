import { getClient, query } from '../db/postgres';
import { log } from '../lib/logger';
import { getConfig } from './configService';
import { transferViddhana } from './blockchain';

export async function requestWithdrawal(minerId: number, amount: number, idempotencyKey?: string) {
  const cfg = await getConfig();
  if (amount < cfg.minWithdrawalThreshold) {
    throw new Error('Below minimum threshold');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const minerRes = await client.query(
      `SELECT pending_balance, wallet_address FROM miners WHERE miner_id = $1 FOR UPDATE`,
      [minerId]
    );

    const miner = minerRes.rows[0] as { pending_balance: string; wallet_address: string } | undefined;
    if (!miner) throw new Error('Miner not found');

    const pendingBalance = Number(miner.pending_balance);
    if (amount > pendingBalance) {
      throw new Error('Insufficient balance');
    }

    if (cfg.dailyWithdrawalLimit) {
      const dailyRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_today
         FROM withdrawals
         WHERE miner_id = $1
           AND requested_at >= date_trunc('day', NOW())
           AND status IN ('pending','processing','completed')`,
        [minerId]
      );
      const totalToday = Number((dailyRes.rows[0] as { total_today: string } | undefined)?.total_today ?? 0);
      if (totalToday + amount > cfg.dailyWithdrawalLimit) {
        throw new Error('Daily limit exceeded');
      }
    }

    const updateRes = await client.query(
      `UPDATE miners 
       SET pending_balance = pending_balance - $1 
       WHERE miner_id = $2 
         AND pending_balance >= $1
       RETURNING pending_balance`,
      [amount, minerId]
    );

    if (updateRes.rows.length === 0) {
      throw new Error('Insufficient balance (concurrent update detected)');
    }

    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT withdrawal_id FROM withdrawals WHERE miner_id = $1 AND idempotency_key = $2`,
        [minerId, idempotencyKey]
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return (existing.rows[0] as { withdrawal_id: number }).withdrawal_id;
      }
    }

    const withdrawal = await client.query(
      `INSERT INTO withdrawals (miner_id, amount, wallet_address, status, idempotency_key)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING withdrawal_id`,
      [minerId, amount, miner.wallet_address, idempotencyKey ?? null]
    );

    await client.query('COMMIT');
    return (withdrawal.rows[0] as { withdrawal_id: number }).withdrawal_id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function processWithdrawal(withdrawalId: number) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `SELECT withdrawal_id, miner_id, amount, wallet_address, status
       FROM withdrawals
       WHERE withdrawal_id = $1
       FOR UPDATE`,
      [withdrawalId]
    );

    const withdrawal = res.rows[0] as {
      withdrawal_id: number;
      miner_id: number;
      amount: number;
      wallet_address: string;
      status: string;
    } | undefined;
    if (!withdrawal) {
      await client.query('ROLLBACK');
      return;
    }

    if (withdrawal.status === 'completed') {
      await client.query('COMMIT');
      return;
    }

    await client.query(`UPDATE withdrawals SET status = 'processing' WHERE withdrawal_id = $1`, [withdrawalId]);

    try {
      const txHash = await transferViddhana(withdrawal.wallet_address, withdrawal.amount);
      await client.query(
        `UPDATE withdrawals
         SET status = 'completed', tx_hash = $1, completed_at = NOW()
         WHERE withdrawal_id = $2`,
        [txHash, withdrawalId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query(
        `UPDATE withdrawals
         SET status = 'failed', error_message = $1
         WHERE withdrawal_id = $2`,
        [String(err), withdrawalId]
      );
      await client.query(
        `UPDATE miners SET pending_balance = pending_balance + $1 WHERE miner_id = $2`,
        [withdrawal.amount, withdrawal.miner_id]
      );
      await client.query('COMMIT');
      log.error('withdrawal failed', err);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('withdrawal transaction failed', err);
  } finally {
    client.release();
  }
}

export async function listWithdrawals(
  minerId: number,
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  return query(
    `SELECT withdrawal_id, amount, status, tx_hash, requested_at
     FROM withdrawals
     WHERE miner_id = $1
     ORDER BY requested_at DESC
     LIMIT $2 OFFSET $3`,
    [minerId, limit, offset]
  );
}
