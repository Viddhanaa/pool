# Pool v1 Deployment Scripts - Summary

## Created Files

### 1. **contracts/scripts/deployPool.js** (182 lines)
Hardhat deployment script for Pool v1 smart contracts.

**Features:**
- Deploys RiskEngine, RewardDistributor, and Pool contracts
- Configures contract relationships and permissions
- Sets initial risk parameters (TVL cap, user limits)
- Whitelists pool and sets reward weights
- Outputs deployment summary with contract addresses

**Usage:**
```bash
cd contracts
npx hardhat run scripts/deployPool.js --network localhost
# Or use npm script:
npm run deploy:pool
```

**Environment Variables Required:**
- `BTCD_TOKEN_ADDRESS` (required)
- `ADMIN_WALLET_ADDRESS` (optional, defaults to deployer)
- `POOL_INITIAL_TVL_CAP` (optional, default: 1000000)
- `EPOCH_DURATION` (optional, default: 604800 seconds / 7 days)

---

### 2. **backend/scripts/initializePool.ts** (161 lines)
Backend database initialization script.

**Features:**
- Creates `btcd-main-pool` pool record in PostgreSQL
- Initializes risk parameters and circuit breaker
- Sets 100% reward weight for pool
- Creates initial reward epoch
- Uses transactions for data consistency

**Usage:**
```bash
cd backend
npx ts-node scripts/initializePool.ts
# Or use npm script:
npm run pool:init
```

**Environment Variables Required:**
- `POOL_CONTRACT_ADDRESS` (required, from deployment)
- `BTCD_TOKEN_ADDRESS` (required)
- `POOL_INITIAL_TVL_CAP` (optional)
- `DATABASE_URL` (optional, default: localhost)

**Database Tables Modified:**
- `pools`
- `pool_risk_parameters`
- `circuit_breaker_status`
- `pool_reward_weights`
- `pool_reward_epochs`

---

### 3. **backend/scripts/fundPoolRewards.ts** (201 lines)
Admin script to fund RewardDistributor with BTCD tokens.

**Features:**
- Verifies admin BTCD balance
- Approves and transfers BTCD to RewardDistributor
- Displays current epoch information
- Shows next steps for reward distribution

**Usage:**
```bash
cd backend
npx ts-node scripts/fundPoolRewards.ts <amount>
# Or use npm script:
npm run pool:fund 10000
```

**Example:**
```bash
# Fund with 10,000 BTCD
npx ts-node scripts/fundPoolRewards.ts 10000
```

**Environment Variables Required:**
- `BTCD_TOKEN_ADDRESS` (required)
- `REWARD_DISTRIBUTOR_ADDRESS` (required, from deployment)
- `ADMIN_PRIVATE_KEY` (required)
- `RPC_URL` (optional)

---

### 4. **backend/.env.example** (Updated)
Added Pool v1 configuration section.

**New Variables:**
```bash
# Pool v1 Configuration
BTCD_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
POOL_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
REWARD_DISTRIBUTOR_ADDRESS=0x0000000000000000000000000000000000000000
RISK_ENGINE_ADDRESS=0x0000000000000000000000000000000000000000
POOL_INITIAL_TVL_CAP=1000000
EPOCH_DURATION=604800
```

---

### 5. **docs/POOL_V1_DEPLOYMENT.md** (568 lines)
Comprehensive deployment guide with step-by-step instructions.

**Sections:**
1. **Prerequisites** - Required software and setup
2. **Deploy Smart Contracts** - Contract deployment walkthrough
3. **Initialize Backend Database** - Database setup steps
4. **Fund Pool Rewards** - Reward funding instructions
5. **Testing Checklist** - Comprehensive testing guide
6. **Admin Operations** - Common admin tasks
7. **Troubleshooting** - Solutions to common issues
8. **Monitoring** - On-chain and database monitoring

**Key Features:**
- Step-by-step instructions with expected outputs
- Complete testing checklist for contracts and backend
- Admin operation examples with code
- Troubleshooting guide for common errors
- Monitoring queries and event listeners
- Security best practices

---

### 6. **contracts/scripts/README.md** (236 lines)
Quick reference guide for deployment scripts.

**Sections:**
- Quick start commands
- Environment variable reference
- Detailed script documentation
- Common operations
- Troubleshooting tips
- Security notes
- Next steps after deployment

---

### 7. **Package.json Updates**

#### contracts/package.json
Added scripts:
```json
"deploy:pool": "hardhat run scripts/deployPool.js --network localhost",
"deploy:pool:mainnet": "hardhat run scripts/deployPool.js --network mainnet"
```

#### backend/package.json
Added scripts:
```json
"pool:init": "ts-node scripts/initializePool.ts",
"pool:fund": "ts-node scripts/fundPoolRewards.ts"
```

---

## Deployment Flow

### Complete Deployment Process

```bash
# 1. Deploy contracts
cd contracts
npm run deploy:pool
# Save contract addresses to backend/.env

# 2. Initialize backend
cd ../backend
npm run pool:init

# 3. Fund rewards
npm run pool:fund 10000

# 4. Verify deployment
psql $DATABASE_URL -c "SELECT * FROM pools WHERE pool_id = 'btcd-main-pool'"
```

---

## Code Style Compliance

All scripts follow AGENTS.md patterns:

✅ **Node.js 18+** compatible  
✅ **Error Handling:** Comprehensive try-catch with detailed error messages  
✅ **Logging:** All operations logged with clear status indicators  
✅ **TypeScript:** Strict typing in .ts files  
✅ **Formatting:** Prettier-compliant (100-char width, single quotes, semicolons)  
✅ **Naming:** camelCase for variables/functions, PascalCase for types  
✅ **Imports:** Grouped (Node builtins, external libs, internal modules)  
✅ **Security:** All external input validated, private keys protected  

---

## Key Features

### 1. **Comprehensive Error Handling**
- All scripts validate environment variables
- Clear error messages with resolution hints
- Transaction confirmations with status tracking
- Rollback on database errors

### 2. **Detailed Logging**
- Step-by-step progress indicators
- Configuration display before operations
- Success confirmations with checkmarks (✓)
- Summary sections with key information

### 3. **Safety Mechanisms**
- Database transactions for atomicity
- Balance checks before transfers
- Allowance verification before approvals
- Contract state validation

### 4. **Developer Experience**
- Clear usage instructions in headers
- Helpful error messages
- npm scripts for easy execution
- Example commands in documentation

---

## Configuration Reference

### Contract Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Max TVL | 1,000,000 BTCD | Maximum total value locked |
| Max User Deposit | 100,000 BTCD | Maximum per-user deposit |
| Daily Withdrawal Cap | 50,000 BTCD | Maximum withdrawal per user per day |
| Cooldown Period | 0 seconds | Withdrawal cooldown (v1: disabled) |
| Epoch Duration | 604,800 sec | Reward epoch duration (7 days) |
| Pool Weight | 100% | Share of total rewards |

### Database Schema

Tables initialized:
- `pools` - Pool state and exchange rates
- `user_pool_shares` - User share ownership
- `pool_reward_epochs` - Epoch snapshots
- `pool_reward_weights` - Reward allocation weights
- `pool_rewards` - User reward snapshots
- `pool_withdrawals` - Withdrawal tracking
- `pool_risk_parameters` - Risk limits
- `circuit_breaker_status` - Emergency state
- `risk_violations` - Violation logs
- `oracle_price_cache` - Price data
- `oracle_alerts` - Oracle health

---

## Testing Checklist

### Pre-Deployment
- [ ] Node.js 18+ installed
- [ ] PostgreSQL running
- [ ] Database migrations applied
- [ ] BTCD token deployed/available
- [ ] Admin wallet funded (ETH + BTCD)
- [ ] Environment variables configured

### Post-Deployment
- [ ] All contracts deployed successfully
- [ ] Contract addresses recorded
- [ ] Database tables initialized
- [ ] Pool record exists in DB
- [ ] Risk parameters configured
- [ ] Reward weight set
- [ ] RewardDistributor funded
- [ ] Test deposit works
- [ ] Test withdrawal works
- [ ] Admin operations work

---

## Security Considerations

1. **Private Key Management**
   - Never commit .env files
   - Use hardware wallets for mainnet
   - Rotate keys regularly

2. **Admin Access Control**
   - Admin has full contract control
   - Use multi-sig for mainnet
   - Document all admin operations

3. **Testing Requirements**
   - Test on localhost first
   - Deploy to testnet before mainnet
   - Run complete test suite
   - Verify all edge cases

4. **Monitoring**
   - Set up event listeners
   - Monitor risk violations
   - Track circuit breaker status
   - Alert on oracle failures

5. **Upgrade Path**
   - Document contract addresses
   - Plan for contract upgrades
   - Test migration procedures
   - Have rollback plan

---

## Admin Operations Quick Reference

```javascript
// Pause pool
await pool.pause();

// Update TVL cap
await riskEngine.configurePoolRisk(poolAddress, newTvlCap, maxUserDeposit, dailyCap);

// Finalize epoch
await rewardDistributor.finalizeEpoch(totalRewards);

// Allocate rewards
await rewardDistributor.allocateRewards(epoch, poolAddress, users, amounts);

// Emergency mode
await riskEngine.toggleEmergencyMode();

// Fund more rewards
npx ts-node scripts/fundPoolRewards.ts 5000
```

---

## File Statistics

| File | Lines | Size | Type |
|------|-------|------|------|
| deployPool.js | 182 | 6.1 KB | JavaScript |
| initializePool.ts | 161 | 5.4 KB | TypeScript |
| fundPoolRewards.ts | 201 | 6.8 KB | TypeScript |
| POOL_V1_DEPLOYMENT.md | 568 | 14 KB | Markdown |
| scripts/README.md | 236 | 6.1 KB | Markdown |
| **Total** | **1,348** | **38.4 KB** | - |

---

## Support Resources

- **Full Guide:** `docs/POOL_V1_DEPLOYMENT.md`
- **Quick Reference:** `contracts/scripts/README.md`
- **Contract Tests:** `contracts/pools/test/`
- **Backend Integration:** `blueprints/BACKEND_INTEGRATION_GUIDE.md`
- **Pool Architecture:** `blueprints/POOL_IMPLEMENTATION_BLUEPRINT.md`
- **Contract Code:** `contracts/pools/Pool.sol`, `contracts/rewards/RewardDistributor.sol`, `contracts/risk/RiskEngine.sol`

---

**Version:** 1.0.0  
**Created:** December 2024  
**Network:** VIDDHANA BTCD Staking Pool v1  
**Status:** ✅ Complete and Ready for Deployment
