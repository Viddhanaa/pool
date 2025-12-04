-- Pool implementation: tables for pool accounting, rewards, oracle, and risk management
-- Migration: 006_pool_implementation.sql

-- Pools table: stores pool state synced from on-chain
CREATE TABLE IF NOT EXISTS pools (
  pool_id VARCHAR(64) PRIMARY KEY,
  asset_address VARCHAR(66) NOT NULL, -- contract address of underlying asset
  total_value_locked NUMERIC(38,18) NOT NULL DEFAULT 0,
  total_shares NUMERIC(38,18) NOT NULL DEFAULT 0,
  exchange_rate NUMERIC(38,18) NOT NULL DEFAULT 1.0, -- underlying per share
  paused BOOLEAN NOT NULL DEFAULT false,
  last_update_block INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pools_updated_at_idx ON pools(updated_at);

-- User pool shares: tracks user shares in each pool
CREATE TABLE IF NOT EXISTS user_pool_shares (
  user_id INTEGER NOT NULL REFERENCES miners(miner_id) ON DELETE CASCADE,
  pool_id VARCHAR(64) NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  shares_owned NUMERIC(38,18) NOT NULL DEFAULT 0,
  last_deposit_time TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, pool_id)
);

CREATE INDEX IF NOT EXISTS user_pool_shares_pool_idx ON user_pool_shares(pool_id);
CREATE INDEX IF NOT EXISTS user_pool_shares_updated_idx ON user_pool_shares(updated_at);

-- Pool reward epochs: snapshot-based reward distribution
CREATE TABLE IF NOT EXISTS pool_reward_epochs (
  epoch_id SERIAL PRIMARY KEY,
  pool_id VARCHAR(64) NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  start_block INTEGER NOT NULL,
  end_block INTEGER NOT NULL,
  total_reward NUMERIC(38,18) NOT NULL,
  snapshot_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pool_reward_epochs_pool_idx ON pool_reward_epochs(pool_id);
CREATE INDEX IF NOT EXISTS pool_reward_epochs_snapshot_idx ON pool_reward_epochs(snapshot_at);

-- Pool reward weights: configuration for per-pool reward allocation
CREATE TABLE IF NOT EXISTS pool_reward_weights (
  pool_id VARCHAR(64) PRIMARY KEY REFERENCES pools(pool_id) ON DELETE CASCADE,
  weight NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 1),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Pool rewards: per-user reward snapshots per epoch
CREATE TABLE IF NOT EXISTS pool_rewards (
  user_id INTEGER NOT NULL REFERENCES miners(miner_id) ON DELETE CASCADE,
  pool_id VARCHAR(64) NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  epoch_id INTEGER NOT NULL REFERENCES pool_reward_epochs(epoch_id) ON DELETE CASCADE,
  shares_snapshot NUMERIC(38,18) NOT NULL,
  reward_amount NUMERIC(38,18) NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMP,
  PRIMARY KEY (user_id, pool_id, epoch_id)
);

CREATE INDEX IF NOT EXISTS pool_rewards_user_claimed_idx ON pool_rewards(user_id, claimed);
CREATE INDEX IF NOT EXISTS pool_rewards_epoch_idx ON pool_rewards(epoch_id);

-- Pool withdrawals: tracking withdrawal requests from pools
CREATE TABLE IF NOT EXISTS pool_withdrawals (
  withdrawal_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES miners(miner_id) ON DELETE CASCADE,
  pool_id VARCHAR(64) NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  shares_amount NUMERIC(38,18) NOT NULL,
  amount NUMERIC(38,18) NOT NULL, -- underlying asset amount
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  tx_hash VARCHAR(66),
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pool_withdrawals_user_idx ON pool_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS pool_withdrawals_pool_idx ON pool_withdrawals(pool_id);
CREATE INDEX IF NOT EXISTS pool_withdrawals_status_idx ON pool_withdrawals(status);

-- Oracle price cache: cached oracle prices with TTL
CREATE TABLE IF NOT EXISTS oracle_price_cache (
  asset VARCHAR(64) PRIMARY KEY,
  price NUMERIC(38,18) NOT NULL,
  decimals INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  source VARCHAR(64) NOT NULL, -- e.g., "chainlink", "custom"
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oracle_price_cache_updated_idx ON oracle_price_cache(updated_at);

-- Oracle alerts: tracking stale/failed oracle reads
CREATE TABLE IF NOT EXISTS oracle_alerts (
  alert_id SERIAL PRIMARY KEY,
  asset VARCHAR(64) NOT NULL,
  oracle_address VARCHAR(66) NOT NULL,
  alert_type VARCHAR(32) NOT NULL, -- "stale", "failure"
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oracle_alerts_asset_idx ON oracle_alerts(asset);
CREATE INDEX IF NOT EXISTS oracle_alerts_created_idx ON oracle_alerts(created_at);

-- Pool risk parameters: risk limits and circuit breaker config
CREATE TABLE IF NOT EXISTS pool_risk_parameters (
  pool_id VARCHAR(64) PRIMARY KEY REFERENCES pools(pool_id) ON DELETE CASCADE,
  max_tvl NUMERIC(38,18) NOT NULL DEFAULT 1000000000, -- max total value locked
  max_daily_withdrawals NUMERIC(38,18) NOT NULL DEFAULT 10000000, -- max daily withdrawals
  max_user_deposit NUMERIC(38,18) NOT NULL DEFAULT 1000000, -- max single user deposit
  circuit_breaker_threshold NUMERIC(10,6) NOT NULL DEFAULT 0.1, -- e.g., 0.1 = 10% drawdown
  emergency_paused BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Circuit breaker status: current circuit breaker state per pool
CREATE TABLE IF NOT EXISTS circuit_breaker_status (
  pool_id VARCHAR(64) PRIMARY KEY REFERENCES pools(pool_id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  triggered_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS circuit_breaker_status_active_idx ON circuit_breaker_status(active);

-- Risk violations: log of risk parameter violations
CREATE TABLE IF NOT EXISTS risk_violations (
  violation_id SERIAL PRIMARY KEY,
  pool_id VARCHAR(64) NOT NULL REFERENCES pools(pool_id) ON DELETE CASCADE,
  violation_type VARCHAR(64) NOT NULL, -- "tvl_cap_exceeded", "daily_withdrawal_limit_exceeded", etc.
  message TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_violations_pool_idx ON risk_violations(pool_id);
CREATE INDEX IF NOT EXISTS risk_violations_timestamp_idx ON risk_violations(timestamp);
CREATE INDEX IF NOT EXISTS risk_violations_type_idx ON risk_violations(violation_type);

-- Comments for documentation
COMMENT ON TABLE pools IS 'Pool state synced from on-chain contracts';
COMMENT ON TABLE user_pool_shares IS 'User shares ownership in each pool';
COMMENT ON TABLE pool_reward_epochs IS 'Epoch-based reward distribution snapshots';
COMMENT ON TABLE pool_reward_weights IS 'Per-pool reward allocation weights';
COMMENT ON TABLE pool_rewards IS 'User reward snapshots per epoch';
COMMENT ON TABLE pool_withdrawals IS 'Pool withdrawal request tracking';
COMMENT ON TABLE oracle_price_cache IS 'Cached oracle prices with TTL';
COMMENT ON TABLE oracle_alerts IS 'Oracle staleness and failure alerts';
COMMENT ON TABLE pool_risk_parameters IS 'Pool risk limits and circuit breaker config';
COMMENT ON TABLE circuit_breaker_status IS 'Current circuit breaker state per pool';
COMMENT ON TABLE risk_violations IS 'Risk parameter violation log';
