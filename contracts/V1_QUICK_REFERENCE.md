# V1 Solidity Contracts - Quick Reference

## Files Modified

```
contracts/
├── pools/
│   └── Pool.sol ✓ UPDATED
│       - Removed cooldown tracking in deposit()
│       - Removed cooldown enforcement in withdraw()
│       - Updated comments with V1/V2 markers
│       - Constructor sets withdrawalCooldown = 0
│       - Constructor sets minDepositAmount = 1e18 (1 BTCD)
│
├── rewards/
│   └── RewardDistributor.sol ✓ UPDATED
│       - Added V1 comments for single BTCD reward token
│       - Marked multi-token expansion points for V2
│
├── oracles/
│   └── OracleAdapter.sol ✓ UPDATED
│       - Marked as optional for V1
│       - Added V2 expansion points for USD pricing
│
├── risk/
│   └── RiskEngine.sol ✓ UPDATED
│       - Added V1 comments (no cooldown enforcement)
│       - Kept TVL caps and withdrawal limits
│
├── V1Config.sol ✓ NEW
│   - Constants: POOL_ID, POOL_NAME, POOL_SYMBOL
│   - Risk params: TVL caps, user limits, withdrawal caps
│   - Helper functions for config retrieval
│
└── V1_UPDATE_SUMMARY.md ✓ NEW
    - Complete change log
    - Deployment checklist
    - Testing guide
    - V2 upgrade path
```

## Key V1 Changes

### 1. No Cooldown Period
```solidity
// BEFORE (Multi-version)
withdrawalCooldown = 7 days;  // Configurable
lastDepositTime[msg.sender] = block.timestamp;
require(block.timestamp >= lastDepositTime[msg.sender] + withdrawalCooldown);

// AFTER (V1)
withdrawalCooldown = 0;  // Instant withdrawals
// lastDepositTime not updated
// No cooldown check in withdraw()
```

### 2. Single Asset (BTCD)
```solidity
// V1: Immutable BTCD asset
IERC20 public immutable asset;  // Set in constructor

// V2: Could support multiple assets
// mapping(address => bool) public supportedAssets;
```

### 3. Single Pool Instance
```solidity
// V1: One pool ID
POOL_ID = "btcd-main-pool"

// V2: Multiple pool IDs
// POOL_IDS = ["btcd-main", "btcd-locked", "multi-asset"]
```

### 4. Single Reward Token
```solidity
// V1: BTCD rewards only
IERC20 public immutable rewardToken;  // BTCD

// V2: Could support multiple reward tokens
// mapping(address => IERC20) public rewardTokens;
```

## V1 Configuration

```solidity
// From V1Config.sol
POOL_ID = "btcd-main-pool"
POOL_NAME = "BTCD Main Staking Pool"
POOL_SYMBOL = "vBTCD"

// Risk Parameters
INITIAL_TVL_CAP = 1_000_000 * 1e18      // 1M BTCD
MAX_USER_DEPOSIT = 100_000 * 1e18       // 100k BTCD per user
DAILY_WITHDRAWAL_CAP = 50_000 * 1e18    // 50k BTCD per user per day
MIN_DEPOSIT_AMOUNT = 1 * 1e18           // 1 BTCD minimum

// Timing
WITHDRAWAL_COOLDOWN = 0                  // Instant withdrawals
EPOCH_DURATION = 1 days                  // Daily reward epochs

// Token
BTCD_DECIMALS = 18
```

## Contract Interactions

```
┌─────────────────────────────────────────────┐
│            USER OPERATIONS (V1)             │
└─────────────────────────────────────────────┘

1. DEPOSIT BTCD
   ┌──────┐
   │ User │ → deposit(100 BTCD)
   └──┬───┘
      ↓
   ┌──────────────┐
   │  Pool.sol    │
   ├──────────────┤
   │ ✓ Check > 1 BTCD minimum
   │ ✓ Check risk limits
   │ ✓ Mint shares
   │ ✗ NO cooldown tracking
   └──┬───────────┘
      ↓
   ┌──────────────────┐
   │ RiskEngine.sol   │
   ├──────────────────┤
   │ ✓ Check TVL cap
   │ ✓ Check user cap
   │ ✗ NO cooldown check
   └──────────────────┘

2. WITHDRAW BTCD (INSTANT)
   ┌──────┐
   │ User │ → withdraw(50 shares)
   └──┬───┘
      ↓
   ┌──────────────┐
   │  Pool.sol    │
   ├──────────────┤
   │ ✓ Burn shares
   │ ✓ Check risk limits
   │ ✓ Transfer BTCD
   │ ✗ NO cooldown check
   └──┬───────────┘
      ↓
   ┌──────────────────┐
   │ RiskEngine.sol   │
   ├──────────────────┤
   │ ✓ Check daily cap
   │ ✗ NO cooldown check
   └──────────────────┘

3. CLAIM REWARDS
   ┌──────┐
   │ User │ → claimReward(epoch, pool)
   └──┬───┘
      ↓
   ┌─────────────────────┐
   │ RewardDistributor   │
   ├─────────────────────┤
   │ ✓ Check epoch finalized
   │ ✓ Transfer BTCD rewards
   │ ✗ Only BTCD supported
   └─────────────────────┘
```

## Deployment Quick Start

```bash
# 1. Set environment variables
export BTCD_TOKEN_ADDRESS=0x...
export POOL_INITIAL_TVL_CAP=1000000
export ADMIN_ADDRESS=0x...

# 2. Deploy contracts
cd contracts
npx hardhat run scripts/deployPool.js --network testnet

# 3. Run tests
npm test

# 4. Verify on block explorer
npx hardhat verify --network testnet <POOL_ADDRESS> \
  <BTCD_TOKEN_ADDRESS> \
  "BTCD Main Staking Pool" \
  "vBTCD" \
  <ADMIN_ADDRESS>
```

## Testing Quick Commands

```bash
# Test individual contracts
npx vitest run src/pools/Pool.test.js
npx vitest run src/rewards/RewardDistributor.test.js
npx vitest run src/risk/RiskEngine.test.js

# Test integration
npx vitest run src/pools/Integration.test.js

# Test all
npm test
```

## V2 Upgrade Preview

When ready to upgrade to V2, enable these features:

```solidity
// 1. Enable cooldown
withdrawalCooldown = 7 days;  // Set via setWithdrawalCooldown()

// 2. Uncomment in deposit()
lastDepositTime[msg.sender] = block.timestamp;

// 3. Uncomment in withdraw()
require(
    block.timestamp >= lastDepositTime[msg.sender] + withdrawalCooldown,
    "Pool: cooldown not elapsed"
);

// 4. Deploy multi-asset support
// Deploy new Pool contracts for ETH, USDC
// Update RewardDistributor to handle multiple reward tokens

// 5. Add lockup tiers
// Deploy lockup manager contract
// Integrate with reward multipliers
```

## Support

- **Architecture Docs**: `/home/realcodes/Chocochoco/docs/`
- **Test Suite**: `/home/realcodes/Chocochoco/contracts/pools/test/`
- **Deployment Script**: `/home/realcodes/Chocochoco/contracts/scripts/deployPool.js`
- **Backend Integration**: `/home/realcodes/Chocochoco/backend/src/config/poolConfig.ts`

For issues or questions about V1 implementation, refer to:
1. `V1_UPDATE_SUMMARY.md` - Complete change log
2. `V1Config.sol` - Configuration constants
3. Contract inline comments - V1/V2 markers throughout
