# BTCD Pool v1 Specification

**Version**: 1.0  
**Date**: 2025-12-03  
**Status**: Implementation Phase

---

## 1. Overview

BTCD Pool v1 is a **single-asset staking system** for the VIDDHANA platform:

- **Pool ID**: `btcd-main-pool`
- **Deposit Asset**: BTCD (ERC-20, 18 decimals)
- **Reward Asset**: BTCD (same token)
- **Lockup**: None (instant deposits and withdrawals)
- **Min Withdraw Threshold**: 100 BTCD (configurable)

Users deposit BTCD into the pool, earn BTCD rewards over time, and can withdraw their deposits + rewards anytime once they meet the minimum threshold.

---

## 2. System Architecture

### 2.1. Components

```
┌─────────────────────────────────────────────────────────────┐
│                        BTCD Pool v1                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐ │
│  │   Frontend   │─────▶│   Backend    │─────▶│ Database │ │
│  │   (web/admin)│      │   REST API   │      │ (Postgres)│ │
│  └──────────────┘      └──────────────┘      └──────────┘ │
│                              │                             │
│                              │                             │
│                        ┌─────▼──────┐                      │
│                        │  Contract  │                      │
│                        │  (Pool.sol)│                      │
│                        └────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

        Backend Workers:
        ├── Reward Cron (every 1-5 min)
        └── Withdrawal Worker (queue)
```

### 2.2. Data Flow

**Deposit Flow:**
1. User calls `POST /api/pool/deposit` with amount
2. Backend validates: amount > 0, user exists
3. Backend calls `Pool.deposit(amount)` on-chain
4. Contract emits `Deposited` event
5. Backend updates `pool_positions` table

**Reward Flow:**
1. Cron job runs every N minutes
2. For each user in pool: `reward = (userStake / totalStake) * REWARD_PER_INTERVAL`
3. Update `pending_balance` and `total_earned` in DB
4. (Optional) emit reward event for audit

**Withdrawal Flow:**
1. User calls `POST /api/pool/withdraw` with amount
2. Backend validates: amount >= MIN_THRESHOLD, amount <= pending_balance
3. Backend creates `withdrawals` row with status `pending`
4. Backend decreases user `pending_balance` atomically
5. Withdrawal worker picks `pending` rows
6. Worker sends BTCD from admin wallet to user on-chain
7. On success: update `status = completed`, save `tx_hash`
8. On failure: restore `pending_balance`, mark `status = failed`

---

## 3. Database Schema

### 3.1. Core Tables

#### `miners` / `users` (existing, reuse)
```sql
CREATE TABLE IF NOT EXISTS miners (
  miner_id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) UNIQUE NOT NULL,
  total_earned NUMERIC(38,18) DEFAULT 0,    -- lifetime BTCD rewards from pool
  pending_balance NUMERIC(38,18) DEFAULT 0,  -- claimable BTCD balance
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `pool_positions` (new)
```sql
CREATE TABLE IF NOT EXISTS pool_positions (
  position_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES miners(miner_id) ON DELETE CASCADE,
  pool_id VARCHAR(64) NOT NULL DEFAULT 'btcd-main-pool',
  staked_amount NUMERIC(38,18) NOT NULL DEFAULT 0,  -- BTCD deposited
  shares NUMERIC(38,18) NOT NULL DEFAULT 0,         -- shares owned (if using vault model)
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, pool_id)
);

CREATE INDEX pool_positions_user_idx ON pool_positions(user_id);
CREATE INDEX pool_positions_pool_idx ON pool_positions(pool_id);
```

#### `withdrawals` (new)
```sql
CREATE TABLE IF NOT EXISTS withdrawals (
  withdrawal_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES miners(miner_id) ON DELETE CASCADE,
  pool_id VARCHAR(64) NOT NULL DEFAULT 'btcd-main-pool',
  amount NUMERIC(38,18) NOT NULL,                   -- BTCD amount to withdraw
  wallet_address VARCHAR(66) NOT NULL,              -- recipient address
  status VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending | processing | completed | failed
  tx_hash VARCHAR(66),                              -- on-chain transaction hash
  error_message TEXT,                               -- error details if failed
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX withdrawals_user_idx ON withdrawals(user_id);
CREATE INDEX withdrawals_status_idx ON withdrawals(status);
CREATE INDEX withdrawals_requested_idx ON withdrawals(requested_at);
```

#### `pool_config` (new, optional)
```sql
CREATE TABLE IF NOT EXISTS pool_config (
  pool_id VARCHAR(64) PRIMARY KEY DEFAULT 'btcd-main-pool',
  deposit_asset VARCHAR(64) NOT NULL DEFAULT 'BTCD',
  reward_asset VARCHAR(64) NOT NULL DEFAULT 'BTCD',
  min_withdraw_threshold NUMERIC(38,18) DEFAULT 100,  -- 100 BTCD minimum
  reward_per_minute NUMERIC(38,18) DEFAULT 24,        -- 24 BTCD per minute (example)
  tvl NUMERIC(38,18) DEFAULT 0,                       -- total value locked
  status VARCHAR(20) DEFAULT 'active',                -- active | paused
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (status IN ('active', 'paused'))
);
```

### 3.2. Simplified Schema (No Risk Engine, No Oracle for v1)

v1 **does not** use:
- `oracle_price_cache`, `oracle_alerts` (oracle optional for v1)
- `pool_risk_parameters`, `circuit_breaker_status`, `risk_violations` (risk optional for v1)
- `pool_reward_epochs`, `pool_reward_weights` (epoch-based distribution optional, can use simple cron)

These can be added in v2 if needed.

---

## 4. Smart Contract

### 4.1. Pool.sol (Minimal)

**Existing contract** in `contracts/pools/Pool.sol` can be reused, but for v1 we simplify:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BTCDPool
 * @notice Minimal single-asset staking pool for BTCD v1
 * @dev Users deposit BTCD, earn BTCD rewards, withdraw anytime (no lockup)
 */
contract BTCDPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable btcdToken;
    uint256 public totalStaked;
    mapping(address => uint256) public userStaked;

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp);

    constructor(address _btcdToken) {
        require(_btcdToken != address(0), "Invalid BTCD token");
        btcdToken = IERC20(_btcdToken);
    }

    /**
     * @notice Deposit BTCD into the pool
     * @param amount Amount of BTCD to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        
        // Transfer BTCD from user to pool
        btcdToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update state
        userStaked[msg.sender] += amount;
        totalStaked += amount;
        
        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Withdraw BTCD from the pool
     * @param amount Amount of BTCD to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(userStaked[msg.sender] >= amount, "Insufficient balance");
        
        // Update state
        userStaked[msg.sender] -= amount;
        totalStaked -= amount;
        
        // Transfer BTCD back to user
        btcdToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Get user's staked balance
     * @param user Address to query
     * @return Staked BTCD amount
     */
    function balanceOf(address user) external view returns (uint256) {
        return userStaked[user];
    }

    /**
     * @notice Pause deposits (admin only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause deposits (admin only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
```

**Key Differences from existing Pool.sol:**
- No shares/vault model (direct balance tracking)
- No cooldown logic
- No risk engine integration (v1 simplification)
- No reward distributor on-chain (rewards handled off-chain)

**Reuse Option**: If existing `Pool.sol` is already deployed and working, keep it. Just ensure:
- `withdrawalCooldown = 0`
- Only BTCD token is used
- Deposit/withdraw functions work as expected

---

## 5. Backend Services

### 5.1. Pool Service

**File**: `backend/src/services/poolService.ts`

**Functions**:
- `getPoolInfo(poolId)` - Returns TVL, status, config
- `getUserPosition(userId, poolId)` - Returns staked amount, pending rewards
- `syncPoolState()` - Reads on-chain pool state and updates DB
- `validateDeposit(userId, amount)` - Validates deposit request
- `validateWithdrawal(userId, amount)` - Validates withdrawal request

**Implementation Notes**:
- Simplify existing `poolService.ts` to remove cooldown checks
- Remove oracle and risk service dependencies for v1
- Focus on core TVL tracking and user position queries

### 5.2. Reward Engine

**File**: `backend/src/services/rewardEngine.ts` (new or refactor existing)

**Purpose**: Calculate and distribute BTCD rewards to pool users.

**Logic**:
```typescript
async function distributePoolRewards() {
  const poolId = 'btcd-main-pool';
  const config = await getPoolConfig(poolId);
  const rewardPerMinute = config.reward_per_minute; // e.g., 24 BTCD

  // Get all users with non-zero stake
  const positions = await db.query(
    'SELECT user_id, staked_amount FROM pool_positions WHERE pool_id = $1 AND staked_amount > 0',
    [poolId]
  );

  if (positions.rows.length === 0) return;

  const totalStake = positions.rows.reduce((sum, p) => sum + parseFloat(p.staked_amount), 0);

  // Calculate reward per user
  for (const position of positions.rows) {
    const userStake = parseFloat(position.staked_amount);
    const userReward = (userStake / totalStake) * rewardPerMinute;

    // Update pending_balance and total_earned atomically
    await db.query(
      `UPDATE miners SET 
        pending_balance = pending_balance + $1,
        total_earned = total_earned + $1
      WHERE miner_id = $2`,
      [userReward, position.user_id]
    );
  }

  console.log(`Distributed ${rewardPerMinute} BTCD rewards to ${positions.rows.length} users`);
}
```

**Cron Job**: `backend/src/tasks/poolRewardCron.ts`
```typescript
import cron from 'node-cron';
import { distributePoolRewards } from '../services/rewardEngine';

// Run every 5 minutes: '*/5 * * * *'
cron.schedule('*/5 * * * *', async () => {
  try {
    await distributePoolRewards();
  } catch (err) {
    console.error('Pool reward distribution failed:', err);
  }
});
```

### 5.3. Withdrawal Service

**File**: `backend/src/services/withdrawalService.ts` (refactor existing)

**Functions**:
- `requestWithdrawal(userId, poolId, amount)` - Create withdrawal request
- `processWithdrawals()` - Worker that picks pending withdrawals
- `sendBTCDTransfer(toAddress, amount)` - Send BTCD on-chain

**Logic**:
```typescript
async function requestWithdrawal(userId: number, poolId: string, amount: number) {
  const config = await getPoolConfig(poolId);
  const user = await getUser(userId);

  // Validate
  if (amount < config.min_withdraw_threshold) {
    throw new Error(`Minimum withdrawal is ${config.min_withdraw_threshold} BTCD`);
  }
  if (amount > user.pending_balance) {
    throw new Error(`Insufficient balance. Available: ${user.pending_balance} BTCD`);
  }

  // Atomic transaction
  await db.transaction(async (client) => {
    // Decrease pending_balance
    await client.query(
      'UPDATE miners SET pending_balance = pending_balance - $1 WHERE miner_id = $2',
      [amount, userId]
    );

    // Create withdrawal record
    await client.query(
      `INSERT INTO withdrawals (user_id, pool_id, amount, wallet_address, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, poolId, amount, user.wallet_address]
    );
  });

  return { success: true, message: 'Withdrawal request created' };
}

async function processWithdrawals() {
  const pending = await db.query(
    `SELECT withdrawal_id, user_id, amount, wallet_address 
     FROM withdrawals WHERE status = 'pending' LIMIT 10`
  );

  for (const row of pending.rows) {
    try {
      // Mark as processing
      await db.query(
        'UPDATE withdrawals SET status = $1 WHERE withdrawal_id = $2',
        ['processing', row.withdrawal_id]
      );

      // Send BTCD on-chain
      const txHash = await sendBTCDTransfer(row.wallet_address, row.amount);

      // Mark as completed
      await db.query(
        'UPDATE withdrawals SET status = $1, tx_hash = $2, completed_at = NOW() WHERE withdrawal_id = $3',
        ['completed', txHash, row.withdrawal_id]
      );
    } catch (err) {
      // Restore balance and mark as failed
      await db.transaction(async (client) => {
        await client.query(
          'UPDATE miners SET pending_balance = pending_balance + $1 WHERE miner_id = $2',
          [row.amount, row.user_id]
        );
        await client.query(
          'UPDATE withdrawals SET status = $1, error_message = $2 WHERE withdrawal_id = $3',
          ['failed', err.message, row.withdrawal_id]
        );
      });
    }
  }
}
```

**Cron Job**: `backend/src/tasks/withdrawalWorker.ts`
```typescript
import cron from 'node-cron';
import { processWithdrawals } from '../services/withdrawalService';

// Run every 1 minute: '* * * * *'
cron.schedule('* * * * *', async () => {
  try {
    await processWithdrawals();
  } catch (err) {
    console.error('Withdrawal processing failed:', err);
  }
});
```

---

## 6. REST API

### 6.1. Pool Info Endpoint

**GET `/api/pool/info/:poolId`**

Query parameters: none  
Response:
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

### 6.2. User Position Endpoint

**GET `/api/pool/user/:walletAddress`**

Query parameters:
- `poolId` (optional, default: `btcd-main-pool`)

Response:
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

### 6.3. Withdraw Endpoint

**POST `/api/pool/withdraw`**

Request body:
```json
{
  "wallet_address": "0x1234...",
  "pool_id": "btcd-main-pool",
  "amount": "150.0"
}
```

Response:
```json
{
  "success": true,
  "message": "Withdrawal request created",
  "withdrawal_id": 123,
  "status": "pending",
  "estimated_completion": "5-10 minutes"
}
```

Error response:
```json
{
  "success": false,
  "error": "Insufficient balance. Available: 50 BTCD"
}
```

---

## 7. Configuration

### 7.1. Environment Variables

**.env**:
```bash
# Pool v1 Config
BTCD_TOKEN_ADDRESS=0x...
BTCD_POOL_CONTRACT_ADDRESS=0x...
POOL_REWARD_PER_MINUTE=24
MIN_WITHDRAW_THRESHOLD=100
ADMIN_WALLET_PRIVATE_KEY=0x...
```

### 7.2. Database Seed

Insert initial pool config:
```sql
INSERT INTO pool_config (pool_id, deposit_asset, reward_asset, min_withdraw_threshold, reward_per_minute, status)
VALUES ('btcd-main-pool', 'BTCD', 'BTCD', 100, 24, 'active');
```

---

## 8. Testing Checklist

### 8.1. Contract Tests
- [ ] Deposit BTCD successfully
- [ ] Withdraw BTCD successfully
- [ ] Reject deposit when paused
- [ ] Reject withdraw with insufficient balance
- [ ] Emit correct events

### 8.2. Backend Tests
- [ ] Pool info API returns correct data
- [ ] User position API returns staked amount and pending rewards
- [ ] Withdraw API validates minimum threshold
- [ ] Withdraw API validates balance
- [ ] Reward engine distributes correctly (proportional to stake)
- [ ] Withdrawal worker processes pending withdrawals
- [ ] Withdrawal worker restores balance on failure

### 8.3. Integration Tests
- [ ] Full deposit → earn rewards → withdraw flow
- [ ] Multiple users receive proportional rewards
- [ ] Withdrawal below threshold is rejected
- [ ] Withdrawal above balance is rejected

---

## 9. Deployment Steps

1. **Deploy BTCD Pool Contract**:
   ```bash
   cd contracts
   BTCD_TOKEN_ADDRESS=0x... npx hardhat run scripts/deployPool.js --network testnet
   ```

2. **Run Database Migration**:
   ```bash
   cd backend
   npx node-pg-migrate up
   ```

3. **Seed Pool Config**:
   ```bash
   psql $DATABASE_URL -c "INSERT INTO pool_config (...) VALUES (...);"
   ```

4. **Start Backend with Cron Jobs**:
   ```bash
   cd backend
   npm run dev
   ```

5. **Fund Admin Wallet** with BTCD for withdrawals

6. **Test Deposit/Withdraw Flow**

---

## 10. v2 Expansion Points

Future features (not in v1):
- Multi-asset pools (ETH, USDC, etc.)
- Cooldown periods (e.g., 24-hour cooldown)
- Lockup tiers with APY bonuses
- On-chain reward distributor (MasterChef-style)
- Oracle integration for USD pricing
- Risk engine with TVL caps
- Admin panel UI for pool management
- Analytics dashboard

---

## 11. Open Questions / TODOs

- [ ] What is the exact BTCD token address?
- [ ] What should `POOL_REWARD_PER_MINUTE` be? (Product decision)
- [ ] Should we use shares/vault model or direct balance tracking?
- [ ] Do we need on-chain reward distribution or is off-chain OK for v1?
- [ ] Should deposits require approval first or auto-approve?
- [ ] What is the admin wallet for withdrawals?

---

**End of Specification**
