-- Database Optimization Queries
-- Run this after analyzing performance issues

-- 1. Add missing indexes for common queries
-- (Check if these already exist first)

-- Index for miner stats lookup
CREATE INDEX IF NOT EXISTS idx_miners_wallet_address 
ON miners(wallet_address);

-- Index for ping lookups by miner_id
CREATE INDEX IF NOT EXISTS idx_ping_history_miner_id_timestamp 
ON ping_history(miner_id, timestamp DESC);

-- Index for earnings history
CREATE INDEX IF NOT EXISTS idx_earnings_history_miner_id_date 
ON earnings_history(miner_id, date DESC);

-- Index for withdrawal queue status
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created_at 
ON withdrawals(status, created_at);

-- Index for active sessions lookup
CREATE INDEX IF NOT EXISTS idx_ping_history_miner_id_active 
ON ping_history(miner_id, timestamp)
WHERE timestamp > NOW() - INTERVAL '10 minutes';

-- 2. Analyze tables to update statistics
ANALYZE miners;
ANALYZE ping_history;
ANALYZE earnings_history;
ANALYZE withdrawals;

-- 3. Vacuum to reclaim space
VACUUM ANALYZE miners;
VACUUM ANALYZE ping_history;
VACUUM ANALYZE earnings_history;
VACUUM ANALYZE withdrawals;

-- 4. Check for missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;

-- 5. Check for unused indexes (candidates for removal)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 6. Connection pool recommendations
SELECT 
  max_conn,
  used,
  res_for_super,
  max_conn - used - res_for_super AS available,
  ROUND(100.0 * used / max_conn, 2) AS percent_used
FROM (
  SELECT 
    setting::int AS max_conn,
    (SELECT count(*) FROM pg_stat_activity) AS used,
    setting::int AS res_for_super
  FROM pg_settings
  WHERE name IN ('max_connections', 'superuser_reserved_connections')
) AS conn_stats;

-- 7. Slow query log settings (enable if needed)
-- SHOW log_min_duration_statement;
-- ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries > 100ms
-- SELECT pg_reload_conf();

-- 8. Auto-vacuum settings check
SELECT 
  name,
  setting,
  unit,
  short_desc
FROM pg_settings
WHERE name LIKE '%autovacuum%'
  OR name LIKE '%vacuum%'
ORDER BY name;

-- 9. Table bloat check
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 10. Cache hit ratio (should be > 99%)
SELECT
  'cache hit rate' AS metric,
  ROUND(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) AS percentage
FROM pg_stat_database;

-- Recommendations based on common issues:

-- If cache hit ratio < 99%:
--   Increase shared_buffers in postgresql.conf
--   ALTER SYSTEM SET shared_buffers = '512MB';

-- If many sequential scans on large tables:
--   Add appropriate indexes

-- If high lock wait times:
--   Review transaction isolation levels
--   Optimize long-running queries

-- If connection pool exhausted:
--   Increase max_connections
--   Use connection pooler (PgBouncer)
