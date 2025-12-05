// Package crypto provides cryptographic utilities for mining.
package crypto

import (
	"crypto/sha256"
)

// DoubleSHA256 computes SHA256(SHA256(data)).
func DoubleSHA256(data []byte) []byte {
	first := sha256.Sum256(data)
	second := sha256.Sum256(first[:])
	return second[:]
}

// ReverseBytes reverses a byte slice in place and returns it.
func ReverseBytes(data []byte) []byte {
	result := make([]byte, len(data))
	for i := 0; i < len(data); i++ {
		result[i] = data[len(data)-1-i]
	}
	return result
}

// SwapEndian32 swaps the endianness of a 32-byte hash.
// This converts between big-endian and little-endian representation.
func SwapEndian32(hash []byte) []byte {
	if len(hash) != 32 {
		return hash
	}

	result := make([]byte, 32)
	for i := 0; i < 8; i++ {
		for j := 0; j < 4; j++ {
			result[i*4+j] = hash[i*4+(3-j)]
		}
	}
	return result
}

// CompareHashes compares two hashes as big-endian 256-bit numbers.
// Returns -1 if a < b, 0 if a == b, 1 if a > b.
func CompareHashes(a, b []byte) int {
	if len(a) != 32 || len(b) != 32 {
		return 0
	}

	for i := 0; i < 32; i++ {
		if a[i] < b[i] {
			return -1
		}
		if a[i] > b[i] {
			return 1
		}
	}
	return 0
}

// HashMeetsTarget checks if a hash meets the target difficulty.
// The hash must be less than or equal to the target.
func HashMeetsTarget(hash, target []byte) bool {
	return CompareHashes(hash, target) <= 0
}

// DifficultyToTarget converts a difficulty value to a target hash.
// Pool difficulty 1 corresponds to the Bitcoin difficulty 1 target.
func DifficultyToTarget(difficulty float64) []byte {
	if difficulty <= 0 {
		difficulty = 1
	}

	// Bitcoin difficulty 1 target
	// 0x00000000FFFF0000000000000000000000000000000000000000000000000000
	target := make([]byte, 32)
	
	// Base target for difficulty 1
	baseTarget := []byte{
		0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	}

	// For higher difficulties, we need to divide the target
	// This is a simplified implementation
	if difficulty == 1 {
		copy(target, baseTarget)
		return target
	}

	// Calculate new target = baseTarget / difficulty
	// Using big-endian math on the first 8 bytes for approximation
	baseValue := uint64(0xFFFF) << 48
	newValue := uint64(float64(baseValue) / difficulty)

	// Pack into target bytes
	for i := 0; i < 8; i++ {
		target[4+i] = byte(newValue >> (56 - uint(i)*8))
	}

	return target
}

// TargetToDifficulty converts a target hash to a difficulty value.
func TargetToDifficulty(target []byte) float64 {
	if len(target) != 32 {
		return 0
	}

	// Check for zero target
	allZero := true
	for _, b := range target {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		return 0
	}

	// Extract significant bytes starting from first non-zero
	var offset int
	for i := 0; i < 32; i++ {
		if target[i] != 0 {
			offset = i
			break
		}
	}

	// Pack 8 bytes into uint64
	var value uint64
	for i := 0; i < 8 && offset+i < 32; i++ {
		value = (value << 8) | uint64(target[offset+i])
	}

	if value == 0 {
		return 0
	}

	// Base difficulty 1 value (0xFFFF at offset 4)
	baseValue := uint64(0xFFFF) << 48

	// Adjust for offset difference from base (offset 4)
	shift := (offset - 4) * 8
	if shift > 0 {
		// Target is higher (easier), difficulty is lower
		return float64(baseValue) / float64(value) / float64(uint64(1)<<uint(shift))
	} else if shift < 0 {
		// Target is lower (harder), difficulty is higher
		return float64(baseValue) / float64(value) * float64(uint64(1)<<uint(-shift))
	}

	return float64(baseValue) / float64(value)
}

// NBitsToTarget converts compact bits representation to target.
func NBitsToTarget(bits uint32) []byte {
	target := make([]byte, 32)

	// Extract exponent and mantissa
	exponent := int(bits >> 24)
	mantissa := bits & 0x007FFFFF

	// Handle negative flag
	if bits&0x00800000 != 0 {
		mantissa = 0 // Negative targets are treated as zero
	}

	// Position mantissa in target
	if exponent <= 3 {
		mantissa >>= 8 * (3 - exponent)
		target[31] = byte(mantissa)
		target[30] = byte(mantissa >> 8)
		target[29] = byte(mantissa >> 16)
	} else {
		pos := 32 - exponent
		if pos >= 0 && pos < 32 {
			target[pos] = byte(mantissa >> 16)
		}
		if pos+1 >= 0 && pos+1 < 32 {
			target[pos+1] = byte(mantissa >> 8)
		}
		if pos+2 >= 0 && pos+2 < 32 {
			target[pos+2] = byte(mantissa)
		}
	}

	return target
}

// TargetToNBits converts a target to compact bits representation.
func TargetToNBits(target []byte) uint32 {
	if len(target) != 32 {
		return 0
	}

	// Find first non-zero byte
	var i int
	for i = 0; i < 32; i++ {
		if target[i] != 0 {
			break
		}
	}

	if i == 32 {
		return 0
	}

	exponent := 32 - i

	var mantissa uint32
	mantissa = uint32(target[i]) << 16
	if i+1 < 32 {
		mantissa |= uint32(target[i+1]) << 8
	}
	if i+2 < 32 {
		mantissa |= uint32(target[i+2])
	}

	// Handle negative flag
	if mantissa&0x00800000 != 0 {
		mantissa >>= 8
		exponent++
	}

	return (uint32(exponent) << 24) | mantissa
}

// MerkleRoot calculates the merkle root from a list of transaction hashes.
func MerkleRoot(hashes [][]byte) []byte {
	if len(hashes) == 0 {
		return make([]byte, 32)
	}

	if len(hashes) == 1 {
		return hashes[0]
	}

	// Make a copy to avoid modifying the input
	level := make([][]byte, len(hashes))
	copy(level, hashes)

	for len(level) > 1 {
		// If odd number of hashes, duplicate the last one
		if len(level)%2 != 0 {
			level = append(level, level[len(level)-1])
		}

		newLevel := make([][]byte, len(level)/2)
		for i := 0; i < len(level); i += 2 {
			combined := make([]byte, 64)
			copy(combined[0:32], level[i])
			copy(combined[32:64], level[i+1])
			newLevel[i/2] = DoubleSHA256(combined)
		}
		level = newLevel
	}

	return level[0]
}

// CalculateMerkleRootWithCoinbase calculates the merkle root given a coinbase hash and branches.
func CalculateMerkleRootWithCoinbase(coinbaseHash []byte, branches [][]byte) []byte {
	hash := make([]byte, 32)
	copy(hash, coinbaseHash)

	for _, branch := range branches {
		combined := make([]byte, 64)
		copy(combined[0:32], hash)
		copy(combined[32:64], branch)
		hash = DoubleSHA256(combined)
	}

	return hash
}
