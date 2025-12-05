// Package mining implements job generation and management.
package mining

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/viddhana/pool/internal/config"
	"github.com/viddhana/pool/internal/storage"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
)

// Prometheus metrics
var (
	jobsGenerated = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "stratum_jobs_generated_total",
		Help: "Total number of jobs generated",
	})

	currentBlockHeight = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "stratum_current_block_height",
		Help: "Current block height",
	})
)

func init() {
	prometheus.MustRegister(jobsGenerated)
	prometheus.MustRegister(currentBlockHeight)
}

// Job represents a mining job to be sent to workers.
type Job struct {
	ID                string
	Height            int64
	PrevBlockHash     string
	Coinbase1         string
	Coinbase2         string
	MerkleBranches    []string
	Version           string
	NBits             string
	NTime             string
	NTimeValue        uint32
	CleanJobs         bool
	NetworkDifficulty float64
	CreatedAt         time.Time
}

// JobManager handles job generation and tracking.
type JobManager struct {
	cfg            config.MiningConfig
	logger         *zap.Logger
	redis          *storage.RedisClient

	currentJob     atomic.Value // *Job
	jobs           sync.Map     // map[string]*Job
	jobCounter     uint64
	extranonce1    uint32
	subscribers    []chan *Job
	subscribersMu  sync.RWMutex
	currentHeight  int64

	mu             sync.RWMutex
}

// NewJobManager creates a new job manager.
func NewJobManager(cfg config.MiningConfig, logger *zap.Logger, redis *storage.RedisClient) *JobManager {
	jm := &JobManager{
		cfg:         cfg,
		logger:      logger.Named("job"),
		redis:       redis,
		subscribers: make([]chan *Job, 0),
	}

	// Initialize with a random extranonce1 base
	var seed [4]byte
	rand.Read(seed[:])
	jm.extranonce1 = binary.BigEndian.Uint32(seed[:])

	return jm
}

// GenerateExtranonce1 generates a unique extranonce1 for a connection.
func (jm *JobManager) GenerateExtranonce1() string {
	// Atomically increment and get unique value
	value := atomic.AddUint32(&jm.extranonce1, 1)
	
	// Convert to hex string based on configured size
	buf := make([]byte, jm.cfg.Extranonce1Size)
	for i := 0; i < jm.cfg.Extranonce1Size; i++ {
		buf[i] = byte(value >> (8 * (jm.cfg.Extranonce1Size - 1 - i)))
	}
	
	return hex.EncodeToString(buf)
}

// GetExtranonce2Size returns the size of extranonce2.
func (jm *JobManager) GetExtranonce2Size() int {
	return jm.cfg.Extranonce2Size
}

// GetCurrentJob returns the current active job.
func (jm *JobManager) GetCurrentJob() *Job {
	if j := jm.currentJob.Load(); j != nil {
		return j.(*Job)
	}
	return nil
}

// GetJob returns a job by ID.
func (jm *JobManager) GetJob(id string) *Job {
	if job, ok := jm.jobs.Load(id); ok {
		return job.(*Job)
	}
	return nil
}

// IsJobStale checks if a job is too old to accept shares.
func (jm *JobManager) IsJobStale(id string) bool {
	job := jm.GetJob(id)
	if job == nil {
		return true
	}

	// Check job age
	if time.Since(job.CreatedAt) > jm.cfg.JobTimeout {
		return true
	}

	// Check if job is within stale threshold
	current := jm.GetCurrentJob()
	if current == nil {
		return true
	}

	// Count jobs since this one
	jobCount := 0
	jm.jobs.Range(func(key, value interface{}) bool {
		j := value.(*Job)
		if j.CreatedAt.After(job.CreatedAt) {
			jobCount++
		}
		return jobCount < jm.cfg.StaleJobThreshold
	})

	return jobCount >= jm.cfg.StaleJobThreshold
}

// CreateJob creates a new mining job from a block template.
func (jm *JobManager) CreateJob(ctx context.Context, template *BlockTemplate) (*Job, error) {
	jm.mu.Lock()
	defer jm.mu.Unlock()

	// Generate job ID
	jobID := jm.generateJobID()

	// Determine if we should clean old jobs
	cleanJobs := template.Height != jm.currentHeight
	if cleanJobs {
		jm.currentHeight = template.Height
		currentBlockHeight.Set(float64(template.Height))
	}

	// Build coinbase transaction
	coinbase1, coinbase2 := jm.buildCoinbase(template)

	// Create job
	job := &Job{
		ID:                jobID,
		Height:            template.Height,
		PrevBlockHash:     template.PreviousBlockHash,
		Coinbase1:         coinbase1,
		Coinbase2:         coinbase2,
		MerkleBranches:    template.MerkleBranches,
		Version:           template.Version,
		NBits:             template.Bits,
		NTime:             fmt.Sprintf("%08x", template.CurTime),
		NTimeValue:        template.CurTime,
		CleanJobs:         cleanJobs,
		NetworkDifficulty: template.Difficulty,
		CreatedAt:         time.Now(),
	}

	// Store job
	jm.jobs.Store(jobID, job)
	jm.currentJob.Store(job)

	// Clean old jobs if needed
	if cleanJobs {
		jm.cleanOldJobs()
	}

	// Notify subscribers
	jm.notifySubscribers(job)

	jobsGenerated.Inc()

	jm.logger.Info("New job created",
		zap.String("job_id", jobID),
		zap.Int64("height", template.Height),
		zap.Bool("clean_jobs", cleanJobs),
	)

	return job, nil
}

// generateJobID generates a unique job ID.
func (jm *JobManager) generateJobID() string {
	id := atomic.AddUint64(&jm.jobCounter, 1)
	return fmt.Sprintf("%x", id)
}

// buildCoinbase constructs coinbase1 and coinbase2 for a block template.
func (jm *JobManager) buildCoinbase(template *BlockTemplate) (string, string) {
	// Coinbase transaction structure:
	// Version (4 bytes)
	// Input count (1 byte, always 01 for coinbase)
	// Previous output hash (32 bytes, all zeros)
	// Previous output index (4 bytes, all 0xFF)
	// Script length (varint)
	// Coinbase script: block height + extranonce placeholder + arbitrary data
	// Sequence (4 bytes, all 0xFF)
	// Output count (varint)
	// Outputs...
	// Lock time (4 bytes)

	// For Stratum, we split the coinbase at the extranonce position:
	// coinbase1 = version + inputs + script_length + height_script
	// [extranonce1 + extranonce2 inserted here by miner]
	// coinbase2 = remaining_script + sequence + outputs + locktime

	// Simplified coinbase construction
	// In production, this would be much more detailed

	extranonceSize := jm.cfg.Extranonce1Size + jm.cfg.Extranonce2Size

	// Version (4 bytes, little endian)
	coinbase1 := "01000000"

	// Input count
	coinbase1 += "01"

	// Previous output (null for coinbase)
	coinbase1 += "0000000000000000000000000000000000000000000000000000000000000000"
	coinbase1 += "ffffffff"

	// Script length (height encoding + extranonce + signature)
	heightScript := encodeHeight(template.Height)
	scriptLen := len(heightScript)/2 + extranonceSize + 8 // 8 bytes for additional script
	coinbase1 += fmt.Sprintf("%02x", scriptLen)

	// Height in script
	coinbase1 += heightScript

	// Coinbase2 starts after extranonce
	coinbase2 := ""

	// Additional script data (pool tag, etc.)
	coinbase2 += "0000000000000000" // Placeholder

	// Sequence
	coinbase2 += "ffffffff"

	// Outputs - simplified single output to pool address
	coinbase2 += "01" // Output count

	// Value (in satoshis, little endian)
	reward := template.CoinbaseValue
	coinbase2 += fmt.Sprintf("%016x", reverseBytes64(reward))

	// Script pubkey (simplified P2PKH)
	scriptPubKey := "76a914" + "0000000000000000000000000000000000000000" + "88ac"
	coinbase2 += fmt.Sprintf("%02x", len(scriptPubKey)/2)
	coinbase2 += scriptPubKey

	// Lock time
	coinbase2 += "00000000"

	return coinbase1, coinbase2
}

// encodeHeight encodes block height for coinbase script.
func encodeHeight(height int64) string {
	if height < 17 {
		return fmt.Sprintf("%02x", height+0x50)
	}

	// Encode as push data
	heightBytes := make([]byte, 0, 8)
	h := height
	for h > 0 {
		heightBytes = append(heightBytes, byte(h&0xff))
		h >>= 8
	}

	return fmt.Sprintf("%02x%s", len(heightBytes), hex.EncodeToString(heightBytes))
}

// reverseBytes64 reverses byte order for 64-bit value.
func reverseBytes64(v uint64) uint64 {
	return ((v & 0x00000000000000FF) << 56) |
		((v & 0x000000000000FF00) << 40) |
		((v & 0x0000000000FF0000) << 24) |
		((v & 0x00000000FF000000) << 8) |
		((v & 0x000000FF00000000) >> 8) |
		((v & 0x0000FF0000000000) >> 24) |
		((v & 0x00FF000000000000) >> 40) |
		((v & 0xFF00000000000000) >> 56)
}

// cleanOldJobs removes jobs older than the stale threshold.
func (jm *JobManager) cleanOldJobs() {
	cutoff := time.Now().Add(-jm.cfg.JobTimeout)

	jm.jobs.Range(func(key, value interface{}) bool {
		job := value.(*Job)
		if job.CreatedAt.Before(cutoff) {
			jm.jobs.Delete(key)
		}
		return true
	})
}

// Subscribe returns a channel that receives new jobs.
func (jm *JobManager) Subscribe() <-chan *Job {
	jm.subscribersMu.Lock()
	defer jm.subscribersMu.Unlock()

	ch := make(chan *Job, 10)
	jm.subscribers = append(jm.subscribers, ch)
	return ch
}

// notifySubscribers sends a new job to all subscribers.
func (jm *JobManager) notifySubscribers(job *Job) {
	jm.subscribersMu.RLock()
	defer jm.subscribersMu.RUnlock()

	for _, ch := range jm.subscribers {
		select {
		case ch <- job:
		default:
			// Channel full, skip
		}
	}
}

// BlockTemplate represents a block template from the node.
type BlockTemplate struct {
	Version           string
	Height            int64
	PreviousBlockHash string
	Transactions      []string
	MerkleBranches    []string
	CoinbaseValue     uint64
	Bits              string
	CurTime           uint32
	Difficulty        float64
}

// StartBlockPolling starts polling the node for new block templates.
func (jm *JobManager) StartBlockPolling(ctx context.Context, nodeURL, rpcUser, rpcPass string) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	var lastHeight int64

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			template, err := jm.getBlockTemplate(ctx, nodeURL, rpcUser, rpcPass)
			if err != nil {
				jm.logger.Error("Failed to get block template", zap.Error(err))
				continue
			}

			// Only create new job if height changed or enough time passed
			if template.Height != lastHeight {
				lastHeight = template.Height
				if _, err := jm.CreateJob(ctx, template); err != nil {
					jm.logger.Error("Failed to create job", zap.Error(err))
				}
			}
		}
	}
}

// getBlockTemplate fetches a block template from the node.
func (jm *JobManager) getBlockTemplate(ctx context.Context, nodeURL, rpcUser, rpcPass string) (*BlockTemplate, error) {
	// This would make an RPC call to the cryptocurrency node
	// For now, return a mock template

	return &BlockTemplate{
		Version:           "20000000",
		Height:            100000,
		PreviousBlockHash: "0000000000000000000000000000000000000000000000000000000000000000",
		MerkleBranches:    []string{},
		CoinbaseValue:     625000000, // 6.25 BTC in satoshis
		Bits:              "1d00ffff",
		CurTime:           uint32(time.Now().Unix()),
		Difficulty:        1.0,
	}, nil
}
