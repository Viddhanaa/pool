/* eslint-disable @typescript-eslint/no-var-requires */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create helper to auto-create monthly partitions for mining_sessions
  pgm.sql(`
    CREATE OR REPLACE FUNCTION ensure_mining_session_partition(target_date timestamptz)
    RETURNS void AS $$
    DECLARE
      start_date timestamptz := date_trunc('month', target_date);
      end_date   timestamptz := start_date + INTERVAL '1 month';
      partition_name text := format('mining_sessions_%s', to_char(start_date, 'YYYYMM'));
    BEGIN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF mining_sessions FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
      -- Ensure useful indexes exist on each partition
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (miner_id, start_minute)', partition_name || '_miner_minute_idx', partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (start_minute)', partition_name || '_start_idx', partition_name);
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Seed baseline system config (will not overwrite existing values)
  pgm.sql(`
    INSERT INTO system_config (config_key, config_value, updated_at) VALUES
      ('min_withdrawal_threshold', '100', NOW()),
      ('reward_update_interval_minutes', '5', NOW()),
      ('data_retention_days', '7', NOW()),
      ('ping_timeout_seconds', '120', NOW()),
      ('daily_withdrawal_limit', '0', NOW()),
      ('block_reward', '2', NOW()),
      ('block_time_sec', '5', NOW())
    ON CONFLICT (config_key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS ensure_mining_session_partition(timestamptz);');
};
