# BTCD Pool v1 Read APIs Implementation Summary

## Overview
Implemented read-only APIs for BTCD Pool v1 as specified in `docs/btcd-pool-v1.md`.

## Files Created/Modified

### New Files Created:
1. **`backend/src/services/btcdPoolService.ts`**
   - Pool read operations service
   - Functions: `getPoolInfo()`, `getUserPosition()`
   - Includes structured logging
   - Handles missing pool/user gracefully

2. **`backend/src/services/btcdPoolService.test.ts`**
   - Comprehensive unit tests for service functions
   - 10 test cases covering all scenarios
   - Tests APR/APY calculations, edge cases, error handling

3. **`backend/src/routes/pool-btcd.test.ts`**
   - Integration tests for HTTP endpoints
   - 11 test cases covering all endpoints
   - Tests validation, error handling, query params

### Files Modified:
1. **`backend/src/types/pool.ts`**
   - Added `BtcdPoolInfoResponse` type
   - Added `BtcdUserPositionResponse` type

2. **`backend/src/routes/pool.ts`**
   - Added `GET /api/pool/btcd/info/:poolId?` endpoint
   - Added `GET /api/pool/btcd/user/:walletAddress` endpoint
   - Imported and integrated btcdPoolService functions

## Endpoints Implemented

### 1. GET `/api/pool/btcd/info/:poolId?`
**Description:** Get pool statistics and configuration

**Path Parameters:**
- `poolId` (optional): Pool identifier, defaults to `'btcd-main-pool'`

**Response:**
```json
{
  "pool_id": "btcd-main-pool",
  "name": "BTCD Main Pool",
  "deposit_asset": "BTCD",
  "reward_asset": "BTCD",
  "tvl": "1234567.89",
  "apr": "12.5",
  "apy": "13.2",
  "status": "active",
  "min_withdraw_threshold": "100"
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid pool ID format
- `404`: Pool not found
- `500`: Server error

---

### 2. GET `/api/pool/btcd/user/:walletAddress`
**Description:** Get user position in pool

**Path Parameters:**
- `walletAddress` (required): User's Ethereum wallet address

**Query Parameters:**
- `poolId` (optional): Pool identifier, defaults to `'btcd-main-pool'`

**Response:**
```json
{
  "wallet_address": "0x1234...",
  "pool_id": "btcd-main-pool",
  "staked_amount": "5000",
  "pending_rewards": "125.50",
  "total_earned": "350.75",
  "last_updated": "2025-12-03T12:00:00Z"
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid address or pool ID format
- `404`: User not found
- `500`: Server error

## Service Functions

### `getPoolInfo(poolId: string): Promise<PoolInfoResponse | null>`
**Purpose:** Retrieve pool configuration and statistics

**Logic:**
1. Queries `pool_config` table for pool data
2. Calculates TVL from summed positions
3. Calculates APR: `(reward_per_minute * 60 * 24 * 365) / TVL * 100`
4. Calculates APY: `(1 + APR/365)^365 - 1` (daily compounding)
5. Returns formatted response or null if not found

**Database Tables Used:**
- `pool_config`: Pool configuration and TVL

---

### `getUserPosition(walletAddress: string, poolId: string): Promise<UserPositionResponse | null>`
**Purpose:** Retrieve user's staking position and rewards

**Logic:**
1. Finds user by wallet address in `miners` table (case-insensitive)
2. Queries `pool_positions` for staked amount
3. Uses `pending_balance` from miners as claimable rewards
4. Uses `total_earned` from miners as lifetime earnings
5. Returns formatted response or null if user not found

**Database Tables Used:**
- `miners`: User data (wallet, earnings, pending balance)
- `pool_positions`: User stake tracking

## Response Types

### `BtcdPoolInfoResponse`
```typescript
interface BtcdPoolInfoResponse {
  pool_id: string;
  name: string;
  deposit_asset: string;
  reward_asset: string;
  tvl: string;
  apr: string;
  apy: string;
  status: 'active' | 'paused';
  min_withdraw_threshold: string;
}
```

### `BtcdUserPositionResponse`
```typescript
interface BtcdUserPositionResponse {
  wallet_address: string;
  pool_id: string;
  staked_amount: string;
  pending_rewards: string;
  total_earned: string;
  last_updated: string;
}
```

## Test Coverage

### Service Tests (btcdPoolService.test.ts)
✅ **getPoolInfo()**
- Returns pool info with calculated APR and APY
- Returns zero APR/APY when TVL is zero
- Returns zero APR/APY when reward per minute is zero
- Returns null when pool not found
- Handles database errors gracefully

✅ **getUserPosition()**
- Returns user position with staked amount and pending rewards
- Returns zeros for user with no position
- Returns null when user not found
- Handles case-insensitive wallet address lookup
- Handles database errors gracefully

### Route Tests (pool-btcd.test.ts)
✅ **GET /api/pool/btcd/info/:poolId**
- Returns pool info for valid pool
- Uses default pool ID when not provided
- Returns 404 when pool not found
- Returns 400 for invalid pool ID format
- Handles service errors

✅ **GET /api/pool/btcd/user/:walletAddress**
- Returns user position for valid address
- Uses custom pool ID from query param
- Returns 404 when user not found
- Returns 400 for invalid wallet address format
- Returns 400 for invalid pool ID format in query
- Handles service errors

**Total Tests:** 21 tests, all passing ✅

## Code Quality

✅ **TypeScript:** Type-safe with explicit return types
✅ **Linting:** Passes ESLint with no warnings
✅ **Formatting:** Follows Prettier config (100-char width, single quotes)
✅ **Logging:** Structured logging with context
✅ **Error Handling:** Sanitized error messages, full logs server-side
✅ **Validation:** Input validation for addresses, pool IDs, amounts

## Database Schema Alignment

Implementation aligns with migration `007_btcd_pool_v1.sql`:

**Tables Used:**
- ✅ `pool_config`: Pool configuration, TVL, reward rates
- ✅ `pool_positions`: User staked amounts (per pool)
- ✅ `miners`: User wallet, total earned, pending balance

**Fields Mapped:**
- `pool_config.tvl` → `PoolInfoResponse.tvl`
- `pool_config.reward_per_minute` → Used for APR/APY calculation
- `pool_positions.staked_amount` → `UserPositionResponse.staked_amount`
- `miners.pending_balance` → `UserPositionResponse.pending_rewards`
- `miners.total_earned` → `UserPositionResponse.total_earned`

## API Documentation

### Example Requests

**Get Pool Info:**
```bash
curl http://localhost:8080/api/pool/btcd/info/btcd-main-pool
```

**Get User Position:**
```bash
curl http://localhost:8080/api/pool/btcd/user/0x1234567890123456789012345678901234567890?poolId=btcd-main-pool
```

## Next Steps (Not Implemented)

This implementation focuses on read-only operations. Future work may include:
- ❌ Deposit endpoints (POST /api/pool/btcd/deposit)
- ❌ Withdrawal endpoints (POST /api/pool/btcd/withdraw)
- ❌ Reward distribution cron job
- ❌ Withdrawal worker
- ❌ On-chain contract integration

## Notes

1. **APR/APY Calculation:** Basic formula used. For v1, assumes continuous rewards.
2. **Case Sensitivity:** Wallet addresses are case-insensitive in lookups.
3. **Default Pool:** Defaults to `'btcd-main-pool'` when not specified.
4. **Error Handling:** All errors logged with context, sanitized messages returned to client.
5. **Validation:** Address format: `0x[a-fA-F0-9]{40}`, Pool ID: `[a-zA-Z0-9_-]{1,64}`
