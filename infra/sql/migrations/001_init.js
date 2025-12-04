/* eslint-disable @typescript-eslint/no-var-requires */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('miners', {
    miner_id: 'id',
    wallet_address: { type: 'varchar(255)', notNull: true, unique: true },
    device_type: { type: 'varchar(64)' },
    hashrate: { type: 'numeric(30,6)', notNull: true },
    pending_balance: { type: 'numeric(38,18)', notNull: true, default: 0 },
    total_earned: { type: 'numeric(38,18)', notNull: true, default: 0 },
    last_ping_time: { type: 'timestamptz' },
    status: { type: 'varchar(16)', notNull: true, default: 'offline' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS mining_sessions (
      session_id SERIAL,
      miner_id integer NOT NULL REFERENCES miners ON DELETE CASCADE,
      start_minute timestamptz NOT NULL,
      hashrate_snapshot numeric(30,6) NOT NULL,
      reward_amount numeric(38,18) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      expires_at timestamptz
      , PRIMARY KEY (session_id, start_minute)
    ) PARTITION BY RANGE (start_minute);
  `);
  pgm.addConstraint('mining_sessions', 'mining_sessions_miner_minute_unique', {
    unique: ['miner_id', 'start_minute']
  });

  pgm.createTable('withdrawals', {
    withdrawal_id: 'id',
    miner_id: { type: 'integer', notNull: true, references: 'miners', onDelete: 'CASCADE' },
    amount: { type: 'numeric(38,18)', notNull: true },
    wallet_address: { type: 'varchar(255)', notNull: true },
    status: { type: 'varchar(16)', notNull: true, default: 'pending' },
    tx_hash: { type: 'varchar(255)' },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    completed_at: { type: 'timestamptz' },
    error_message: { type: 'text' }
  });

  pgm.createTable('ping_logs', {
    ping_id: 'id',
    miner_id: { type: 'integer', notNull: true, references: 'miners', onDelete: 'CASCADE' },
    timestamp: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    ip_address: { type: 'inet' },
    expires_at: { type: 'timestamptz', notNull: true, default: pgm.func("NOW() + INTERVAL '1 hour'") }
  });

  pgm.createTable('system_config', {
    config_key: { type: 'varchar(128)', primaryKey: true },
    config_value: { type: 'jsonb', notNull: true },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });

  pgm.createTable('hashrate_audit', {
    audit_id: 'id',
    miner_id: { type: 'integer', notNull: true, references: 'miners', onDelete: 'CASCADE' },
    old_hashrate: { type: 'numeric(30,6)' },
    new_hashrate: { type: 'numeric(30,6)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });

  pgm.createIndex('miners', 'wallet_address');
  pgm.createIndex('mining_sessions', ['miner_id', 'start_minute']);
  pgm.createIndex('withdrawals', 'miner_id');
  pgm.createIndex('withdrawals', 'status');
  pgm.createIndex('ping_logs', 'miner_id');
  pgm.createIndex('ping_logs', 'timestamp');

  // Partition management functions can be added later; base table is partitioned.
};

exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS trg_mining_sessions_partition ON mining_sessions;');
  pgm.sql('DROP FUNCTION IF EXISTS trg_ensure_mining_session_partition();');
  pgm.sql('DROP FUNCTION IF EXISTS ensure_mining_session_partition(timestamptz);');
  pgm.dropTable('hashrate_audit');
  pgm.dropTable('ping_logs');
  pgm.dropTable('withdrawals');
  pgm.dropTable('mining_sessions', { ifExists: true, cascade: true });
  pgm.dropTable('system_config');
  pgm.dropTable('miners');
};
