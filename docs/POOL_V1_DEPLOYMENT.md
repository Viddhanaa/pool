# Pool v1 Deployment Guide

This guide covers the complete deployment and initialization process for the VIDDHANA BTCD staking pool v1.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Deploy Smart Contracts](#step-1-deploy-smart-contracts)
- [Step 2: Initialize Backend Database](#step-2-initialize-backend-database)
- [Step 3: Fund Pool Rewards](#step-3-fund-pool-rewards)
- [Testing Checklist](#testing-checklist)
- [Admin Operations](#admin-operations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Node.js 18+
- PostgreSQL 14+
- Hardhat
- TypeScript/ts-node

### Required Information
- BTCD token contract address
- Admin wallet private key (with sufficient ETH and BTCD)
- RPC endpoint URL
- Database connection string

### Environment Setup

1. Navigate to the project root directory
2. Install dependencies:
   ```bash
   npm ci
   cd backend && npm ci
   cd ../contracts && npm ci
   cd ..
   ```

3. Configure environment variables in `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

## Step 1: Deploy Smart Contracts

### 1.1 Configure Deployment

Edit `backend/.env` and set the following variables:

```bash
# Required
BTCD_TOKEN_ADDRESS=0x...                    # Your BTCD token address
ADMIN_WALLET_ADDRESS=0x...                  # Admin wallet address
ADMIN_PRIVATE_KEY=0x...                     # Admin private key
RPC_URL=http://localhost:8545               # RPC endpoint

# Optional (with defaults)
POOL_INITIAL_TVL_CAP=1000000                # Max TVL: 1M BTCD
EPOCH_DURATION=604800                       # 7 days in seconds
```

### 1.2 Deploy Contracts

From the `contracts` directory:

```bash
cd contracts
npx hardhat run scripts/deployPool.js --network localhost
```

**Expected Output:**
```
Starting Pool v1 deployment...

Deploying contracts with account: 0x...
Account balance: 100.0 ETH

Configuration:
  BTCD Token: 0x...
  Admin Address: 0x...
  Initial TVL Cap: 1000000
  Epoch Duration: 604800 seconds

1. Deploying RiskEngine...
   RiskEngine deployed to: 0x...

2. Deploying RewardDistributor...
   RewardDistributor deployed to: 0x...

3. Deploying Pool contract...
   Pool deployed to: 0x...

4. Configuring Pool...
   ✓ RiskEngine set
   ✓ RewardDistributor set
   ✓ Cooldown set

5. Configuring RiskEngine...
   ✓ Risk parameters configured

6. Configuring RewardDistributor...
   ✓ Pool whitelisted
   ✓ Pool weight set

========================================
DEPLOYMENT SUMMARY
========================================
...
✓ Deployment complete!
```

### 1.3 Record Contract Addresses

**IMPORTANT:** Copy the contract addresses from the deployment output and update your `backend/.env`:

```bash
POOL_CONTRACT_ADDRESS=0x...
REWARD_DISTRIBUTOR_ADDRESS=0x...
RISK_ENGINE_ADDRESS=0x...
```

**Keep these addresses safe!** You'll need them for backend initialization and frontend integration.

## Step 2: Initialize Backend Database

### 2.1 Run Database Migrations

Ensure your database is up to date:

```bash
cd backend
npm run migrate
```

This creates the necessary tables defined in `infra/sql/migrations/006_pool_implementation.sql`.

### 2.2 Initialize Pool Configuration

Run the initialization script:

```bash
cd backend
npx ts-node scripts/initializePool.ts
```

**Expected Output:**
```
Starting Pool v1 backend initialization...

Configuration:
  Pool Contract: 0x...
  BTCD Token: 0x...
  TVL Cap: 1000000
  Database URL: postgres://...

✓ Connected to database

1. Creating pool record...
   ✓ Pool created: btcd-main-pool

2. Setting risk parameters...
   ✓ Risk parameters set

3. Initializing circuit breaker...
   ✓ Circuit breaker initialized

4. Setting reward weight...
   ✓ Reward weight set to 100%

5. Creating initial reward epoch...
   ✓ Initial epoch created: 1

========================================
INITIALIZATION SUMMARY
========================================
Pool ID: btcd-main-pool
...
✓ Initialization complete!
```

### 2.3 Verify Database Records

Connect to PostgreSQL and verify:

```sql
-- Check pool record
SELECT * FROM pools WHERE pool_id = 'btcd-main-pool';

-- Check risk parameters
SELECT * FROM pool_risk_parameters WHERE pool_id = 'btcd-main-pool';

-- Check reward weight
SELECT * FROM pool_reward_weights WHERE pool_id = 'btcd-main-pool';

-- Check initial epoch
SELECT * FROM pool_reward_epochs WHERE pool_id = 'btcd-main-pool';
```

## Step 3: Fund Pool Rewards

### 3.1 Prepare BTCD Tokens

Ensure the admin wallet has sufficient BTCD tokens. Check balance:

```bash
# Using ethers.js or web3
cast balance --erc20 $BTCD_TOKEN_ADDRESS $ADMIN_WALLET_ADDRESS
```

### 3.2 Fund RewardDistributor

Run the funding script with desired amount (in BTCD):

```bash
cd backend
npx ts-node scripts/fundPoolRewards.ts 10000
```

**Expected Output:**
```
Starting Pool Reward Funding...

Configuration:
  RPC URL: http://localhost:8545
  BTCD Token: 0x...
  RewardDistributor: 0x...
  Amount: 10000 BTCD

Connected to network: localhost
Admin wallet: 0x...
Wallet balance: 100.0 ETH

1. Verifying BTCD token...
   Token decimals: 18
   Admin balance: 50000 BTCD
   ✓ Balance sufficient

2. Checking allowance...
   Approving RewardDistributor...
   ✓ Approval confirmed

3. Funding RewardDistributor...
   Transaction hash: 0x...
   ✓ Transfer confirmed

4. Verifying funding...
   RewardDistributor balance: 10000 BTCD

5. Current epoch information...
   Current epoch: 0
   Epoch duration: 604800 seconds
   Time until next epoch: 604800 seconds

========================================
FUNDING SUMMARY
========================================
Amount Funded: 10000 BTCD
Transaction Hash: 0x...
RewardDistributor Balance: 10000 BTCD

Next Steps:
1. Wait for epoch to elapse
2. Call finalizeEpoch on RewardDistributor
3. Call allocateRewards to distribute to users

✓ Funding complete!
```

## Testing Checklist

After deployment, verify the following:

### Smart Contract Tests

- [ ] **Pool Contract**
  - [ ] Deposit functionality works
  - [ ] Withdrawal respects cooldown (0 in v1)
  - [ ] Share calculation is correct
  - [ ] Exchange rate updates properly
  - [ ] RiskEngine integration works
  - [ ] RewardDistributor integration works
  - [ ] Pause/unpause functions

- [ ] **RiskEngine**
  - [ ] TVL cap enforcement works
  - [ ] User deposit cap enforcement works
  - [ ] Daily withdrawal cap enforcement works
  - [ ] Emergency mode toggles correctly
  - [ ] Circuit breaker can pause pool

- [ ] **RewardDistributor**
  - [ ] Epoch finalization works
  - [ ] Reward allocation works
  - [ ] Claiming rewards works
  - [ ] Multi-claim works
  - [ ] Pool whitelist works

### Backend Integration Tests

- [ ] **Database**
  - [ ] Pool record exists in `pools` table
  - [ ] Risk parameters configured in `pool_risk_parameters`
  - [ ] Circuit breaker status initialized
  - [ ] Reward weight set in `pool_reward_weights`
  - [ ] Initial epoch created in `pool_reward_epochs`

- [ ] **API Endpoints**
  - [ ] `GET /api/pool/info` returns pool data
  - [ ] `GET /api/pool/balance/:address` returns user balance
  - [ ] `POST /api/pool/deposit` processes deposits
  - [ ] `POST /api/pool/withdraw` processes withdrawals
  - [ ] `GET /api/pool/rewards/:address` returns reward data
  - [ ] Admin endpoints require authentication

### End-to-End Tests

Run a complete deposit/withdraw cycle:

```bash
# 1. Deposit to pool
curl -X POST http://localhost:4000/api/pool/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "poolId": "btcd-main-pool",
    "amount": "100",
    "asset": "'$BTCD_TOKEN_ADDRESS'",
    "address": "'$USER_ADDRESS'",
    "signature": "...",
    "timestamp": '$(date +%s)',
    "nonce": "'$(uuidgen)'"
  }'

# 2. Check balance
curl http://localhost:4000/api/pool/balance/$USER_ADDRESS?poolId=btcd-main-pool

# 3. Withdraw from pool
curl -X POST http://localhost:4000/api/pool/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "poolId": "btcd-main-pool",
    "amount": "50",
    "address": "'$USER_ADDRESS'",
    "signature": "...",
    "timestamp": '$(date +%s)',
    "nonce": "'$(uuidgen)'"
  }'
```

## Admin Operations

### Pause Pool

Emergency pause to stop all deposits:

```bash
# Via ethers.js/hardhat console
const pool = await ethers.getContractAt("Pool", POOL_ADDRESS);
await pool.pause();
```

### Unpause Pool

Resume normal operations:

```bash
const pool = await ethers.getContractAt("Pool", POOL_ADDRESS);
await pool.unpause();
```

### Update TVL Cap

Adjust maximum total value locked:

```bash
const riskEngine = await ethers.getContractAt("RiskEngine", RISK_ENGINE_ADDRESS);
const newCap = ethers.parseEther("2000000"); // 2M BTCD
await riskEngine.configurePoolRisk(
  POOL_ADDRESS,
  newCap,
  ethers.parseEther("100000"), // maxUserDeposit
  ethers.parseEther("50000")   // dailyWithdrawalCap
);
```

### Update Reward Weight

Change pool's share of rewards:

```bash
const rewardDistributor = await ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
const newWeight = ethers.parseEther("0.8"); // 80%
await rewardDistributor.setPoolWeight(POOL_ADDRESS, newWeight);
```

### Finalize Epoch

End current epoch and start new one (after epoch duration elapsed):

```bash
const rewardDistributor = await ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR_ADDRESS);
const totalRewards = ethers.parseEther("1000"); // 1000 BTCD for this epoch
await rewardDistributor.finalizeEpoch(totalRewards);
```

### Allocate Rewards to Users

After finalizing epoch, allocate rewards to users:

```bash
const epoch = 0;
const users = ["0x...", "0x..."];
const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];

await rewardDistributor.allocateRewards(epoch, POOL_ADDRESS, users, amounts);
```

### Emergency Withdrawal

Enable withdrawals during pause:

```bash
const pool = await ethers.getContractAt("Pool", POOL_ADDRESS);
await pool.toggleEmergencyWithdrawal();
```

### Circuit Breaker

Trigger emergency mode (blocks deposits, allows withdrawals):

```bash
const riskEngine = await ethers.getContractAt("RiskEngine", RISK_ENGINE_ADDRESS);
await riskEngine.toggleEmergencyMode();
```

## Troubleshooting

### Deployment Issues

**Problem:** "BTCD_TOKEN_ADDRESS not set in environment"
```bash
Solution: Ensure backend/.env has BTCD_TOKEN_ADDRESS set
```

**Problem:** "Transaction reverted without a reason"
```bash
Solution: Check admin wallet has sufficient ETH for gas
```

**Problem:** Contract deployment fails with "out of gas"
```bash
Solution: Increase gas limit in hardhat.config.js:
networks: {
  localhost: {
    gas: 8000000,
    gasPrice: 1000000000
  }
}
```

### Backend Initialization Issues

**Problem:** "Connection refused" to database
```bash
Solution: Ensure PostgreSQL is running and DATABASE_URL is correct
```

**Problem:** "relation 'pools' does not exist"
```bash
Solution: Run database migrations first:
cd backend && npm run migrate
```

**Problem:** Pool already exists error
```bash
Solution: Script uses ON CONFLICT DO UPDATE, this is safe to re-run
```

### Funding Issues

**Problem:** "Insufficient balance"
```bash
Solution: Ensure admin wallet has enough BTCD tokens:
- Check balance with: cast balance --erc20 $BTCD_TOKEN_ADDRESS $ADMIN_WALLET_ADDRESS
- Transfer more BTCD to admin wallet if needed
```

**Problem:** "Approval failed"
```bash
Solution: Check if token contract is correct and accepts approvals
```

**Problem:** "Transfer failed"
```bash
Solution: Verify allowance was set correctly and wallet has gas
```

### Runtime Issues

**Problem:** Deposits fail with "Pool: deposit blocked by risk engine"
```bash
Solution: Check risk parameters:
- TVL cap not exceeded
- User deposit cap not exceeded
- Deposits are enabled in RiskEngine
```

**Problem:** Withdrawals fail with "Pool: cooldown not elapsed"
```bash
Solution: In v1, cooldown is 0. Verify with:
const cooldown = await pool.withdrawalCooldown();
console.log(cooldown); // Should be 0
```

**Problem:** Cannot claim rewards
```bash
Solution: Ensure:
- Epoch is finalized
- Rewards are allocated to user
- User hasn't claimed yet
```

## Monitoring

### On-Chain Monitoring

Monitor events from contracts:

```javascript
// Pool events
pool.on("Deposit", (user, assets, shares) => {
  console.log(`Deposit: ${user} deposited ${assets} for ${shares} shares`);
});

pool.on("Withdraw", (user, assets, shares) => {
  console.log(`Withdraw: ${user} withdrew ${assets} by burning ${shares} shares`);
});

// Risk events
riskEngine.on("RiskLimitBreached", (pool, user, reason) => {
  console.log(`ALERT: Risk limit breached for ${user}: ${reason}`);
});

// Reward events
rewardDistributor.on("EpochFinalized", (epoch, totalRewards) => {
  console.log(`Epoch ${epoch} finalized with ${totalRewards} rewards`);
});
```

### Database Monitoring

Query database for pool health:

```sql
-- Current TVL
SELECT pool_id, total_value_locked, total_shares, exchange_rate
FROM pools WHERE pool_id = 'btcd-main-pool';

-- Active users
SELECT COUNT(DISTINCT user_id) as active_users
FROM user_pool_shares
WHERE pool_id = 'btcd-main-pool' AND shares_owned > 0;

-- Recent withdrawals
SELECT * FROM pool_withdrawals
WHERE pool_id = 'btcd-main-pool'
ORDER BY created_at DESC LIMIT 10;

-- Circuit breaker status
SELECT * FROM circuit_breaker_status
WHERE pool_id = 'btcd-main-pool';

-- Risk violations
SELECT * FROM risk_violations
WHERE pool_id = 'btcd-main-pool'
ORDER BY timestamp DESC LIMIT 10;
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review contract test suite in `contracts/pools/test/`
3. Review backend integration guide in `blueprints/BACKEND_INTEGRATION_GUIDE.md`
4. Review pool implementation blueprint in `blueprints/POOL_IMPLEMENTATION_BLUEPRINT.md`

---

**Version:** 1.0.0  
**Last Updated:** December 2024  
**Network:** VIDDHANA Mainnet
