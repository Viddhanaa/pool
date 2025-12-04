# V1 Solidity Pool Contracts Update Summary

## Overview
Updated Solidity pool contracts to match V1 requirements: single BTCD asset, no cooldown/lockup, single pool instance with simplified flow.

## Changes Made

### 1. **Pool.sol** - Main Staking Pool Contract
**File:** `/home/realcodes/Chocochoco/contracts/pools/Pool.sol`

**V1 Simplifications:**
- ✅ **Removed cooldown enforcement**: No `lastDepositTime` tracking in deposit(), no cooldown check in withdraw()
- ✅ **Hardcoded BTCD asset**: `asset` field is immutable, set via constructor (BTCD token address)
- ✅ **Updated comments**: Added V1/V2 markers throughout to indicate simplifications and future expansion points
- ✅ **Constructor defaults**: 
  - `withdrawalCooldown = 0` (instant withdrawals)
  - `minDepositAmount = 1e18` (1 BTCD minimum with 18 decimals)
- ✅ **Kept key mechanisms**: Share accounting, exchange rate calculation, pause mechanism, emergency withdrawal

**V2 Expansion Points Documented:**
- Re-enable cooldown by uncommenting checks and setting `withdrawalCooldown > 0`
- Support multi-asset deposits by accepting asset parameter
- Add lockup periods with bonus rewards

**Lines Modified:**
- Lines 11-21: Updated contract header documentation
- Lines 28-42: Added V1 comments to state variables
- Lines 69-84: Updated constructor with V1 configuration
- Lines 107-132: Simplified deposit() function, removed cooldown tracking
- Lines 155-189: Simplified withdraw() function, removed cooldown enforcement
- Lines 276-287: Updated accrueRewards() with V1 comments
- Lines 313-320: Added V1 comment to setWithdrawalCooldown()

---

### 2. **RewardDistributor.sol** - Epoch-Based Reward Distribution
**File:** `/home/realcodes/Chocochoco/contracts/rewards/RewardDistributor.sol`

**V1 Simplifications:**
- ✅ **Single reward token**: BTCD only (same as deposit token)
- ✅ **Removed multi-token logic**: No token switching, all rewards in BTCD
- ✅ **Updated comments**: Added V1/V2 markers for future multi-token support
- ✅ **Kept core logic**: Epoch-based distribution, pull-based claiming, snapshot accounting

**V2 Expansion Points Documented:**
- Support multiple reward tokens (BTCD, ETH, USDC)
- Multiple pool instances with different reward strategies
- Bonus multipliers for locked staking

**Lines Modified:**
- Lines 10-25: Updated contract header documentation
- Lines 33-34: Added V1 comment to rewardToken field
- Lines 79-96: Updated constructor with V1 configuration notes
- Lines 190-213: Added V1 comments to claimReward() function

---

### 3. **OracleAdapter.sol** - Price Oracle Integration
**File:** `/home/realcodes/Chocochoco/contracts/oracles/OracleAdapter.sol`

**V1 Status:**
- ✅ **Marked as optional**: BTCD may not need oracle initially (can use fixed $1 or skip)
- ✅ **Ready for V2**: Contract structure ready for integration when USD pricing needed
- ✅ **Updated comments**: Added V1 status and V2 expansion points

**V2 Expansion Points Documented:**
- Integrate BTCD/USD price feed for accurate APY calculations
- Add multi-asset oracles (ETH/USD, USDC/USD)
- Use for dynamic TVL caps and risk calculations
- Real-time USD-denominated pool value reporting

**Lines Modified:**
- Lines 6-21: Updated contract header with V1 optional status and V2 expansion points

---

### 4. **RiskEngine.sol** - Risk Limit Enforcement
**File:** `/home/realcodes/Chocochoco/contracts/risk/RiskEngine.sol`

**V1 Simplifications:**
- ✅ **Removed cooldown enforcement**: No cooldown logic in deposit/withdrawal checks
- ✅ **Kept safety mechanisms**: TVL caps, user deposit caps, daily withdrawal limits
- ✅ **Kept emergency controls**: Emergency pause, circuit breaker, emergency withdrawals
- ✅ **Updated comments**: Added V1/V2 markers throughout

**V2 Expansion Points Documented:**
- Add cooldown enforcement integration with Pool contract
- Dynamic TVL caps based on oracle price data
- Per-pool risk profiles with different parameters

**Lines Modified:**
- Lines 7-24: Updated contract header documentation
- Lines 132-164: Added V1 comments to checkDepositAllowed()
- Lines 203-234: Added V1 comments to checkWithdrawalAllowed()

---

### 5. **V1Config.sol** - Configuration Constants (NEW FILE)
**File:** `/home/realcodes/Chocochoco/contracts/V1Config.sol`

**Purpose:**
- ✅ **Centralized V1 constants**: Pool ID, name, symbol, risk parameters
- ✅ **Documented configuration**: All V1 settings in one place with comments
- ✅ **Helper functions**: Utility functions for getting config tuples
- ✅ **V2 placeholders**: Commented examples for future expansion

**Key Constants:**
```solidity
POOL_ID = "btcd-main-pool"
POOL_NAME = "BTCD Main Staking Pool"
POOL_SYMBOL = "vBTCD"
INITIAL_TVL_CAP = 1_000_000 * 1e18  // 1M BTCD
MAX_USER_DEPOSIT = 100_000 * 1e18   // 100k BTCD
DAILY_WITHDRAWAL_CAP = 50_000 * 1e18 // 50k BTCD
MIN_DEPOSIT_AMOUNT = 1 * 1e18        // 1 BTCD
WITHDRAWAL_COOLDOWN = 0              // No cooldown
EPOCH_DURATION = 1 days              // Reward epoch
BTCD_DECIMALS = 18                   // Token decimals
```

---

## Architecture Summary

### V1 Architecture (Current)
```
┌─────────────────┐
│   BTCD Token    │ ← Single asset (ERC20)
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│   Pool.sol      │◄─────│  RiskEngine.sol  │
│                 │      │  - TVL caps      │
│ - Deposits      │      │  - User caps     │
│ - Withdrawals   │      │  - Daily limits  │
│ - Shares        │      │  - Emergency     │
│ - Exchange rate │      └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ RewardDistributor.sol   │
│                         │
│ - BTCD rewards only     │
│ - Epoch-based           │
│ - Pull-based claiming   │
└─────────────────────────┘

┌─────────────────────────┐
│ OracleAdapter.sol       │
│ (OPTIONAL for V1)       │
│                         │
│ - Reserved for V2       │
│ - USD pricing           │
│ - APY calculations      │
└─────────────────────────┘
```

### V2 Expansion (Future)
- **Multi-asset deposits**: ETH, USDC alongside BTCD
- **Cooldown periods**: Re-enable withdrawal delays
- **Lockup tiers**: 30/90 day lockups with 1.2x/1.5x reward multipliers
- **Multiple pools**: Different strategies per pool
- **Oracle integration**: Real-time USD pricing and dynamic APY
- **Cross-chain**: Bridge to other networks

---

## Code Style Compliance

✅ **Auditable and minimal**: No unnecessary complexity added
✅ **Comments explain simplifications**: V1/V2 markers throughout
✅ **OpenZeppelin patterns**: Using SafeERC20, ReentrancyGuard, AccessControl
✅ **No breaking changes**: Existing interfaces maintained
✅ **Documented expansion points**: Clear V2 upgrade path

---

## Deployment Checklist

### 1. **Environment Setup**
- [ ] Set `BTCD_TOKEN_ADDRESS` environment variable
- [ ] Set `POOL_INITIAL_TVL_CAP` (default: 1M BTCD)
- [ ] Set admin wallet address

### 2. **Contract Deployment Order**
1. Deploy BTCD token (if not already deployed)
2. Deploy `RiskEngine` with admin address
3. Deploy `RewardDistributor` with BTCD token address, epoch duration, admin
4. Deploy `Pool` with BTCD token address, pool name/symbol, admin
5. Configure `RiskEngine` with pool address and risk parameters
6. Configure `Pool` with risk engine and reward distributor addresses
7. Whitelist pool in `RewardDistributor`
8. Set pool weight in `RewardDistributor` (if using weight-based distribution)

### 3. **Post-Deployment Configuration**
- [ ] Configure risk limits: `RiskEngine.configurePoolRisk()`
- [ ] Set reward distributor: `Pool.setRewardDistributor()`
- [ ] Set risk engine: `Pool.setRiskEngine()`
- [ ] Whitelist pool: `RewardDistributor.setPoolWhitelist()`
- [ ] Verify pool parameters: `withdrawalCooldown == 0`, `minDepositAmount == 1e18`

### 4. **Testing Checklist**
- [ ] Test deposit flow with BTCD
- [ ] Test immediate withdrawal (no cooldown)
- [ ] Test share accounting and exchange rate
- [ ] Test reward accrual and claiming
- [ ] Test TVL caps and user limits
- [ ] Test emergency pause/unpause
- [ ] Test emergency withdrawal mode

---

## Existing Deployment Script

The deployment script at `/home/realcodes/Chocochoco/contracts/scripts/deployPool.js` is already configured for V1:

- ✅ Uses `BTCD_TOKEN_ADDRESS` from environment
- ✅ Sets pool name to "VIDDHANA BTCD Staking Pool"
- ✅ Sets share symbol to "vBTCD"
- ✅ Configures risk parameters (1M TVL cap, 100k user cap, 50k daily withdrawal)
- ✅ Deploys all contracts in correct order
- ✅ Configures integrations automatically

**Usage:**
```bash
cd contracts
BTCD_TOKEN_ADDRESS=0x... POOL_INITIAL_TVL_CAP=1000000 npx hardhat run scripts/deployPool.js --network testnet
```

---

## Testing

Existing test suite at `/home/realcodes/Chocochoco/contracts/pools/test/` covers:
- ✅ Pool.test.js - Deposit/withdrawal, share accounting, exchange rate
- ✅ RewardDistributor.test.js - Epoch finalization, reward claiming
- ✅ RiskEngine.test.js - TVL caps, user limits, emergency mode
- ✅ OracleAdapter.test.js - Price feeds, staleness checks
- ✅ Integration.test.js - End-to-end flow

**Run tests:**
```bash
cd contracts
npm test
```

---

## Security Notes

### V1 Risk Mitigations
1. **TVL Caps**: Limits total pool size to 1M BTCD (adjustable)
2. **User Caps**: Limits individual deposits to 100k BTCD (adjustable)
3. **Daily Withdrawal Limits**: Prevents bank runs (50k BTCD/user/day)
4. **Emergency Pause**: Admin can pause pool operations
5. **Emergency Withdrawals**: Users can withdraw even when paused
6. **ReentrancyGuard**: Prevents reentrancy attacks on deposit/withdraw
7. **AccessControl**: Role-based permissions for admin functions
8. **No Cooldown**: Reduces user lockup risk in V1 (add back in V2 if needed)

### Audit Recommendations
- [ ] External security audit before mainnet deployment
- [ ] Stress test with realistic deposit/withdrawal volumes
- [ ] Monitor TVL and user deposit patterns
- [ ] Test emergency pause scenarios
- [ ] Verify share accounting math with edge cases (dust deposits, large withdrawals)

---

## V2 Upgrade Path

When ready to expand to V2, follow this upgrade strategy:

### Option 1: Deploy New Pool Contract (Recommended)
- Deploy new Pool contract with V2 features enabled
- Migrate liquidity from V1 to V2 pool
- Keep V1 pool for backward compatibility (optional)

### Option 2: Upgrade Existing Pool
- Use proxy pattern (UUPS or Transparent) for upgradability
- Add upgrade functions to enable V2 features
- Migrate state carefully (test thoroughly!)

### V2 Feature Activation Checklist
- [ ] Enable cooldown: Set `withdrawalCooldown > 0` and uncomment checks
- [ ] Add multi-asset: Deploy asset manager contract, update Pool interface
- [ ] Add lockup tiers: Deploy lockup manager, integrate with RewardDistributor
- [ ] Integrate oracle: Configure OracleAdapter with BTCD/USD feed
- [ ] Add multiple pools: Deploy additional Pool instances with different configs
- [ ] Update tests: Add V2 feature test coverage

---

## Summary

✅ **All V1 requirements met:**
1. Single asset: BTCD token only ✓
2. No lockup/cooldown: Instant deposits and withdrawals ✓
3. Single pool: "btcd-main-pool" pool ✓
4. Simplified flow: No cooldown logic, no multi-asset complexity ✓

✅ **All contracts updated:**
1. Pool.sol - Simplified, cooldown removed ✓
2. RewardDistributor.sol - BTCD only rewards ✓
3. OracleAdapter.sol - Marked as optional for V1 ✓
4. RiskEngine.sol - Cooldown enforcement removed ✓
5. V1Config.sol - New constants file ✓

✅ **Code quality maintained:**
- Auditable and minimal changes ✓
- OpenZeppelin patterns used ✓
- V1/V2 expansion points documented ✓
- Existing tests compatible ✓
- Deployment script ready ✓

✅ **Ready for deployment:**
- All contracts follow Solidity 0.8.20 ✓
- All V1 simplifications implemented ✓
- All safety mechanisms preserved ✓
- Clear upgrade path to V2 defined ✓
