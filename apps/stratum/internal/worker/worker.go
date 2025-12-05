// Package worker implements worker tracking and statistics.
package worker

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/viddhana/pool/internal/mining"
	"github.com/viddhana/pool/internal/protocol"
	"github.com/viddhana/pool/internal/storage"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
)

// Prometheus metrics
var (
	activeWorkers = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "stratum_active_workers",
		Help: "Number of active workers",
	})

	workerHashrate = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "stratum_worker_hashrate",
		Help: "Estimated hashrate per worker",
	}, []string{"worker"})
)

func init() {
	prometheus.MustRegister(activeWorkers)
	prometheus.MustRegister(workerHashrate)
}

// Worker represents a mining worker.
type Worker struct {
	Name           string
	Password       string
	Address        string
	Difficulty     float64
	ValidShares    int64
	InvalidShares  int64
	StaleShares    int64
	LastShareTime  time.Time
	ConnectedAt    time.Time
	LastActivityAt time.Time
	DiffState      *protocol.WorkerDiffState
	Hashrate       float64
	mu             sync.RWMutex
}

// Manager manages worker connections and statistics.
type Manager struct {
	logger   *zap.Logger
	redis    *storage.RedisClient
	postgres *storage.PostgresClient
	varDiff  *protocol.VarDiff
	workers  sync.Map // map[string]*Worker
}

// NewManager creates a new worker manager.
func NewManager(logger *zap.Logger, redis *storage.RedisClient, postgres *storage.PostgresClient) *Manager {
	// Create VarDiff with default settings
	// These would normally come from config
	varDiff := protocol.NewVarDiff(protocol.DifficultyConfig{
		InitialDifficulty: 1.0,
		MinDifficulty:     0.001,
		MaxDifficulty:     1000000.0,
		TargetShareTime:   10 * time.Second,
		RetargetTime:      90 * time.Second,
		VariancePercent:   30,
	})

	return &Manager{
		logger:   logger.Named("worker"),
		redis:    redis,
		postgres: postgres,
		varDiff:  varDiff,
	}
}

// Register registers a new worker or returns existing one.
func (m *Manager) Register(ctx context.Context, name, password, address string) (*Worker, error) {
	// Check if worker already exists
	if w, ok := m.workers.Load(name); ok {
		worker := w.(*Worker)
		worker.mu.Lock()
		worker.LastActivityAt = time.Now()
		worker.Address = address
		worker.mu.Unlock()
		return worker, nil
	}

	// Create new worker
	worker := &Worker{
		Name:           name,
		Password:       password,
		Address:        address,
		Difficulty:     1.0, // Initial difficulty
		ConnectedAt:    time.Now(),
		LastActivityAt: time.Now(),
		DiffState:      protocol.NewWorkerDiffState(1.0),
	}

	// Store worker
	m.workers.Store(name, worker)
	activeWorkers.Inc()

	// Register in Redis for real-time tracking
	if err := m.redis.AddOnlineWorker(ctx, name); err != nil {
		m.logger.Warn("Failed to add worker to Redis", zap.String("worker", name), zap.Error(err))
	}

	// Register in PostgreSQL for persistence
	if err := m.postgres.UpsertWorker(ctx, &storage.Worker{
		Name:        name,
		Address:     address,
		FirstSeenAt: time.Now(),
		LastSeenAt:  time.Now(),
	}); err != nil {
		m.logger.Warn("Failed to register worker in database", zap.String("worker", name), zap.Error(err))
	}

	m.logger.Info("Worker registered",
		zap.String("name", name),
		zap.String("address", address),
	)

	return worker, nil
}

// Disconnect handles worker disconnection.
func (m *Manager) Disconnect(ctx context.Context, name string) {
	if w, ok := m.workers.LoadAndDelete(name); ok {
		worker := w.(*Worker)
		activeWorkers.Dec()

		// Remove from Redis
		if err := m.redis.RemoveOnlineWorker(ctx, name); err != nil {
			m.logger.Warn("Failed to remove worker from Redis", zap.String("worker", name), zap.Error(err))
		}

		// Update last seen in database
		if err := m.postgres.UpdateWorkerLastSeen(ctx, name, worker.LastActivityAt); err != nil {
			m.logger.Warn("Failed to update worker last seen", zap.String("worker", name), zap.Error(err))
		}

		m.logger.Info("Worker disconnected",
			zap.String("name", name),
			zap.Int64("valid_shares", worker.ValidShares),
			zap.Int64("invalid_shares", worker.InvalidShares),
		)
	}
}

// UpdateStats updates worker statistics based on share result.
func (m *Manager) UpdateStats(ctx context.Context, name string, result *mining.ShareResult) {
	w, ok := m.workers.Load(name)
	if !ok {
		return
	}

	worker := w.(*Worker)
	worker.mu.Lock()
	defer worker.mu.Unlock()

	now := time.Now()
	worker.LastActivityAt = now

	if result.Valid {
		worker.ValidShares++
		worker.LastShareTime = now
		worker.DiffState.RecordShare(now)

		// Update hashrate estimation
		m.updateHashrate(worker)

		// Update Redis stats
		go m.redis.IncrementWorkerShares(ctx, name, true)
	} else if result.RejectReason == "Stale job" || result.RejectReason == "Job not found" {
		worker.StaleShares++
		go m.redis.IncrementWorkerShares(ctx, name, false)
	} else {
		worker.InvalidShares++
		go m.redis.IncrementWorkerShares(ctx, name, false)
	}
}

// updateHashrate estimates the worker's hashrate based on recent shares.
func (m *Manager) updateHashrate(worker *Worker) {
	avgShareTime := worker.DiffState.GetAverageShareTime()
	if avgShareTime <= 0 {
		return
	}

	// Hashrate = difficulty * 2^32 / share_time_seconds
	// For Bitcoin-like PoW where difficulty 1 = 2^32 hashes
	hashrate := worker.Difficulty * 4294967296.0 / avgShareTime.Seconds()
	worker.Hashrate = hashrate

	workerHashrate.WithLabelValues(worker.Name).Set(hashrate)
}

// CheckVarDiff checks if a worker's difficulty should be adjusted.
func (m *Manager) CheckVarDiff(ctx context.Context, name string) float64 {
	w, ok := m.workers.Load(name)
	if !ok {
		return 0
	}

	worker := w.(*Worker)
	worker.mu.Lock()
	defer worker.mu.Unlock()

	if !m.varDiff.ShouldRetarget(worker.DiffState) {
		return 0
	}

	newDiff, changed := m.varDiff.CalculateNewDifficulty(worker.DiffState)
	if !changed {
		return 0
	}

	worker.Difficulty = newDiff

	m.logger.Debug("Worker difficulty adjusted",
		zap.String("worker", name),
		zap.Float64("new_difficulty", newDiff),
	)

	// Update Redis
	go m.redis.SetWorkerDifficulty(ctx, name, newDiff)

	return newDiff
}

// GetWorker returns a worker by name.
func (m *Manager) GetWorker(name string) *Worker {
	if w, ok := m.workers.Load(name); ok {
		return w.(*Worker)
	}
	return nil
}

// GetWorkerStats returns statistics for a worker.
func (m *Manager) GetWorkerStats(name string) (valid, invalid, stale int64, hashrate float64) {
	w, ok := m.workers.Load(name)
	if !ok {
		return
	}

	worker := w.(*Worker)
	worker.mu.RLock()
	defer worker.mu.RUnlock()

	return worker.ValidShares, worker.InvalidShares, worker.StaleShares, worker.Hashrate
}

// GetAllWorkers returns all connected workers.
func (m *Manager) GetAllWorkers() []*Worker {
	workers := make([]*Worker, 0)
	m.workers.Range(func(key, value interface{}) bool {
		workers = append(workers, value.(*Worker))
		return true
	})
	return workers
}

// GetWorkerCount returns the number of connected workers.
func (m *Manager) GetWorkerCount() int {
	count := 0
	m.workers.Range(func(key, value interface{}) bool {
		count++
		return true
	})
	return count
}

// SetDifficulty manually sets a worker's difficulty.
func (m *Manager) SetDifficulty(name string, difficulty float64) error {
	w, ok := m.workers.Load(name)
	if !ok {
		return fmt.Errorf("worker not found: %s", name)
	}

	worker := w.(*Worker)
	worker.mu.Lock()
	defer worker.mu.Unlock()

	worker.Difficulty = difficulty
	worker.DiffState.CurrentDifficulty = difficulty

	return nil
}

// CleanupInactiveWorkers removes workers that have been inactive.
func (m *Manager) CleanupInactiveWorkers(ctx context.Context, timeout time.Duration) {
	cutoff := time.Now().Add(-timeout)

	m.workers.Range(func(key, value interface{}) bool {
		worker := value.(*Worker)
		worker.mu.RLock()
		lastActivity := worker.LastActivityAt
		worker.mu.RUnlock()

		if lastActivity.Before(cutoff) {
			m.Disconnect(ctx, key.(string))
		}
		return true
	})
}

// StartCleanupRoutine starts a goroutine to periodically clean up inactive workers.
func (m *Manager) StartCleanupRoutine(ctx context.Context, interval, timeout time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.CleanupInactiveWorkers(ctx, timeout)
		}
	}
}
