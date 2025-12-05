// Package storage provides Redis client for real-time data.
package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/viddhana/pool/internal/config"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// RedisClient wraps Redis operations for the stratum server.
type RedisClient struct {
	client    *redis.Client
	cfg       config.RedisConfig
	logger    *zap.Logger
	keyPrefix string
}

// NewRedisClient creates a new Redis client.
func NewRedisClient(ctx context.Context, cfg config.RedisConfig, logger *zap.Logger) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
		PoolSize: cfg.PoolSize,
	})

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	logger.Info("Connected to Redis",
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
	)

	return &RedisClient{
		client:    client,
		cfg:       cfg,
		logger:    logger.Named("redis"),
		keyPrefix: cfg.KeyPrefix,
	}, nil
}

// Close closes the Redis connection.
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// key generates a prefixed key.
func (r *RedisClient) key(parts ...string) string {
	key := r.keyPrefix
	for _, part := range parts {
		key += part + ":"
	}
	return key[:len(key)-1]
}

// CheckDuplicateShare checks if a share has already been submitted.
func (r *RedisClient) CheckDuplicateShare(ctx context.Context, shareKey string) (bool, error) {
	key := r.key("share", shareKey)
	
	// Use SetNX to atomically check and set
	result, err := r.client.SetNX(ctx, key, 1, r.cfg.ShareTTL).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check duplicate share: %w", err)
	}

	// If result is false, the key already existed (duplicate)
	return !result, nil
}

// AddOnlineWorker adds a worker to the online workers set.
func (r *RedisClient) AddOnlineWorker(ctx context.Context, workerName string) error {
	key := r.key("workers", "online")
	
	_, err := r.client.SAdd(ctx, key, workerName).Result()
	if err != nil {
		return fmt.Errorf("failed to add online worker: %w", err)
	}

	// Set worker heartbeat
	heartbeatKey := r.key("worker", workerName, "heartbeat")
	_, err = r.client.Set(ctx, heartbeatKey, time.Now().Unix(), r.cfg.WorkerTTL).Result()
	
	return err
}

// RemoveOnlineWorker removes a worker from the online workers set.
func (r *RedisClient) RemoveOnlineWorker(ctx context.Context, workerName string) error {
	key := r.key("workers", "online")
	
	_, err := r.client.SRem(ctx, key, workerName).Result()
	if err != nil {
		return fmt.Errorf("failed to remove online worker: %w", err)
	}

	// Delete worker heartbeat
	heartbeatKey := r.key("worker", workerName, "heartbeat")
	r.client.Del(ctx, heartbeatKey)

	return nil
}

// GetOnlineWorkers returns all online workers.
func (r *RedisClient) GetOnlineWorkers(ctx context.Context) ([]string, error) {
	key := r.key("workers", "online")
	
	workers, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get online workers: %w", err)
	}

	return workers, nil
}

// GetOnlineWorkerCount returns the number of online workers.
func (r *RedisClient) GetOnlineWorkerCount(ctx context.Context) (int64, error) {
	key := r.key("workers", "online")
	
	count, err := r.client.SCard(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get online worker count: %w", err)
	}

	return count, nil
}

// IncrementWorkerShares increments the share counter for a worker.
func (r *RedisClient) IncrementWorkerShares(ctx context.Context, workerName string, valid bool) error {
	var key string
	if valid {
		key = r.key("worker", workerName, "valid_shares")
	} else {
		key = r.key("worker", workerName, "invalid_shares")
	}

	_, err := r.client.Incr(ctx, key).Result()
	return err
}

// SetWorkerDifficulty sets the current difficulty for a worker.
func (r *RedisClient) SetWorkerDifficulty(ctx context.Context, workerName string, difficulty float64) error {
	key := r.key("worker", workerName, "difficulty")
	
	_, err := r.client.Set(ctx, key, difficulty, r.cfg.WorkerTTL).Result()
	return err
}

// GetWorkerDifficulty gets the current difficulty for a worker.
func (r *RedisClient) GetWorkerDifficulty(ctx context.Context, workerName string) (float64, error) {
	key := r.key("worker", workerName, "difficulty")
	
	result, err := r.client.Get(ctx, key).Float64()
	if err == redis.Nil {
		return 1.0, nil // Default difficulty
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get worker difficulty: %w", err)
	}

	return result, nil
}

// CacheCurrentJob caches the current job data.
func (r *RedisClient) CacheCurrentJob(ctx context.Context, jobID string, jobData []byte) error {
	key := r.key("job", "current")
	
	_, err := r.client.Set(ctx, key, jobData, time.Minute*5).Result()
	if err != nil {
		return fmt.Errorf("failed to cache job: %w", err)
	}

	// Also store in job history
	historyKey := r.key("job", jobID)
	_, err = r.client.Set(ctx, historyKey, jobData, time.Hour).Result()

	return err
}

// GetCachedJob retrieves a cached job.
func (r *RedisClient) GetCachedJob(ctx context.Context, jobID string) ([]byte, error) {
	key := r.key("job", jobID)
	
	data, err := r.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get cached job: %w", err)
	}

	return data, nil
}

// UpdatePoolHashrate updates the pool's total hashrate.
func (r *RedisClient) UpdatePoolHashrate(ctx context.Context, hashrate float64) error {
	key := r.key("pool", "hashrate")
	
	_, err := r.client.Set(ctx, key, hashrate, time.Minute).Result()
	return err
}

// GetPoolHashrate gets the pool's total hashrate.
func (r *RedisClient) GetPoolHashrate(ctx context.Context) (float64, error) {
	key := r.key("pool", "hashrate")
	
	result, err := r.client.Get(ctx, key).Float64()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get pool hashrate: %w", err)
	}

	return result, nil
}

// RecordShareForHashrate records a share for hashrate calculation.
func (r *RedisClient) RecordShareForHashrate(ctx context.Context, workerName string, difficulty float64) error {
	// Use a sorted set with timestamp as score
	key := r.key("worker", workerName, "share_times")
	now := float64(time.Now().UnixNano())

	_, err := r.client.ZAdd(ctx, key, redis.Z{
		Score:  now,
		Member: difficulty,
	}).Result()
	if err != nil {
		return err
	}

	// Remove entries older than 10 minutes
	cutoff := float64(time.Now().Add(-10 * time.Minute).UnixNano())
	r.client.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%f", cutoff))

	// Set TTL on the key
	r.client.Expire(ctx, key, time.Hour)

	return nil
}

// CalculateWorkerHashrate calculates hashrate from recent shares.
func (r *RedisClient) CalculateWorkerHashrate(ctx context.Context, workerName string) (float64, error) {
	key := r.key("worker", workerName, "share_times")

	// Get shares from last 10 minutes
	cutoff := float64(time.Now().Add(-10 * time.Minute).UnixNano())
	now := float64(time.Now().UnixNano())

	results, err := r.client.ZRangeByScoreWithScores(ctx, key, &redis.ZRangeBy{
		Min: fmt.Sprintf("%f", cutoff),
		Max: fmt.Sprintf("%f", now),
	}).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get share times: %w", err)
	}

	if len(results) < 2 {
		return 0, nil
	}

	// Sum difficulties
	var totalDiff float64
	for _, z := range results {
		diff, _ := z.Member.(float64)
		totalDiff += diff
	}

	// Calculate time span
	firstTime := results[0].Score
	lastTime := results[len(results)-1].Score
	timeSpanSeconds := (lastTime - firstTime) / 1e9

	if timeSpanSeconds <= 0 {
		return 0, nil
	}

	// Hashrate = totalDiff * 2^32 / timeSpan
	hashrate := totalDiff * 4294967296.0 / timeSpanSeconds

	return hashrate, nil
}

// Publish publishes a message to a channel.
func (r *RedisClient) Publish(ctx context.Context, channel string, message interface{}) error {
	return r.client.Publish(ctx, r.key(channel), message).Err()
}

// Subscribe subscribes to a channel.
func (r *RedisClient) Subscribe(ctx context.Context, channel string) *redis.PubSub {
	return r.client.Subscribe(ctx, r.key(channel))
}
