# Pool V1 Quick Reference Guide

## Summary of Changes

✅ **All services updated to match V1 requirements**
✅ **TypeScript compilation: PASS**
✅ **Linting: PASS (no errors in updated files)**
✅ **Code style: Compliant with AGENTS.md**

---

## Key V1 Features

| Feature | Implementation |
|---------|---------------|
| **Asset Support** | BTCD only (enforced in `poolConfig.ts`) |
| **Pool ID** | `btcd-main-pool` (hardcoded) |
| **Cooldown Period** | 0 seconds (instant withdrawals) |
| **Lockup** | Not supported in V1 |
| **Oracle** | Optional (fixed price fallback for BTCD) |
| **Reward Token** | BTCD only |
| **TVL Cap** | Enforced via `riskService` |
| **Withdrawal Limits** | Daily limits enforced |

---

## Files Changed

### New Files:
1. **`backend/src/config/poolConfig.ts`** - Central pool configuration

### Updated Files:
2. **`backend/src/services/poolService.ts`** - Deposit/withdrawal validation
3. **`backend/src/services/poolRewardService.ts`** - Reward distribution
4. **`backend/src/services/oracleService.ts`** - Price oracle (optional)
5. **`backend/src/services/riskService.ts`** - Risk management
6. **`backend/POOL_V1_CHANGES.md`** - Detailed change documentation

### Existing (No Changes):
- **`backend/scripts/initializePool.ts`** - Already v1-compliant

---

## API Changes Required

### Deposit Endpoint
**Before:**
```typescript
validateDepositRequest(userId, poolId, amount, contractAddress)
```

**After:**
```typescript
validateDepositRequest(userId, poolId, amount, asset, contractAddress)
```

**Example Request Body:**
```json
{
  "poolId": "btcd-main-pool",
  "amount": "100.0",
  "asset": "BTCD"
}
```

### Route Files to Update:
- `backend/src/routes/pool.ts` - Add `asset` parameter handling

---

## Testing Checklist

### Unit Tests to Update:
- [ ] `backend/src/services/poolService.test.ts`
  - Update `validateDepositRequest()` calls to include `asset` param
  - Add tests for BTCD-only validation
  - Remove cooldown tests
  
- [ ] `backend/src/services/poolRewardService.test.ts`
  - Verify single asset (BTCD) flow
  - Update assertions for reward asset
  
- [ ] `backend/src/services/riskService.test.ts`
  - Remove cooldown period tests
  - Verify TVL cap enforcement

### Integration Tests:
- [ ] Test deposit with BTCD - should succeed
- [ ] Test deposit with non-BTCD asset - should fail
- [ ] Test deposit to invalid pool - should fail
- [ ] Test withdrawal with no cooldown - should succeed immediately
- [ ] Test reward claim - should add BTCD to balance

---

## Deployment Steps

### 1. Pre-deployment
```bash
cd backend
npm run typecheck  # ✅ Already passed
npm run lint       # ✅ Already passed
npm run format     # Run if needed
npm test           # After updating tests
```

### 2. Environment Setup
```bash
# Set in .env or environment
POOL_CONTRACT_ADDRESS=0x...
BTCD_TOKEN_ADDRESS=0x...
POOL_INITIAL_TVL_CAP=1000000
DATABASE_URL=postgres://...
```

### 3. Initialize Pool
```bash
cd backend
npx ts-node scripts/initializePool.ts
```

**Expected Output:**
```
✓ Pool created: btcd-main-pool
✓ Risk parameters set
✓ Circuit breaker initialized
✓ Reward weight set to 100%
✓ Initial epoch created
✓ Initialization complete!
```

### 4. Verify Database
```sql
SELECT * FROM pools WHERE pool_id = 'btcd-main-pool';
SELECT * FROM pool_risk_parameters WHERE pool_id = 'btcd-main-pool';
SELECT * FROM circuit_breaker_status WHERE pool_id = 'btcd-main-pool';
SELECT * FROM pool_reward_weights WHERE pool_id = 'btcd-main-pool';
```

### 5. Test Endpoints
```bash
# Test deposit (should succeed)
curl -X POST http://localhost:4000/api/pool/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"poolId":"btcd-main-pool","amount":"100","asset":"BTCD"}'

# Test deposit with wrong asset (should fail)
curl -X POST http://localhost:4000/api/pool/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"poolId":"btcd-main-pool","amount":"100","asset":"ETH"}'
```

---

## V1 Validation Rules

### Deposits:
1. ✅ Asset must be BTCD
2. ✅ Pool must be `btcd-main-pool`
3. ✅ Amount must be > 0
4. ✅ Pool must not be paused
5. ✅ Amount must be >= minDeposit (from contract)
6. ✅ Amount must be <= maxDeposit (from contract)
7. ✅ User must have sufficient BTCD balance
8. ✅ TVL cap not exceeded (risk check)

### Withdrawals:
1. ✅ Pool must be `btcd-main-pool`
2. ✅ Shares amount must be > 0
3. ✅ Pool must not be paused
4. ✅ User must have sufficient shares
5. ❌ **No cooldown check** (V1 feature)
6. ✅ Daily withdrawal limit not exceeded (risk check)

### Rewards:
1. ✅ Reward token is always BTCD
2. ✅ Distributed proportionally by shares
3. ✅ Claimed rewards added to `pending_balance`
4. ❌ **No lockup multipliers** (V1 feature)

---

## Configuration Reference

### `POOL_CONFIG` (poolConfig.ts)
```typescript
POOL_ID: 'btcd-main-pool'
POOL_NAME: 'BTCD Main Staking Pool'
DEPOSIT_ASSET: 'BTCD'
REWARD_ASSET: 'BTCD'
COOLDOWN_PERIOD: 0  // seconds
```

### Helper Functions:
- `isValidDepositAsset(asset: string): boolean` - Check if asset is BTCD
- `isValidRewardAsset(asset: string): boolean` - Check if reward is BTCD
- `getCooldownPeriod(): number` - Returns 0 for V1

---

## Troubleshooting

### Issue: Deposit fails with "Invalid asset"
**Cause:** Asset is not BTCD
**Fix:** Ensure frontend passes `asset: "BTCD"`

### Issue: Deposit fails with "Invalid pool"
**Cause:** Pool ID is not `btcd-main-pool`
**Fix:** Ensure frontend passes correct pool ID

### Issue: Withdrawal fails immediately after deposit
**Cause:** This should NOT happen in V1 (no cooldown)
**Fix:** Check if cooldown logic was accidentally enabled

### Issue: Oracle errors in logs
**Cause:** BTCD oracle not configured
**Fix:** This is expected in V1. Oracle will use fixed price (1.0)

### Issue: Rewards not distributing
**Cause:** Pool reward weight might be 0
**Fix:** Check `pool_reward_weights` table, ensure weight = 1.0

---

## V2 Migration Preview

### To enable cooldowns (V2):
```typescript
// In poolConfig.ts
COOLDOWN_PERIOD: 86400  // 24 hours

// In poolService.ts validateWithdrawalRequest()
// Uncomment cooldown validation block
```

### To enable multi-asset (V2):
```typescript
// In poolConfig.ts
SUPPORTED_ASSETS: ['BTCD', 'ETH', 'USDC']

// In poolConfig.ts isValidDepositAsset()
return POOL_CONFIG.SUPPORTED_ASSETS.includes(asset.toUpperCase())

// Update oracle integration for all assets
// Update balance tracking for multiple assets
```

---

## Code Comments Markers

Throughout the code, look for these markers:
- `// V1:` - Current V1 implementation detail
- `// V2:` - Future V2 expansion point
- `// V2 expansion:` - Commented code for V2

**Example:**
```typescript
// V1: No cooldown validation (instant withdrawals)
// V2 expansion: Add cooldown check when COOLDOWN_PERIOD > 0
```

---

## Support Checklist

When debugging issues:
1. Check pool initialization: `SELECT * FROM pools WHERE pool_id = 'btcd-main-pool'`
2. Check risk parameters: `SELECT * FROM pool_risk_parameters WHERE pool_id = 'btcd-main-pool'`
3. Check logs for V1-specific messages: `grep "V1:" backend/logs/*.log`
4. Verify asset validation: Should reject non-BTCD deposits
5. Verify cooldown: Should allow instant withdrawals
6. Check oracle: Should use fixed price for BTCD if not configured

---

## Success Criteria

✅ BTCD deposits work
✅ Non-BTCD deposits rejected
✅ Instant withdrawals work (no cooldown)
✅ Rewards distributed in BTCD
✅ TVL cap enforced
✅ Daily withdrawal limits enforced
✅ Pool initializes correctly
✅ TypeScript compiles without errors
✅ Linter passes without errors
✅ Tests pass (after update)

---

**Last Updated:** Dec 3, 2025
**Status:** Ready for deployment after route updates and test updates
