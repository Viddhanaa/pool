-- =============================================================================
-- Viddhana Pool - PostgreSQL Initialization Script
-- TimescaleDB with time-series optimizations
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- ENUM Types
-- =============================================================================

CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE worker_status AS ENUM ('online', 'offline', 'stale');
CREATE TYPE share_result AS ENUM ('accepted', 'rejected', 'stale', 'duplicate', 'invalid');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE block_status AS ENUM ('pending', 'confirmed', 'orphaned', 'uncle');

-- =============================================================================
-- Users Table
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    username VARCHAR(64) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    -- Settings
    minimum_payout DECIMAL(36, 18) DEFAULT 0.1,
    notification_email BOOLEAN DEFAULT true,
    notification_threshold DECIMAL(36, 18),
    
    -- Stats cache (updated periodically)
    total_hashrate BIGINT DEFAULT 0,
    total_shares BIGINT DEFAULT 0,
    total_earnings DECIMAL(36, 18) DEFAULT 0,
    pending_balance DECIMAL(36, 18) DEFAULT 0,
    
    -- Metadata
    referral_code VARCHAR(32) UNIQUE,
    referred_by UUID REFERENCES users(id),
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_users_referred_by ON users(referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX idx_users_last_active ON users(last_active_at);

-- =============================================================================
-- Workers Table
-- =============================================================================

CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    
    -- Current state
    status worker_status DEFAULT 'offline',
    current_hashrate BIGINT DEFAULT 0,
    average_hashrate BIGINT DEFAULT 0,
    current_difficulty DOUBLE PRECISION DEFAULT 1,
    
    -- Stats
    total_shares BIGINT DEFAULT 0,
    valid_shares BIGINT DEFAULT 0,
    invalid_shares BIGINT DEFAULT 0,
    stale_shares BIGINT DEFAULT 0,
    
    -- Connection info
    ip_address INET,
    user_agent VARCHAR(255),
    stratum_port INTEGER,
    
    -- Timestamps
    last_share_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for user + worker name
    UNIQUE(user_id, name)
);

-- Indexes for workers
CREATE INDEX idx_workers_user_id ON workers(user_id);
CREATE INDEX idx_workers_status ON workers(status);
CREATE INDEX idx_workers_last_seen ON workers(last_seen_at);
CREATE INDEX idx_workers_user_status ON workers(user_id, status);

-- =============================================================================
-- Shares Table (Time-series with TimescaleDB)
-- =============================================================================

CREATE TABLE shares (
    id BIGSERIAL,
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    user_id UUID NOT NULL,
    worker_id UUID NOT NULL,
    
    -- Share details
    job_id VARCHAR(64) NOT NULL,
    nonce VARCHAR(16) NOT NULL,
    result share_result NOT NULL,
    difficulty DOUBLE PRECISION NOT NULL,
    share_difficulty DOUBLE PRECISION NOT NULL,
    
    -- Block reference (if block found)
    block_height BIGINT,
    block_hash VARCHAR(66),
    
    -- Extra data
    ip_address INET,
    
    PRIMARY KEY (id, time)
);

-- Convert to hypertable
SELECT create_hypertable('shares', 'time', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for shares (TimescaleDB optimized)
CREATE INDEX idx_shares_user_id_time ON shares(user_id, time DESC);
CREATE INDEX idx_shares_worker_id_time ON shares(worker_id, time DESC);
CREATE INDEX idx_shares_result ON shares(result, time DESC);
CREATE INDEX idx_shares_block_hash ON shares(block_hash) WHERE block_hash IS NOT NULL;

-- =============================================================================
-- Hashrate History Table (Time-series with TimescaleDB)
-- =============================================================================

CREATE TABLE hashrate_history (
    time TIMESTAMPTZ NOT NULL,
    
    user_id UUID,
    worker_id UUID,
    
    -- Hashrate values (in H/s)
    hashrate BIGINT NOT NULL,
    average_hashrate BIGINT,
    
    -- Share counts for this period
    valid_shares INTEGER DEFAULT 0,
    invalid_shares INTEGER DEFAULT 0,
    stale_shares INTEGER DEFAULT 0,
    
    -- Difficulty
    current_difficulty DOUBLE PRECISION,
    
    PRIMARY KEY (time, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(worker_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

-- Convert to hypertable
SELECT create_hypertable('hashrate_history', 'time',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Indexes for hashrate_history
CREATE INDEX idx_hashrate_user_id_time ON hashrate_history(user_id, time DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_hashrate_worker_id_time ON hashrate_history(worker_id, time DESC) WHERE worker_id IS NOT NULL;

-- =============================================================================
-- Blocks Table
-- =============================================================================

CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Block info
    block_height BIGINT NOT NULL UNIQUE,
    block_hash VARCHAR(66) NOT NULL UNIQUE,
    parent_hash VARCHAR(66) NOT NULL,
    
    -- Mining info
    miner_user_id UUID REFERENCES users(id),
    miner_worker_id UUID REFERENCES workers(id),
    difficulty DOUBLE PRECISION NOT NULL,
    total_difficulty DECIMAL(78, 0),
    
    -- Rewards
    block_reward DECIMAL(36, 18) NOT NULL,
    uncle_reward DECIMAL(36, 18) DEFAULT 0,
    tx_fees DECIMAL(36, 18) DEFAULT 0,
    total_reward DECIMAL(36, 18) NOT NULL,
    
    -- Status
    status block_status DEFAULT 'pending',
    confirmations INTEGER DEFAULT 0,
    
    -- Pool stats at time of block
    pool_hashrate BIGINT,
    pool_difficulty DOUBLE PRECISION,
    luck_percentage DECIMAL(10, 4),
    
    -- Timestamps
    found_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for blocks
CREATE INDEX idx_blocks_height ON blocks(block_height DESC);
CREATE INDEX idx_blocks_status ON blocks(status);
CREATE INDEX idx_blocks_miner ON blocks(miner_user_id);
CREATE INDEX idx_blocks_found_at ON blocks(found_at DESC);

-- =============================================================================
-- Payouts Table
-- =============================================================================

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Payout details
    amount DECIMAL(36, 18) NOT NULL,
    fee DECIMAL(36, 18) DEFAULT 0,
    net_amount DECIMAL(36, 18) NOT NULL,
    
    -- Transaction info
    tx_hash VARCHAR(66) UNIQUE,
    block_number BIGINT,
    gas_used BIGINT,
    gas_price DECIMAL(36, 18),
    
    -- Status
    status payout_status DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payouts
CREATE INDEX idx_payouts_user_id ON payouts(user_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_tx_hash ON payouts(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX idx_payouts_requested_at ON payouts(requested_at DESC);

-- =============================================================================
-- Pool Stats Table (Time-series with TimescaleDB)
-- =============================================================================

CREATE TABLE pool_stats (
    time TIMESTAMPTZ NOT NULL,
    
    -- Hashrate
    total_hashrate BIGINT NOT NULL,
    average_hashrate BIGINT,
    
    -- Workers
    total_workers INTEGER DEFAULT 0,
    online_workers INTEGER DEFAULT 0,
    
    -- Users
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    
    -- Shares
    valid_shares BIGINT DEFAULT 0,
    invalid_shares BIGINT DEFAULT 0,
    stale_shares BIGINT DEFAULT 0,
    
    -- Blocks
    blocks_found INTEGER DEFAULT 0,
    pending_blocks INTEGER DEFAULT 0,
    
    -- Difficulty
    current_difficulty DOUBLE PRECISION,
    network_difficulty DOUBLE PRECISION,
    
    -- Network info
    network_hashrate BIGINT,
    block_height BIGINT,
    
    PRIMARY KEY (time)
);

-- Convert to hypertable
SELECT create_hypertable('pool_stats', 'time',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Index for pool_stats
CREATE INDEX idx_pool_stats_time ON pool_stats(time DESC);

-- =============================================================================
-- Continuous Aggregates for Performance
-- =============================================================================

-- Hourly hashrate aggregation
CREATE MATERIALIZED VIEW hashrate_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    user_id,
    worker_id,
    AVG(hashrate)::BIGINT AS avg_hashrate,
    MAX(hashrate) AS max_hashrate,
    MIN(hashrate) AS min_hashrate,
    SUM(valid_shares) AS total_valid_shares,
    SUM(invalid_shares) AS total_invalid_shares
FROM hashrate_history
GROUP BY bucket, user_id, worker_id
WITH NO DATA;

-- Daily hashrate aggregation
CREATE MATERIALIZED VIEW hashrate_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    user_id,
    worker_id,
    AVG(hashrate)::BIGINT AS avg_hashrate,
    MAX(hashrate) AS max_hashrate,
    MIN(hashrate) AS min_hashrate,
    SUM(valid_shares) AS total_valid_shares,
    SUM(invalid_shares) AS total_invalid_shares
FROM hashrate_history
GROUP BY bucket, user_id, worker_id
WITH NO DATA;

-- Refresh policies
SELECT add_continuous_aggregate_policy('hashrate_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('hashrate_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- =============================================================================
-- Retention Policies
-- =============================================================================

-- Keep raw shares for 7 days
SELECT add_retention_policy('shares', INTERVAL '7 days', if_not_exists => TRUE);

-- Keep hashrate history for 30 days
SELECT add_retention_policy('hashrate_history', INTERVAL '30 days', if_not_exists => TRUE);

-- Keep pool stats for 90 days
SELECT add_retention_policy('pool_stats', INTERVAL '90 days', if_not_exists => TRUE);

-- =============================================================================
-- Compression Policies
-- =============================================================================

-- Enable compression on shares after 1 day
ALTER TABLE shares SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'user_id, worker_id'
);

SELECT add_compression_policy('shares', INTERVAL '1 day', if_not_exists => TRUE);

-- Enable compression on hashrate_history after 1 day
ALTER TABLE hashrate_history SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'user_id, worker_id'
);

SELECT add_compression_policy('hashrate_history', INTERVAL '1 day', if_not_exists => TRUE);

-- =============================================================================
-- Functions and Triggers
-- =============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workers_updated_at
    BEFORE UPDATE ON workers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at
    BEFORE UPDATE ON blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
    BEFORE UPDATE ON payouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Initial Data
-- =============================================================================

-- Insert initial pool stats record
INSERT INTO pool_stats (time, total_hashrate, average_hashrate, total_workers, online_workers, total_users, active_users)
VALUES (NOW(), 0, 0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Grants (adjust as needed for your setup)
-- =============================================================================

-- Grant usage on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO viddhana;

-- Grant all privileges on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO viddhana;

-- Grant execute on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO viddhana;
