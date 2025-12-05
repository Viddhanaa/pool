// Package mining implements share validation and block submission.
package mining

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/viddhana/pool/internal/config"
	"github.com/viddhana/pool/internal/protocol"
	"github.com/viddhana/pool/internal/storage"
	"github.com/viddhana/pool/pkg/crypto"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
)

// Prometheus metrics
var (
	sharesTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "stratum_shares_total",
		Help: "Total number of shares submitted",
	}, []string{"status"})

	shareProcessingTime = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "stratum_share_processing_seconds",
		Help:    "Share processing time in seconds",
		Buckets: prometheus.ExponentialBuckets(0.0001, 2, 10),
	})

	blocksFound = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "stratum_blocks_found_total",
		Help: "Total number of blocks found",
	})
)

func init() {
	prometheus.MustRegister(sharesTotal)
	prometheus.MustRegister(shareProcessingTime)
	prometheus.MustRegister(blocksFound)
}

// Share represents a submitted share from a worker.
type Share struct {
	WorkerName  string
	JobID       string
	Extranonce1 string
	Extranonce2 string
	Ntime       string
	Nonce       string
	Difficulty  float64
	SubmittedAt time.Time
	IPAddress   string
}

// ShareResult represents the result of share validation.
type ShareResult struct {
	Valid        bool
	BlockHash    string
	IsBlock      bool
	RejectReason string
	ShareDiff    float64
}

// ShareValidator validates submitted shares.
type ShareValidator struct {
	cfg        config.MiningConfig
	logger     *zap.Logger
	redis      *storage.RedisClient
	postgres   *storage.PostgresClient
	jobManager *JobManager
	mu         sync.RWMutex
}

// NewShareValidator creates a new share validator.
func NewShareValidator(cfg config.MiningConfig, logger *zap.Logger, redis *storage.RedisClient, postgres *storage.PostgresClient, jm *JobManager) *ShareValidator {
	return &ShareValidator{
		cfg:        cfg,
		logger:     logger.Named("share"),
		redis:      redis,
		postgres:   postgres,
		jobManager: jm,
	}
}

// Validate checks if a share is valid and meets difficulty requirements.
func (v *ShareValidator) Validate(ctx context.Context, share *Share) (*ShareResult, error) {
	startTime := time.Now()
	defer func() {
		shareProcessingTime.Observe(time.Since(startTime).Seconds())
	}()

	result := &ShareResult{}

	// Get the job
	job := v.jobManager.GetJob(share.JobID)
	if job == nil {
		result.RejectReason = "Job not found"
		sharesTotal.WithLabelValues("stale").Inc()
		return result, nil
	}

	// Check if job is stale
	if v.jobManager.IsJobStale(share.JobID) {
		result.RejectReason = "Stale job"
		sharesTotal.WithLabelValues("stale").Inc()
		return result, nil
	}

	// Check for duplicate share
	isDuplicate, err := v.checkDuplicate(ctx, share)
	if err != nil {
		return nil, fmt.Errorf("duplicate check failed: %w", err)
	}
	if isDuplicate {
		result.RejectReason = "Duplicate share"
		sharesTotal.WithLabelValues("duplicate").Inc()
		return result, nil
	}

	// Validate ntime
	if !v.validateNtime(share.Ntime, job) {
		result.RejectReason = "Invalid ntime"
		sharesTotal.WithLabelValues("invalid").Inc()
		return result, nil
	}

	// Build the block header and calculate hash
	header, err := v.buildBlockHeader(share, job)
	if err != nil {
		result.RejectReason = "Invalid share data"
		sharesTotal.WithLabelValues("invalid").Inc()
		return result, nil
	}

	// Calculate block hash (double SHA256)
	hash := crypto.DoubleSHA256(header)
	result.BlockHash = hex.EncodeToString(crypto.ReverseBytes(hash))

	// Calculate share difficulty
	shareDiff := protocol.ShareDifficulty(hash)
	result.ShareDiff = shareDiff

	// Check if share meets worker difficulty
	if shareDiff < share.Difficulty {
		result.RejectReason = fmt.Sprintf("Low difficulty share: %.4f < %.4f", shareDiff, share.Difficulty)
		sharesTotal.WithLabelValues("low_diff").Inc()
		return result, nil
	}

	// Share is valid
	result.Valid = true
	sharesTotal.WithLabelValues("valid").Inc()

	// Check if share is a block
	networkDiff := job.NetworkDifficulty
	if shareDiff >= networkDiff {
		result.IsBlock = true
		blocksFound.Inc()

		v.logger.Info("Block found!",
			zap.String("hash", result.BlockHash),
			zap.String("worker", share.WorkerName),
			zap.Float64("share_diff", shareDiff),
			zap.Float64("network_diff", networkDiff),
		)

		// Submit block to node
		go v.submitBlock(ctx, share, job, header)
	}

	// Log share to database
	go v.logShare(ctx, share, result)

	return result, nil
}

// checkDuplicate checks if this share has already been submitted.
func (v *ShareValidator) checkDuplicate(ctx context.Context, share *Share) (bool, error) {
	// Create unique share identifier
	shareKey := fmt.Sprintf("%s:%s:%s:%s",
		share.JobID,
		share.Extranonce2,
		share.Ntime,
		share.Nonce,
	)

	// Use Redis to check and set
	return v.redis.CheckDuplicateShare(ctx, shareKey)
}

// validateNtime checks if the ntime is within acceptable range.
func (v *ShareValidator) validateNtime(ntime string, job *Job) bool {
	// Parse ntime
	ntimeBytes, err := hex.DecodeString(ntime)
	if err != nil || len(ntimeBytes) != 4 {
		return false
	}

	// Convert to uint32 (big endian)
	shareTime := uint32(ntimeBytes[0])<<24 | uint32(ntimeBytes[1])<<16 |
		uint32(ntimeBytes[2])<<8 | uint32(ntimeBytes[3])

	jobTime := job.NTimeValue

	// Allow +/- 10 minutes from job time
	minTime := jobTime - 600
	maxTime := jobTime + 600

	return shareTime >= minTime && shareTime <= maxTime
}

// buildBlockHeader constructs the 80-byte block header from share data.
func (v *ShareValidator) buildBlockHeader(share *Share, job *Job) ([]byte, error) {
	// Decode components
	version, err := hex.DecodeString(job.Version)
	if err != nil {
		return nil, fmt.Errorf("invalid version: %w", err)
	}

	prevHash, err := hex.DecodeString(job.PrevBlockHash)
	if err != nil {
		return nil, fmt.Errorf("invalid prevhash: %w", err)
	}

	// Build coinbase transaction
	coinbase1, err := hex.DecodeString(job.Coinbase1)
	if err != nil {
		return nil, fmt.Errorf("invalid coinbase1: %w", err)
	}

	extranonce1, err := hex.DecodeString(share.Extranonce1)
	if err != nil {
		return nil, fmt.Errorf("invalid extranonce1: %w", err)
	}

	extranonce2, err := hex.DecodeString(share.Extranonce2)
	if err != nil {
		return nil, fmt.Errorf("invalid extranonce2: %w", err)
	}

	coinbase2, err := hex.DecodeString(job.Coinbase2)
	if err != nil {
		return nil, fmt.Errorf("invalid coinbase2: %w", err)
	}

	// Construct coinbase: coinbase1 + extranonce1 + extranonce2 + coinbase2
	coinbase := make([]byte, 0, len(coinbase1)+len(extranonce1)+len(extranonce2)+len(coinbase2))
	coinbase = append(coinbase, coinbase1...)
	coinbase = append(coinbase, extranonce1...)
	coinbase = append(coinbase, extranonce2...)
	coinbase = append(coinbase, coinbase2...)

	// Hash coinbase
	coinbaseHash := crypto.DoubleSHA256(coinbase)

	// Calculate merkle root
	merkleRoot := v.calculateMerkleRoot(coinbaseHash, job.MerkleBranches)

	// Parse ntime and nonce
	ntime, err := hex.DecodeString(share.Ntime)
	if err != nil {
		return nil, fmt.Errorf("invalid ntime: %w", err)
	}

	nonce, err := hex.DecodeString(share.Nonce)
	if err != nil {
		return nil, fmt.Errorf("invalid nonce: %w", err)
	}

	nbits, err := hex.DecodeString(job.NBits)
	if err != nil {
		return nil, fmt.Errorf("invalid nbits: %w", err)
	}

	// Build 80-byte header
	// version (4) + prevhash (32) + merkle_root (32) + ntime (4) + nbits (4) + nonce (4)
	header := make([]byte, 80)
	copy(header[0:4], crypto.ReverseBytes(version))
	copy(header[4:36], crypto.ReverseBytes(prevHash))
	copy(header[36:68], merkleRoot)
	copy(header[68:72], ntime)
	copy(header[72:76], nbits)
	copy(header[76:80], nonce)

	return header, nil
}

// calculateMerkleRoot calculates the merkle root from coinbase hash and merkle branches.
func (v *ShareValidator) calculateMerkleRoot(coinbaseHash []byte, branches []string) []byte {
	hash := coinbaseHash

	for _, branch := range branches {
		branchBytes, err := hex.DecodeString(branch)
		if err != nil {
			continue
		}

		// Concatenate and hash
		combined := make([]byte, 64)
		copy(combined[0:32], hash)
		copy(combined[32:64], branchBytes)

		h := sha256.Sum256(combined)
		hash2 := sha256.Sum256(h[:])
		hash = hash2[:]
	}

	return hash
}

// submitBlock submits a found block to the cryptocurrency node.
func (v *ShareValidator) submitBlock(ctx context.Context, share *Share, job *Job, header []byte) {
	// Build full block data
	// In a real implementation, this would construct the full block
	// and submit via RPC to the node

	v.logger.Info("Submitting block to node",
		zap.String("job_id", share.JobID),
		zap.String("worker", share.WorkerName),
	)

	// Record block in database
	if err := v.postgres.InsertBlock(ctx, &storage.Block{
		Hash:       hex.EncodeToString(header),
		Height:     job.Height,
		WorkerName: share.WorkerName,
		Difficulty: job.NetworkDifficulty,
		FoundAt:    time.Now(),
		Confirmed:  false,
	}); err != nil {
		v.logger.Error("Failed to insert block", zap.Error(err))
	}
}

// logShare records a share submission in the database.
func (v *ShareValidator) logShare(ctx context.Context, share *Share, result *ShareResult) {
	dbShare := &storage.Share{
		WorkerName:   share.WorkerName,
		JobID:        share.JobID,
		Difficulty:   share.Difficulty,
		ShareDiff:    result.ShareDiff,
		Valid:        result.Valid,
		IsBlock:      result.IsBlock,
		BlockHash:    result.BlockHash,
		RejectReason: result.RejectReason,
		IPAddress:    share.IPAddress,
		SubmittedAt:  share.SubmittedAt,
	}

	if err := v.postgres.InsertShare(ctx, dbShare); err != nil {
		v.logger.Error("Failed to insert share", zap.Error(err))
	}
}
