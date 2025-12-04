# BTCD Pool v1 - Implementation Complete

## Overview

This document summarizes the complete implementation of BTCD Pool v1, a minimal but production-ready staking pool for BTCD tokens.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BTCD Pool v1 System                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (User)                                             │
│       │                                                      │
│       ├─► 1. Call BTCDPool.deposit(amount)                  │
│       │   [On-chain: User → Contract]                       │
│       │                                                      │
│       └─► 2. POST /api/pool/btcd/deposit                    │
│           [Off-chain: Record deposit in DB]                 │
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │          Smart Contract Layer                │           │
│  │                                              │           │
│  │  BTCDPool.sol (contracts/BTCDPool.sol)      │           │
│  │  - deposit(amount)                          │           │
│  │  - withdraw(amount)                         │           │
│  │  - balanceOf(user)                          │           │
│  │  - pause() / unpause()                      │           │
│  └──────────────────────────────────────────────┘           │
│                      │                                      │
│  ┌──────────────────────────────────────────────┐           │
│  │          Backend Services                    │           │
│  │                                              │           │
│  │  btcdPoolService.ts                         │           │
│  │  - getPoolInfo()                            │           │
│  │  - getUserPosition()                        │           │
│  │  - recordDeposit()                          │           │
│  │                                              │           │
│  │  btcdPoolRewardEngine.ts                    │           │
│  │  - distributePoolRewards()                  │           │
│  │  [Cron: Every 5 minutes]                    │           │
│  │                                              │           │
│  │  btcdPoolWithdrawalService.ts               │           │
│  │  - requestWithdrawal()                      │           │
│  │  - processWithdrawals()                     │           │
│  │  [Cron: Every 1 minute]                     │           │
│  └──────────────────────────────────────────────┘           │
│                      │                                      │
│  ┌──────────────────────────────────────────────┐           │
│  │          Database (PostgreSQL)               │           │
│  │                                              │           │
│  │  pool_config      - Pool settings            │           │
│  │  pool_positions   - User stakes              │           │
│  │  pool_withdrawals - Withdrawal queue         │           │
│  │  miners           - User balances            │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components Delivered

### 1. Smart Contract

**File:** `contracts/contracts/BTCDPool.sol`

**Features:**
- Single-asset staking (BTCD only)
- Direct balance tracking (no shares/vault model)
- Instant deposits and withdrawals (no cooldown)
- Pausable deposits (admin emergency control)
- OpenZeppelin security: ReentrancyGuard, Pausable, Ownable, SafeERC20

**Key Functions:**
- `deposit(uint256 amount)` - Stake BTCD
- `withdraw(uint256 amount)` - Unstake BTCD (instant)
- `balanceOf(address user)` - Get user's staked balance
- `pause()` / `unpause()` - Admin controls
- `getTotalStaked()` - Get total TVL
- `isPaused()` - Check pause status

**Deployment Script:** `contracts/scripts/deployBTCDPool.js`

### 2. Backend Services

#### a. Pool Service
**File:** `backend/src/services/btcdPoolService.ts`

**Functions:**
- `getPoolInfo(poolId)` - Returns TVL, APR, APY, status
- `getUserPosition(walletAddress, poolId)` - Returns staked amount, pending rewards, total earned
- `recordDeposit(walletAddress, poolId, amount)` - Records deposit after on-chain transaction

#### b. Reward Engine
**File:** `backend/src/services/btcdPoolRewardEngine.ts`

**Functions:**
- `distributePoolRewards(poolId)` - Distributes rewards proportionally to all stakers

**Logic:**
```
For each user:
  reward = (userStake / totalStake) * rewardPerMinute
  Update: pending_balance += reward, total_earned += reward
```

**Cron:** Runs every 5 minutes (`*/5 * * * *`)

**Idempotency:** 4-minute minimum interval between runs to prevent double-counting

#### c. Withdrawal Service
**File:** `backend/src/services/btcdPoolWithdrawalService.ts`

**Functions:**
- `requestWithdrawal(userId, poolId, amount)` - Creates withdrawal request
- `processWithdrawals()` - Processes pending withdrawals (batch of 10)
- `sendBTCDTransfer(toAddress, amount)` - Sends BTCD on-chain

**Flow:**
1. User requests withdrawal
2. Atomically decrease `pending_balance` and create `pool_withdrawals` record
3. Worker picks up pending withdrawals
4. Send BTCD from admin wallet
5. On success: mark `completed` with `tx_hash`
6. On failure: restore `pending_balance`, mark `failed`

**Cron:** Runs every 1 minute (`* * * * *`)

### 3. REST API Endpoints

**File:** `backend/src/routes/pool.ts`

#### Read Endpoints (No Auth Required)

**GET /api/pool/btcd/info/:poolId?**
- Default poolId: `btcd-main-pool`
- Returns: TVL, APR, APY, status, min_withdraw_threshold

**GET /api/pool/btcd/user/:walletAddress?poolId=...**
- Returns: staked_amount, pending_rewards, total_earned, last_updated

#### Write Endpoints

**POST /api/pool/btcd/deposit**
- Body: `{ walletAddress, poolId, amount, txHash }`
- Records deposit after user calls contract.deposit()
- Rate limit: 20 req/min per wallet

**POST /api/pool/withdraw**
- Body: `{ address, poolId, amount, signature, timestamp, nonce }`
- Creates withdrawal request (queued for processing)
- Requires signature authentication
- Rate limit: 10 req/min per wallet

### 4. Database Schema

**File:** `infra/sql/migrations/007_btcd_pool_v1.sql`

#### Tables

**pool_config**
- `pool_id` (PK)
- `deposit_asset`, `reward_asset`
- `min_withdraw_threshold` (default: 100 BTCD)
- `reward_per_minute` (default: 24 BTCD)
- `tvl` (auto-updated via trigger)
- `status` (active | paused)

**pool_positions**
- `position_id` (PK)
- `user_id` (FK → miners)
- `pool_id`
- `staked_amount`
- `shares` (for future vault model)
- `last_updated`

**pool_withdrawals**
- `withdrawal_id` (PK)
- `user_id` (FK → miners)
- `pool_id`
- `amount`
- `wallet_address`
- `status` (pending | processing | completed | failed)
- `tx_hash`
- `error_message`

**miners** (existing, reused)
- `miner_id` (PK)
- `wallet_address`
- `total_earned` - lifetime BTCD earned from pool
- `pending_balance` - claimable BTCD balance

#### Triggers

**update_pool_tvl()** - Auto-updates TVL when pool_positions change

### 5. Cron Jobs

**File:** `backend/src/tasks/poolRewardCron.ts`
- Schedule: Every 5 minutes
- Action: `distributePoolRewards('btcd-main-pool')`
- Status: Auto-started in `scheduler.ts`

**File:** `backend/src/tasks/withdrawalWorker.ts`
- Schedule: Every 1 minute
- Action: `processWithdrawals()`
- Status: Auto-started in `scheduler.ts`

### 6. Tests

**Contract Tests:** `contracts/contracts/pools/test/BTCDPool.test.js`
- Deployment tests
- Deposit tests (success, errors, multiple users)
- Withdraw tests (success, errors, paused state)
- Admin function tests
- Security tests (reentrancy guards)

**Mock Token:** `contracts/contracts/test/MockERC20.sol`

## Deployment Instructions

### 1. Deploy Smart Contract

```bash
cd contracts

# Set environment variables
export BTCD_TOKEN_ADDRESS=0x...  # Address of BTCD token
export ADMIN_WALLET_ADDRESS=0x... # Optional, defaults to deployer

# Deploy to localhost
npx hardhat run scripts/deployBTCDPool.js --network localhost

# Deploy to testnet
npx hardhat run scripts/deployBTCDPool.js --network testnet

# Deploy to mainnet
npx hardhat run scripts/deployBTCDPool.js --network mainnet
```

**Output:**
- Contract address: `BTCD_POOL_CONTRACT_ADDRESS`
- Add to `backend/.env`

### 2. Setup Database

```bash
cd backend

# Run migration (creates pool tables)
npm run migrate

# Verify pool_config has btcd-main-pool entry
psql $DATABASE_URL -c "SELECT * FROM pool_config WHERE pool_id = 'btcd-main-pool';"
```

**Expected:**
- `pool_id`: `btcd-main-pool`
- `reward_per_minute`: `24` (adjustable)
- `min_withdraw_threshold`: `100`
- `status`: `active`

### 3. Configure Backend

**File:** `backend/.env`

```bash
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Blockchain
RPC_URL=https://...
BTCD_TOKEN_ADDRESS=0x...
BTCD_POOL_CONTRACT_ADDRESS=0x...  # From deployment
ADMIN_WALLET_ADDRESS=0x...
ADMIN_PRIVATE_KEY=0x...  # For sending withdrawals

# Pool Config
MIN_WITHDRAWAL_THRESHOLD=100  # BTCD
```

### 4. Fund Admin Wallet

The admin wallet needs BTCD to process withdrawals.

```bash
# Transfer BTCD to admin wallet
# Amount: Enough to cover pending withdrawals + buffer
```

### 5. Start Backend

```bash
cd backend

# Install dependencies
npm ci

# Start server
npm run dev  # Development
npm run build && npm start  # Production
```

**Verify:**
- Cron jobs started: Check logs for "BTCD Pool reward cron started"
- API accessible: `curl http://localhost:3000/api/pool/btcd/info`

### 6. Run Tests

```bash
# Contract tests
cd contracts
npx hardhat test

# Backend tests
cd backend
npm test
```

## Usage Flow

### For Users: Depositing BTCD

1. **Frontend calls smart contract:**
```javascript
// Approve BTCD
await btcdToken.approve(poolAddress, amount);

// Deposit
const tx = await btcdPool.deposit(amount);
await tx.wait();
```

2. **Frontend notifies backend:**
```javascript
await fetch('/api/pool/btcd/deposit', {
  method: 'POST',
  body: JSON.stringify({
    walletAddress: userAddress,
    poolId: 'btcd-main-pool',
    amount: amount.toString(),
    txHash: tx.hash
  })
});
```

3. **Backend records deposit in DB**

4. **Reward engine distributes rewards every 5 minutes**

### For Users: Withdrawing BTCD

1. **Call withdraw endpoint:**
```javascript
const response = await fetch('/api/pool/withdraw', {
  method: 'POST',
  body: JSON.stringify({
    address: userAddress,
    poolId: 'btcd-main-pool',
    amount: amount.toString(),
    signature: signature,
    timestamp: Date.now(),
    nonce: randomNonce()
  })
});

const { withdrawal_id, status } = await response.json();
```

2. **Backend creates withdrawal request**
- Status: `pending`
- Balance deducted immediately

3. **Withdrawal worker processes request (1-5 minutes)**
- Sends BTCD on-chain
- Updates status to `completed` with `tx_hash`

4. **User receives BTCD in wallet**

### For Admins: Pool Management

**Check pool status:**
```bash
curl http://localhost:3000/api/pool/btcd/info
```

**Pause deposits (emergency):**
```javascript
await btcdPool.pause();
```

**Unpause deposits:**
```javascript
await btcdPool.unpause();
```

**Adjust reward rate:**
```sql
UPDATE pool_config 
SET reward_per_minute = 30 
WHERE pool_id = 'btcd-main-pool';
```

**View pending withdrawals:**
```sql
SELECT * FROM pool_withdrawals WHERE status = 'pending';
```

## Configuration

### Reward Rate

Default: 24 BTCD per minute across all stakers

**Adjust:**
```sql
UPDATE pool_config 
SET reward_per_minute = <new_value>,
    updated_at = NOW()
WHERE pool_id = 'btcd-main-pool';
```

**Effect:** Next reward distribution will use new rate

### Minimum Withdrawal

Default: 100 BTCD

**Adjust:**
```sql
UPDATE pool_config 
SET min_withdraw_threshold = <new_value>,
    updated_at = NOW()
WHERE pool_id = 'btcd-main-pool';
```

## Monitoring

### Key Metrics

**Pool Health:**
```sql
SELECT 
  pool_id,
  tvl,
  status,
  reward_per_minute,
  updated_at
FROM pool_config
WHERE pool_id = 'btcd-main-pool';
```

**Active Users:**
```sql
SELECT COUNT(*) as active_users
FROM pool_positions
WHERE pool_id = 'btcd-main-pool' 
  AND staked_amount > 0;
```

**Pending Withdrawals:**
```sql
SELECT 
  COUNT(*) as pending_count,
  SUM(amount) as total_amount
FROM pool_withdrawals
WHERE status = 'pending';
```

**Failed Withdrawals:**
```sql
SELECT 
  withdrawal_id,
  user_id,
  amount,
  error_message,
  requested_at
FROM pool_withdrawals
WHERE status = 'failed'
ORDER BY requested_at DESC
LIMIT 10;
```

### Logs

**Reward distribution:**
```
[INFO] distributePoolRewards: completed
  poolId: btcd-main-pool
  totalDistributed: 24.000000 BTCD
  userCount: 15
  durationMs: 234
```

**Withdrawal processed:**
```
[INFO] Withdrawal completed successfully
  withdrawalId: 123
  amount: 500
  txHash: 0x...
```

## Security Considerations

1. **Smart Contract:**
   - Audited OpenZeppelin libraries
   - ReentrancyGuard on deposit/withdraw
   - Pausable for emergency stops
   - Owner-only admin functions

2. **Backend:**
   - Signature authentication for withdrawals
   - Rate limiting on all endpoints
   - Atomic transactions for balance updates
   - Idempotency checks on reward distribution

3. **Database:**
   - Foreign key constraints
   - Check constraints on status fields
   - Indexed queries for performance

4. **Admin Wallet:**
   - Keep private key secure
   - Monitor balance regularly
   - Use hardware wallet for mainnet

## Troubleshooting

### Reward distribution not running

**Check:**
```bash
# Backend logs
tail -f backend/logs/app.log | grep "poolRewardCron"
```

**Solution:**
- Ensure `startPoolRewardCron()` is called in `scheduler.ts`
- Check `pool_config.status = 'active'`
- Verify database connection

### Withdrawals stuck in pending

**Check:**
```sql
SELECT * FROM pool_withdrawals 
WHERE status = 'pending' 
  AND requested_at < NOW() - INTERVAL '10 minutes';
```

**Solution:**
- Check admin wallet BTCD balance
- Verify `ADMIN_PRIVATE_KEY` in `.env`
- Check withdrawal worker logs
- Manually retry: restart backend

### User balance mismatch

**Check:**
```sql
SELECT 
  pp.user_id,
  pp.staked_amount,
  m.pending_balance,
  m.total_earned
FROM pool_positions pp
JOIN miners m ON pp.user_id = m.miner_id
WHERE pp.pool_id = 'btcd-main-pool';
```

**Solution:**
- `staked_amount` = on-chain balance (from deposits/withdrawals)
- `pending_balance` = claimable rewards (from reward engine)
- `total_earned` = lifetime rewards

## Future Enhancements (v2)

- Multi-asset pools (ETH, USDC)
- Cooldown periods with bonuses
- On-chain reward distribution
- Oracle integration for USD pricing
- Risk engine with TVL caps
- Lockup tiers with APY multipliers
- Admin panel UI
- Analytics dashboard

## Support

**Issues:** Check logs first
- Backend: `backend/logs/app.log`
- Contract: Check transaction on block explorer

**Contact:** See project README for support channels

---

**Version:** 1.0  
**Last Updated:** 2025-12-03  
**Status:** Production Ready
