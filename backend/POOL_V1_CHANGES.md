# Pool V1 Backend Services Update Summary

## Overview
Updated backend pool services to match V1 requirements: single asset (BTCD only), no lockup/cooldown validation, single pool ("btcd-main-pool"), and simplified validation logic.

## Changes Made

### 1. **New File: `backend/src/config/poolConfig.ts`**
Created centralized pool configuration with v1/v2 expansion points.

**Key Features:**
- Single pool ID: `btcd-main-pool`
- Single asset: BTCD (deposit and reward)
- Cooldown period: 0 (instant withdrawals)
- Helper functions: `isValidDepositAsset()`, `isValidRewardAsset()`, `getCooldownPeriod()`
- V2 expansion comments for multi-asset, lockup tiers, cooldowns

**V2 Expansion Points:**
```typescript
// COOLDOWN_PERIOD: 86400, // 24 hours
// SUPPORTED_ASSETS: ['BTCD', 'ETH', 'USDC'],
// LOCKUP_TIERS: [...]
```

---

### 2. **Updated: `backend/src/services/poolService.ts`**

#### Changes:
- **Import**: Added `POOL_CONFIG` and `isValidDepositAsset` from `poolConfig`
- **`validateDepositRequest()`**:
  - Added `asset` parameter (required for validation)
  - Added BTCD-only validation using `isValidDepositAsset()`
  - Added single pool validation (`btcd-main-pool`)
  - Simplified logic - removed complex asset switching
  - V2 comments for multi-asset expansion
  
- **`validateWithdrawalRequest()`**:
  - Removed cooldown validation logic (cooldown is 0 in v1)
  - Added single pool validation
  - Added commented v2 cooldown check for future expansion
  - Simplified flow for instant withdrawals

- **`recordDeposit()`**:
  - Asset always set to `POOL_CONFIG.DEPOSIT_ASSET` (BTCD)
  - Updated logging to include asset info
  - V2 comment for multi-asset support

- **`recordWithdrawal()`**:
  - Asset always set to `POOL_CONFIG.DEPOSIT_ASSET` (BTCD)
  - Updated logging to include asset info
  - V2 comment for multi-asset support

**API Signature Changes:**
```typescript
// OLD
validateDepositRequest(userId, poolId, amount, contractAddress)
// NEW
validateDepositRequest(userId, poolId, amount, asset, contractAddress)
```

**Note**: Routes calling `validateDepositRequest()` will need to pass the `asset` parameter.

---

### 3. **Updated: `backend/src/services/poolRewardService.ts`**

#### Changes:
- **Import**: Added `POOL_CONFIG` from `poolConfig`
- **`createRewardEpoch()`**:
  - Updated comments: reward token always BTCD in v1
  - Updated logging to include `rewardAsset: POOL_CONFIG.REWARD_ASSET`
  - V2 comments for multi-token rewards

- **`distributeEpochRewards()`**:
  - Simplified single asset flow (BTCD only)
  - Updated comments: no lockup multipliers in v1
  - Updated logging to include `rewardAsset`
  - Database queries assume single asset (no complex asset joins)
  - V2 comments for lockup tiers, bonus multipliers

- **`claimPoolRewards()`**:
  - Updated comments: rewards always in BTCD
  - Single asset balance update (miners.pending_balance)
  - Updated logging to include `rewardAsset`
  - V2 comments for multi-asset balance tracking

**Database Assumptions:**
- Single `pending_balance` field in `miners` table (BTCD)
- V2 can expand to multi-asset balance tracking table

---

### 4. **Updated: `backend/src/services/oracleService.ts`**

#### Changes:
- **File-level Comment**: Added V1 note - oracle is OPTIONAL for BTCD
- **Import**: Added `POOL_CONFIG` from `poolConfig`
- **`fetchOraclePrice()`**: Updated comments for v1 optional status
- **`getCachedOraclePrice()`**: Updated comments for v1 optional status
- **`getOraclePriceWithCache()`**:
  - Added v1 logic: returns fixed price (1.0) if oracle not configured for BTCD
  - Logs "oracle not configured for BTCD - using fixed price (v1)"
  - Falls back to normal oracle flow for v2

**V1 Oracle Behavior:**
```typescript
// If BTCD and no oracle address, return fixed price
if (asset === 'BTCD' && !oracleAddress) {
  return { price: '1.0', source: 'fixed', stale: false, ... };
}
```

**V2 Expansion:**
- Multi-asset pools will require oracle integration
- Cross-asset reward calculations
- Dynamic pricing for risk management

---

### 5. **Updated: `backend/src/services/riskService.ts`**

#### Changes:
- **File-level Comment**: Added V1 note - no cooldown periods, keep TVL/withdrawal limits
- **Import**: Added `POOL_CONFIG` and `getCooldownPeriod` from `poolConfig`
- **`checkTvlCap()`**:
  - Updated logging to include `asset: POOL_CONFIG.DEPOSIT_ASSET`
  - V2 comments for dynamic TVL caps based on oracle data

- **`checkDailyWithdrawalLimit()`**:
  - Added `cooldownPeriod` reference (always 0 in v1)
  - Updated logging to include `cooldownPeriod` and `asset`
  - No actual cooldown validation (handled in poolService)
  - V2 comments for per-user limits, cooldown validation

**V1 Risk Checks:**
- ✅ TVL cap enforcement
- ✅ Daily withdrawal limits
- ❌ Cooldown period checks (removed)
- ❌ Lockup enforcement (not applicable)

**V2 Expansion:**
- Per-user withdrawal limits
- Cooldown period validation
- Dynamic caps based on collateralization
- Multi-asset risk scoring

---

### 6. **Database Migration: `backend/scripts/initializePool.ts`**

**Status**: ✅ Already exists and matches v1 requirements

**Initialization Steps:**
1. Creates `btcd-main-pool` pool record
2. Sets risk parameters (TVL cap, withdrawal limits)
3. Initializes circuit breaker (inactive)
4. Sets reward weight to 100%
5. Creates initial reward epoch

**Usage:**
```bash
cd backend
npx ts-node scripts/initializePool.ts
```

**Environment Variables Required:**
- `POOL_CONTRACT_ADDRESS` - Pool contract address
- `BTCD_TOKEN_ADDRESS` - BTCD token address
- `POOL_INITIAL_TVL_CAP` - Initial TVL cap (default: 1,000,000)
- `DATABASE_URL` - PostgreSQL connection string

---

## Testing Considerations

### Tests to Update:
1. **`backend/src/services/poolService.test.ts`**:
   - Update `validateDepositRequest()` tests to include `asset` parameter
   - Add tests for BTCD-only validation
   - Add tests for single pool validation
   - Remove cooldown validation tests

2. **`backend/src/services/poolRewardService.test.ts`**:
   - Verify single asset flow
   - Update assertions to check BTCD asset
   - Remove multi-asset test cases (or mark as v2)

3. **`backend/src/services/riskService.test.ts`**:
   - Remove cooldown period tests
   - Verify TVL cap and withdrawal limit enforcement

### New Test Cases:
- Asset rejection: Deposit with ETH should fail in v1
- Pool rejection: Deposit to non-existent pool should fail
- Instant withdrawals: No cooldown should allow immediate withdrawal
- Oracle fallback: BTCD should work without oracle

---

## API Changes

### Routes that Need Updates:

1. **Deposit Route** (`backend/src/routes/pool.ts`):
   - Add `asset` field to request body
   - Pass `asset` to `validateDepositRequest()`
   - Validate asset is BTCD before processing

2. **Withdrawal Route**:
   - No API changes needed
   - Internal validation handles cooldown removal

3. **Reward Claim Route**:
   - No API changes needed
   - Rewards always in BTCD

**Example Deposit Request:**
```json
{
  "poolId": "btcd-main-pool",
  "amount": "100.0",
  "asset": "BTCD"
}
```

---

## Code Style Compliance (per AGENTS.md)

✅ **TypeScript Strict Mode**: All functions have explicit return types
✅ **No `any` Types**: Strict typing throughout
✅ **Error Handling**: All errors logged with context, no swallowing
✅ **Naming Conventions**: 
  - `camelCase` for functions/variables
  - `PascalCase` for types/interfaces
  - `SCREAMING_SNAKE_CASE` for config constants
✅ **Comments**: V1/V2 expansion points clearly marked
✅ **Imports**: Grouped as Node builtins → external libs → internal modules
✅ **Security**: All external input validated, asset checks enforced

---

## V1 Feature Summary

| Feature | V1 Status | V2 Expansion |
|---------|-----------|--------------|
| Asset Support | ✅ BTCD only | Multi-asset (ETH, USDC, etc.) |
| Pool Count | ✅ Single pool | Multiple pools |
| Cooldown Period | ✅ 0 seconds | Configurable (e.g., 24h) |
| Lockup Periods | ❌ Not supported | Tiered lockups with bonuses |
| Oracle Integration | ⚠️ Optional (fixed price) | Required for multi-asset |
| Reward Token | ✅ BTCD only | Multiple reward tokens |
| TVL Cap | ✅ Enforced | Dynamic caps based on oracle |
| Withdrawal Limits | ✅ Enforced | Per-user limits + cooldowns |

---

## Migration Path to V2

### Phase 1: Cooldown Support
1. Update `POOL_CONFIG.COOLDOWN_PERIOD` to desired seconds
2. Uncomment cooldown validation in `poolService.validateWithdrawalRequest()`
3. Update `riskService.checkDailyWithdrawalLimit()` to enforce cooldowns

### Phase 2: Multi-Asset Support
1. Add `SUPPORTED_ASSETS` array to `poolConfig`
2. Update `isValidDepositAsset()` to check array
3. Update database schema for multi-asset balance tracking
4. Integrate oracle for all assets
5. Update reward distribution for cross-asset scenarios

### Phase 3: Lockup Tiers
1. Add `LOCKUP_TIERS` to `poolConfig`
2. Add `lockup_period` and `lockup_end` columns to `user_pool_shares`
3. Update `poolRewardService.distributeEpochRewards()` for multipliers
4. Add lockup validation to withdrawal flow

### Phase 4: Multiple Pools
1. Remove single pool validation checks
2. Add pool discovery/listing endpoints
3. Update frontend for pool selection
4. Configure per-pool risk parameters

---

## Checklist for Deployment

- [ ] Run TypeScript compiler: `cd backend && npm run typecheck`
- [ ] Run linter: `cd backend && npm run lint`
- [ ] Run formatter: `cd backend && npm run format`
- [ ] Update tests for new `asset` parameter
- [ ] Run test suite: `cd backend && npm test`
- [ ] Update API documentation for deposit endpoint
- [ ] Set environment variables for pool initialization
- [ ] Run initialization script: `npx ts-node scripts/initializePool.ts`
- [ ] Verify pool record in database
- [ ] Test deposit flow with BTCD
- [ ] Test withdrawal flow (instant)
- [ ] Test reward distribution
- [ ] Monitor logs for v1-specific messages
- [ ] Update frontend to pass `asset: "BTCD"` in deposit requests

---

## Environment Variables

```bash
# Pool Contract
POOL_CONTRACT_ADDRESS=0x...

# BTCD Token
BTCD_TOKEN_ADDRESS=0x...

# Risk Parameters
POOL_INITIAL_TVL_CAP=1000000
POOL_MAX_USER_DEPOSIT=100000
POOL_DAILY_WITHDRAWAL_CAP=50000

# Oracle (optional for v1)
BTCD_ORACLE_ADDRESS=0x...  # Can be omitted in v1
```

---

## Files Modified

1. ✅ `backend/src/config/poolConfig.ts` (NEW)
2. ✅ `backend/src/services/poolService.ts` (UPDATED)
3. ✅ `backend/src/services/poolRewardService.ts` (UPDATED)
4. ✅ `backend/src/services/oracleService.ts` (UPDATED)
5. ✅ `backend/src/services/riskService.ts` (UPDATED)
6. ✅ `backend/scripts/initializePool.ts` (EXISTS - no changes needed)

## Files to Update Next

- `backend/src/routes/pool.ts` - Add `asset` parameter handling
- `backend/src/services/poolService.test.ts` - Update tests
- `backend/src/services/poolRewardService.test.ts` - Update tests
- `backend/src/services/riskService.test.ts` - Update tests

---

## Summary

All backend pool services have been updated to support V1 requirements:
- ✅ Single asset (BTCD) validation enforced
- ✅ Cooldown validation removed (instant withdrawals)
- ✅ Single pool validation (`btcd-main-pool`)
- ✅ Simplified deposit/withdrawal logic
- ✅ BTCD-only reward distribution
- ✅ Optional oracle support (fixed price fallback)
- ✅ TVL cap and withdrawal limit enforcement maintained
- ✅ Clear V2 expansion points documented throughout code

Next steps: Update route handlers and tests, then deploy and initialize pool.
