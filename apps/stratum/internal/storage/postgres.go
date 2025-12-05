// Package storage provides PostgreSQL client for persistent data.
package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/viddhana/pool/internal/config"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// PostgresClient wraps PostgreSQL operations for the stratum server.
type PostgresClient struct {
	pool   *pgxpool.Pool
	cfg    config.PostgresConfig
	logger *zap.Logger
}

// Worker represents a worker record in the database.
type Worker struct {
	ID          int64
	Name        string
	Address     string
	FirstSeenAt time.Time
	LastSeenAt  time.Time
}

// Share represents a share record in the database.
type Share struct {
	ID           int64
	WorkerName   string
	JobID        string
	Difficulty   float64
	ShareDiff    float64
	Valid        bool
	IsBlock      bool
	BlockHash    string
	RejectReason string
	IPAddress    string
	SubmittedAt  time.Time
}

// Block represents a block record in the database.
type Block struct {
	ID         int64
	Hash       string
	Height     int64
	WorkerName string
	Difficulty float64
	FoundAt    time.Time
	Confirmed  bool
}

// NewPostgresClient creates a new PostgreSQL client.
func NewPostgresClient(ctx context.Context, cfg config.PostgresConfig, logger *zap.Logger) (*PostgresClient, error) {
	connString := fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s pool_max_conns=%d pool_min_conns=%d",
		cfg.Host, cfg.Port, cfg.Database, cfg.User, cfg.Password,
		cfg.MaxConnections, cfg.MinConnections,
	)

	poolConfig, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse connection string: %w", err)
	}

	poolConfig.ConnConfig.ConnectTimeout = cfg.ConnectTimeout

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	logger.Info("Connected to PostgreSQL",
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
		zap.String("database", cfg.Database),
	)

	client := &PostgresClient{
		pool:   pool,
		cfg:    cfg,
		logger: logger.Named("postgres"),
	}

	// Initialize schema
	if err := client.initSchema(ctx); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return client, nil
}

// Close closes the database connection pool.
func (p *PostgresClient) Close() {
	p.pool.Close()
}

// initSchema creates the necessary database tables if they don't exist.
func (p *PostgresClient) initSchema(ctx context.Context) error {
	schema := `
		CREATE TABLE IF NOT EXISTS stratum_workers (
			id BIGSERIAL PRIMARY KEY,
			name VARCHAR(255) UNIQUE NOT NULL,
			address VARCHAR(255),
			first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_stratum_workers_name ON stratum_workers(name);
		CREATE INDEX IF NOT EXISTS idx_stratum_workers_last_seen ON stratum_workers(last_seen_at);

		CREATE TABLE IF NOT EXISTS stratum_shares (
			id BIGSERIAL PRIMARY KEY,
			worker_name VARCHAR(255) NOT NULL,
			job_id VARCHAR(64) NOT NULL,
			difficulty DOUBLE PRECISION NOT NULL,
			share_diff DOUBLE PRECISION NOT NULL DEFAULT 0,
			valid BOOLEAN NOT NULL DEFAULT FALSE,
			is_block BOOLEAN NOT NULL DEFAULT FALSE,
			block_hash VARCHAR(64),
			reject_reason VARCHAR(255),
			ip_address VARCHAR(45),
			submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_stratum_shares_worker ON stratum_shares(worker_name);
		CREATE INDEX IF NOT EXISTS idx_stratum_shares_submitted ON stratum_shares(submitted_at);
		CREATE INDEX IF NOT EXISTS idx_stratum_shares_valid ON stratum_shares(valid);
		CREATE INDEX IF NOT EXISTS idx_stratum_shares_block ON stratum_shares(is_block) WHERE is_block = TRUE;

		CREATE TABLE IF NOT EXISTS stratum_blocks (
			id BIGSERIAL PRIMARY KEY,
			hash VARCHAR(64) UNIQUE NOT NULL,
			height BIGINT NOT NULL,
			worker_name VARCHAR(255) NOT NULL,
			difficulty DOUBLE PRECISION NOT NULL,
			found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			confirmed BOOLEAN NOT NULL DEFAULT FALSE,
			confirmed_at TIMESTAMPTZ,
			orphaned BOOLEAN NOT NULL DEFAULT FALSE,
			reward BIGINT
		);

		CREATE INDEX IF NOT EXISTS idx_stratum_blocks_height ON stratum_blocks(height);
		CREATE INDEX IF NOT EXISTS idx_stratum_blocks_worker ON stratum_blocks(worker_name);
		CREATE INDEX IF NOT EXISTS idx_stratum_blocks_confirmed ON stratum_blocks(confirmed);

		CREATE TABLE IF NOT EXISTS stratum_payouts (
			id BIGSERIAL PRIMARY KEY,
			worker_name VARCHAR(255) NOT NULL,
			amount BIGINT NOT NULL,
			tx_hash VARCHAR(64),
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMPTZ
		);

		CREATE INDEX IF NOT EXISTS idx_stratum_payouts_worker ON stratum_payouts(worker_name);
		CREATE INDEX IF NOT EXISTS idx_stratum_payouts_status ON stratum_payouts(status);
	`

	_, err := p.pool.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	return nil
}

// UpsertWorker inserts or updates a worker record.
func (p *PostgresClient) UpsertWorker(ctx context.Context, worker *Worker) error {
	query := `
		INSERT INTO stratum_workers (name, address, first_seen_at, last_seen_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (name) DO UPDATE SET
			address = EXCLUDED.address,
			last_seen_at = EXCLUDED.last_seen_at,
			updated_at = NOW()
	`

	_, err := p.pool.Exec(ctx, query,
		worker.Name, worker.Address, worker.FirstSeenAt, worker.LastSeenAt)
	if err != nil {
		return fmt.Errorf("failed to upsert worker: %w", err)
	}

	return nil
}

// UpdateWorkerLastSeen updates the last seen timestamp for a worker.
func (p *PostgresClient) UpdateWorkerLastSeen(ctx context.Context, name string, lastSeen time.Time) error {
	query := `UPDATE stratum_workers SET last_seen_at = $2, updated_at = NOW() WHERE name = $1`

	_, err := p.pool.Exec(ctx, query, name, lastSeen)
	if err != nil {
		return fmt.Errorf("failed to update worker last seen: %w", err)
	}

	return nil
}

// GetWorker retrieves a worker by name.
func (p *PostgresClient) GetWorker(ctx context.Context, name string) (*Worker, error) {
	query := `SELECT id, name, address, first_seen_at, last_seen_at FROM stratum_workers WHERE name = $1`

	var worker Worker
	err := p.pool.QueryRow(ctx, query, name).Scan(
		&worker.ID, &worker.Name, &worker.Address, &worker.FirstSeenAt, &worker.LastSeenAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get worker: %w", err)
	}

	return &worker, nil
}

// InsertShare inserts a share record.
func (p *PostgresClient) InsertShare(ctx context.Context, share *Share) error {
	query := `
		INSERT INTO stratum_shares (worker_name, job_id, difficulty, share_diff, valid, is_block, block_hash, reject_reason, ip_address, submitted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := p.pool.Exec(ctx, query,
		share.WorkerName, share.JobID, share.Difficulty, share.ShareDiff,
		share.Valid, share.IsBlock, share.BlockHash, share.RejectReason,
		share.IPAddress, share.SubmittedAt)
	if err != nil {
		return fmt.Errorf("failed to insert share: %w", err)
	}

	return nil
}

// GetWorkerShareStats retrieves share statistics for a worker.
func (p *PostgresClient) GetWorkerShareStats(ctx context.Context, workerName string, since time.Time) (valid, invalid, stale int64, err error) {
	query := `
		SELECT 
			COUNT(*) FILTER (WHERE valid = TRUE) as valid_shares,
			COUNT(*) FILTER (WHERE valid = FALSE AND reject_reason NOT LIKE 'Stale%') as invalid_shares,
			COUNT(*) FILTER (WHERE valid = FALSE AND reject_reason LIKE 'Stale%') as stale_shares
		FROM stratum_shares 
		WHERE worker_name = $1 AND submitted_at >= $2
	`

	err = p.pool.QueryRow(ctx, query, workerName, since).Scan(&valid, &invalid, &stale)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to get share stats: %w", err)
	}

	return valid, invalid, stale, nil
}

// InsertBlock inserts a block record.
func (p *PostgresClient) InsertBlock(ctx context.Context, block *Block) error {
	query := `
		INSERT INTO stratum_blocks (hash, height, worker_name, difficulty, found_at, confirmed)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := p.pool.Exec(ctx, query,
		block.Hash, block.Height, block.WorkerName, block.Difficulty,
		block.FoundAt, block.Confirmed)
	if err != nil {
		return fmt.Errorf("failed to insert block: %w", err)
	}

	return nil
}

// ConfirmBlock marks a block as confirmed.
func (p *PostgresClient) ConfirmBlock(ctx context.Context, hash string, reward int64) error {
	query := `
		UPDATE stratum_blocks 
		SET confirmed = TRUE, confirmed_at = NOW(), reward = $2
		WHERE hash = $1
	`

	_, err := p.pool.Exec(ctx, query, hash, reward)
	if err != nil {
		return fmt.Errorf("failed to confirm block: %w", err)
	}

	return nil
}

// OrphanBlock marks a block as orphaned.
func (p *PostgresClient) OrphanBlock(ctx context.Context, hash string) error {
	query := `UPDATE stratum_blocks SET orphaned = TRUE WHERE hash = $1`

	_, err := p.pool.Exec(ctx, query, hash)
	if err != nil {
		return fmt.Errorf("failed to orphan block: %w", err)
	}

	return nil
}

// GetRecentBlocks retrieves recent blocks.
func (p *PostgresClient) GetRecentBlocks(ctx context.Context, limit int) ([]*Block, error) {
	query := `
		SELECT id, hash, height, worker_name, difficulty, found_at, confirmed
		FROM stratum_blocks
		ORDER BY found_at DESC
		LIMIT $1
	`

	rows, err := p.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent blocks: %w", err)
	}
	defer rows.Close()

	var blocks []*Block
	for rows.Next() {
		var block Block
		if err := rows.Scan(&block.ID, &block.Hash, &block.Height, &block.WorkerName,
			&block.Difficulty, &block.FoundAt, &block.Confirmed); err != nil {
			return nil, fmt.Errorf("failed to scan block: %w", err)
		}
		blocks = append(blocks, &block)
	}

	return blocks, nil
}

// GetPoolStats retrieves overall pool statistics.
func (p *PostgresClient) GetPoolStats(ctx context.Context) (workers, blocks int64, err error) {
	query := `
		SELECT 
			(SELECT COUNT(*) FROM stratum_workers WHERE last_seen_at >= NOW() - INTERVAL '5 minutes') as active_workers,
			(SELECT COUNT(*) FROM stratum_blocks WHERE confirmed = TRUE) as confirmed_blocks
	`

	err = p.pool.QueryRow(ctx, query).Scan(&workers, &blocks)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get pool stats: %w", err)
	}

	return workers, blocks, nil
}

// CleanupOldShares removes share records older than the specified duration.
func (p *PostgresClient) CleanupOldShares(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	query := `DELETE FROM stratum_shares WHERE submitted_at < $1`

	result, err := p.pool.Exec(ctx, query, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old shares: %w", err)
	}

	return result.RowsAffected(), nil
}
