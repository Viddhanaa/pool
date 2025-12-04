-- BTCD Pool v1 Simplified Migration
-- Migration: 007_btcd_pool_v1.sql
-- Description: Minimal tables for BTCD Pool v1 - user positions, withdrawals, and config
-- Reuses existing `miners` table for user data (wallet_address, total_earned, pending_balance)

-- ============================================================================
-- Pool Positions: Track user stakes in pools
-- ============================================================================
CREATE TABLE IF NOT EXISTS pool_positions (
  position_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES miners(miner_id) ON DELETE CASCADE,
  pool_id VARCHAR(64) NOT NULL DEFAULT 'btcd-main-pool',
  staked_amount NUMERIC(38,18) NOT NULL DEFAULT 0,  -- BTCD deposited
  shares NUMERIC(38,18) NOT NULL DEFAULT 0,         -- shares owned (for future vault model)
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pool_id)
);

CREATE INDEX pool_positions_user_idx ON pool_positions(user_id);
CREATE INDEX pool_positions_pool_idx ON pool_positions(pool_id);
CREATE INDEX pool_positions_updated_idx ON pool_positions(last_updated);

COMMENT ON TABLE pool_positions IS 'User stake tracking for BTCD Pool v1';
COMMENT ON COLUMN pool_positions.staked_amount IS 'Total BTCD deposited by user';
COMMENT ON COLUMN pool_positions.shares IS 'Shares owned (for future vault model)';

-- ============================================================================
-- Pool Withdrawals: Track withdrawal requests from pool
-- ============================================================================
-- Note: This is separate from the existing `withdrawals` table which tracks
-- mining reward withdrawals. Pool withdrawals need additional fields like pool_id.
CREATE TABLE IF NOT EXISTS pool_withdrawals (
  withdrawal_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES miners(miner_id) ON DELETE CASCADE,
  pool_id VARCHAR(64) NOT NULL DEFAULT 'btcd-main-pool',
  amount NUMERIC(38,18) NOT NULL,                   -- BTCD amount to withdraw
  wallet_address VARCHAR(66) NOT NULL,              -- recipient address
  status VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending | processing | completed | failed
  tx_hash VARCHAR(66),                              -- on-chain transaction hash
  error_message TEXT,                               -- error details if failed
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX pool_withdrawals_user_idx ON pool_withdrawals(user_id);
CREATE INDEX pool_withdrawals_pool_idx ON pool_withdrawals(pool_id);
CREATE INDEX pool_withdrawals_status_idx ON pool_withdrawals(status);
CREATE INDEX pool_withdrawals_requested_idx ON pool_withdrawals(requested_at);

COMMENT ON TABLE pool_withdrawals IS 'Pool withdrawal request tracking for BTCD Pool v1';
COMMENT ON COLUMN pool_withdrawals.status IS 'pending: queued | processing: being sent | completed: success | failed: error';

-- ============================================================================
-- Pool Config: Pool configuration and settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS pool_config (
  pool_id VARCHAR(64) PRIMARY KEY,
  deposit_asset VARCHAR(64) NOT NULL DEFAULT 'BTCD',
  reward_asset VARCHAR(64) NOT NULL DEFAULT 'BTCD',
  min_withdraw_threshold NUMERIC(38,18) NOT NULL DEFAULT 100,  -- 100 BTCD minimum
  reward_per_minute NUMERIC(38,18) NOT NULL DEFAULT 24,        -- 24 BTCD per minute (example)
  tvl NUMERIC(38,18) NOT NULL DEFAULT 0,                       -- total value locked
  status VARCHAR(20) NOT NULL DEFAULT 'active',                -- active | paused
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (status IN ('active', 'paused'))
);

CREATE INDEX pool_config_status_idx ON pool_config(status);
CREATE INDEX pool_config_updated_idx ON pool_config(updated_at);

COMMENT ON TABLE pool_config IS 'Pool configuration for BTCD Pool v1';
COMMENT ON COLUMN pool_config.reward_per_minute IS 'Total BTCD rewards distributed per minute across all users';
COMMENT ON COLUMN pool_config.tvl IS 'Total value locked in the pool (sum of all staked_amount)';

-- ============================================================================
-- Seed Data: Default config for btcd-main-pool
-- ============================================================================
INSERT INTO pool_config (
  pool_id,
  deposit_asset,
  reward_asset,
  min_withdraw_threshold,
  reward_per_minute,
  tvl,
  status
) VALUES (
  'btcd-main-pool',
  'BTCD',
  'BTCD',
  100,          -- 100 BTCD minimum withdrawal
  24,           -- 24 BTCD per minute (adjustable via config)
  0,            -- initial TVL
  'active'
) ON CONFLICT (pool_id) DO NOTHING;

-- ============================================================================
-- Helper Function: Update TVL on position changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_pool_tvl()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate TVL for the affected pool
  UPDATE pool_config
  SET 
    tvl = (
      SELECT COALESCE(SUM(staked_amount), 0)
      FROM pool_positions
      WHERE pool_id = NEW.pool_id
    ),
    updated_at = NOW()
  WHERE pool_id = NEW.pool_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update TVL when positions change
CREATE TRIGGER trg_update_pool_tvl
AFTER INSERT OR UPDATE OR DELETE ON pool_positions
FOR EACH ROW
EXECUTE FUNCTION update_pool_tvl();

COMMENT ON FUNCTION update_pool_tvl IS 'Auto-update pool TVL when positions change';
