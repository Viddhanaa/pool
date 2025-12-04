-- Optional idempotency support for withdrawals
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_miner_idempotency_idx
  ON withdrawals(miner_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
