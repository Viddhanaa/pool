// Package protocol implements difficulty calculation and variable difficulty (VarDiff).
package protocol

import (
	"math"
	"sync"
	"time"
)

// DifficultyConfig holds VarDiff configuration.
type DifficultyConfig struct {
	InitialDifficulty float64
	MinDifficulty     float64
	MaxDifficulty     float64
	TargetShareTime   time.Duration
	RetargetTime      time.Duration
	VariancePercent   float64
}

// VarDiff implements variable difficulty adjustment for miners.
type VarDiff struct {
	config DifficultyConfig
	mu     sync.RWMutex
}

// WorkerDiffState tracks difficulty state for a single worker.
type WorkerDiffState struct {
	CurrentDifficulty float64
	ShareTimes        []time.Time
	LastRetargetTime  time.Time
	TotalShares       int64
	mu                sync.Mutex
}

// NewVarDiff creates a new VarDiff calculator.
func NewVarDiff(cfg DifficultyConfig) *VarDiff {
	return &VarDiff{
		config: cfg,
	}
}

// NewWorkerDiffState creates a new difficulty state for a worker.
func NewWorkerDiffState(initialDiff float64) *WorkerDiffState {
	return &WorkerDiffState{
		CurrentDifficulty: initialDiff,
		ShareTimes:        make([]time.Time, 0, 100),
		LastRetargetTime:  time.Now(),
	}
}

// RecordShare records a share submission time.
func (w *WorkerDiffState) RecordShare(t time.Time) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.ShareTimes = append(w.ShareTimes, t)
	w.TotalShares++

	// Keep only last 100 share times
	if len(w.ShareTimes) > 100 {
		w.ShareTimes = w.ShareTimes[len(w.ShareTimes)-100:]
	}
}

// GetAverageShareTime calculates the average time between shares.
func (w *WorkerDiffState) GetAverageShareTime() time.Duration {
	w.mu.Lock()
	defer w.mu.Unlock()

	if len(w.ShareTimes) < 2 {
		return 0
	}

	totalTime := w.ShareTimes[len(w.ShareTimes)-1].Sub(w.ShareTimes[0])
	count := len(w.ShareTimes) - 1

	return totalTime / time.Duration(count)
}

// ShouldRetarget checks if it's time to recalculate difficulty.
func (v *VarDiff) ShouldRetarget(state *WorkerDiffState) bool {
	state.mu.Lock()
	defer state.mu.Unlock()

	return time.Since(state.LastRetargetTime) >= v.config.RetargetTime
}

// CalculateNewDifficulty computes the new difficulty for a worker.
func (v *VarDiff) CalculateNewDifficulty(state *WorkerDiffState) (float64, bool) {
	state.mu.Lock()
	defer state.mu.Unlock()

	if len(state.ShareTimes) < 2 {
		return state.CurrentDifficulty, false
	}

	// Calculate average share time
	totalTime := state.ShareTimes[len(state.ShareTimes)-1].Sub(state.ShareTimes[0])
	count := len(state.ShareTimes) - 1
	avgShareTime := totalTime / time.Duration(count)

	targetTime := v.config.TargetShareTime
	variance := v.config.VariancePercent / 100.0

	// Check if within acceptable variance
	lowerBound := time.Duration(float64(targetTime) * (1 - variance))
	upperBound := time.Duration(float64(targetTime) * (1 + variance))

	if avgShareTime >= lowerBound && avgShareTime <= upperBound {
		// Within acceptable range, no change needed
		return state.CurrentDifficulty, false
	}

	// Calculate new difficulty
	ratio := float64(avgShareTime) / float64(targetTime)
	newDiff := state.CurrentDifficulty * ratio

	// Limit change rate to 4x in either direction
	maxIncrease := state.CurrentDifficulty * 4
	maxDecrease := state.CurrentDifficulty / 4

	if newDiff > maxIncrease {
		newDiff = maxIncrease
	} else if newDiff < maxDecrease {
		newDiff = maxDecrease
	}

	// Apply min/max bounds
	if newDiff < v.config.MinDifficulty {
		newDiff = v.config.MinDifficulty
	} else if newDiff > v.config.MaxDifficulty {
		newDiff = v.config.MaxDifficulty
	}

	// Check if change is significant (more than 5%)
	if math.Abs(newDiff-state.CurrentDifficulty)/state.CurrentDifficulty < 0.05 {
		return state.CurrentDifficulty, false
	}

	// Update state
	state.CurrentDifficulty = newDiff
	state.LastRetargetTime = time.Now()
	state.ShareTimes = state.ShareTimes[:0] // Reset share times

	return newDiff, true
}

// DifficultyToTarget converts pool difficulty to target.
// Pool difficulty 1 = target 0x00000000FFFF0000000000000000000000000000000000000000000000000000
func DifficultyToTarget(difficulty float64) []byte {
	if difficulty <= 0 {
		difficulty = 1
	}

	// Bitcoin difficulty 1 target
	maxTarget := make([]byte, 32)
	maxTarget[4] = 0xFF
	maxTarget[5] = 0xFF

	// Calculate target = maxTarget / difficulty
	target := make([]byte, 32)

	// Use big integer math for precision
	// For simplicity, we'll use a float approximation for the upper bytes
	scaledValue := float64(0xFFFF) / difficulty
	targetValue := uint64(scaledValue * float64(1<<48))

	// Pack into target bytes (big endian)
	for i := 0; i < 8; i++ {
		target[4+i] = byte(targetValue >> (56 - uint(i)*8))
	}

	return target
}

// TargetToDifficulty converts a target hash to pool difficulty.
func TargetToDifficulty(target []byte) float64 {
	if len(target) != 32 {
		return 0
	}

	// Extract the significant bytes
	var targetValue uint64
	for i := 4; i < 12; i++ {
		targetValue = (targetValue << 8) | uint64(target[i])
	}

	if targetValue == 0 {
		return math.MaxFloat64
	}

	// difficulty = 0xFFFF * 2^48 / targetValue
	return float64(0xFFFF) * float64(1<<48) / float64(targetValue)
}

// CompactToDifficulty converts compact bits to difficulty.
func CompactToDifficulty(bits uint32) float64 {
	// Extract exponent and mantissa
	exponent := bits >> 24
	mantissa := bits & 0x007fffff

	// Handle sign bit
	if bits&0x00800000 != 0 {
		mantissa = -mantissa
	}

	var target float64
	if exponent <= 3 {
		target = float64(mantissa) / math.Pow(256, float64(3-exponent))
	} else {
		target = float64(mantissa) * math.Pow(256, float64(exponent-3))
	}

	if target == 0 {
		return 0
	}

	// Difficulty 1 target
	diff1 := float64(0x00000000FFFF0000000000000000000000000000000000000000000000000000)
	return diff1 / target
}

// ShareDifficulty calculates the difficulty of a share based on its hash.
func ShareDifficulty(hash []byte) float64 {
	if len(hash) != 32 {
		return 0
	}

	// Reverse hash (Bitcoin uses little-endian)
	reversed := make([]byte, 32)
	for i := 0; i < 32; i++ {
		reversed[i] = hash[31-i]
	}

	// Find the first non-zero byte
	var significantBytes uint64
	var offset int
	for i := 0; i < 32; i++ {
		if reversed[i] != 0 {
			offset = i
			break
		}
	}

	// Extract significant bytes
	for i := 0; i < 8 && offset+i < 32; i++ {
		significantBytes = (significantBytes << 8) | uint64(reversed[offset+i])
	}

	if significantBytes == 0 {
		return math.MaxFloat64
	}

	// Calculate difficulty based on leading zeros and value
	leadingZeros := offset * 8
	
	// difficulty = 2^256 / (hash value as big integer)
	// Simplified: use the ratio of diff1 target to hash
	diff1Prefix := uint64(0xFFFF) << 48
	hashPrefix := significantBytes << uint(64-8*min(8, 32-offset))

	difficulty := float64(diff1Prefix) / float64(hashPrefix) * math.Pow(2, float64(leadingZeros-32))

	return difficulty
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
