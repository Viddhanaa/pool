# Pool v1 Deployment Scripts

Quick reference for deploying and managing the VIDDHANA BTCD staking pool v1.

## Files Created

```
contracts/scripts/
  └── deployPool.js              # Deploys Pool, RewardDistributor, RiskEngine

backend/scripts/
  ├── initializePool.ts          # Initializes pool in database
  └── fundPoolRewards.ts         # Funds RewardDistributor with BTCD

docs/
  └── POOL_V1_DEPLOYMENT.md      # Complete deployment guide

backend/.env.example             # Updated with Pool v1 config
```

## Quick Start

### 1. Deploy Contracts

```bash
cd contracts
npm run deploy:pool --network localhost
```

Or manually:
```bash
npx hardhat run scripts/deployPool.js --network localhost
```

### 2. Initialize Backend

```bash
cd backend
npm run pool:init
```

Or manually:
```bash
npx ts-node scripts/initializePool.ts
```

### 3. Fund Pool Rewards

```bash
cd backend
npm run pool:fund 10000
```

Or manually:
```bash
npx ts-node scripts/fundPoolRewards.ts 10000
```

## Environment Variables

Add to `backend/.env`:

```bash
# Pool v1 Configuration
BTCD_TOKEN_ADDRESS=0x...                    # BTCD token contract
POOL_CONTRACT_ADDRESS=0x...                 # Pool contract (from deployment)
REWARD_DISTRIBUTOR_ADDRESS=0x...            # RewardDistributor contract
RISK_ENGINE_ADDRESS=0x...                   # RiskEngine contract
POOL_INITIAL_TVL_CAP=1000000                # Max TVL (1M BTCD)
EPOCH_DURATION=604800                       # Epoch duration (7 days)
```

## Script Details

### deployPool.js

**Purpose:** Deploy and configure Pool, RewardDistributor, and RiskEngine contracts

**Configuration (from .env):**
- `BTCD_TOKEN_ADDRESS` - BTCD token contract address (required)
- `ADMIN_WALLET_ADDRESS` - Admin wallet for contract ownership
- `POOL_INITIAL_TVL_CAP` - Max TVL cap (default: 1M BTCD)
- `EPOCH_DURATION` - Reward epoch duration in seconds (default: 7 days)

**Outputs:**
- Pool contract address
- RewardDistributor contract address
- RiskEngine contract address

**Actions:**
1. Deploys RiskEngine
2. Deploys RewardDistributor
3. Deploys Pool
4. Links contracts (Pool ↔ RiskEngine, Pool ↔ RewardDistributor)
5. Configures risk parameters (TVL cap, user limits)
6. Whitelists pool and sets 100% reward weight

### initializePool.ts

**Purpose:** Initialize pool configuration in backend database

**Configuration (from .env):**
- `POOL_CONTRACT_ADDRESS` - Pool contract address from deployment (required)
- `BTCD_TOKEN_ADDRESS` - BTCD token contract address (required)
- `POOL_INITIAL_TVL_CAP` - Max TVL cap
- `DATABASE_URL` - PostgreSQL connection string

**Actions:**
1. Creates `btcd-main-pool` pool record in `pools` table
2. Sets risk parameters in `pool_risk_parameters`
3. Initializes circuit breaker in `circuit_breaker_status`
4. Sets 100% reward weight in `pool_reward_weights`
5. Creates initial epoch in `pool_reward_epochs`

### fundPoolRewards.ts

**Purpose:** Fund RewardDistributor with BTCD tokens for rewards

**Usage:**
```bash
npx ts-node scripts/fundPoolRewards.ts <amount>
```

**Configuration (from .env):**
- `BTCD_TOKEN_ADDRESS` - BTCD token contract address (required)
- `REWARD_DISTRIBUTOR_ADDRESS` - RewardDistributor contract (required)
- `ADMIN_PRIVATE_KEY` - Admin wallet private key (required)
- `RPC_URL` - RPC endpoint

**Actions:**
1. Verifies admin BTCD balance
2. Approves RewardDistributor to spend BTCD
3. Transfers BTCD to RewardDistributor
4. Displays current epoch information

**Example:**
```bash
# Fund with 10,000 BTCD
npx ts-node scripts/fundPoolRewards.ts 10000
```

## Common Operations

### Deploy to mainnet

```bash
cd contracts
npm run deploy:pool:mainnet
```

Make sure to update `hardhat.config.js` with mainnet configuration first.

### Check pool status

```sql
-- Connect to database
psql $DATABASE_URL

-- Check pool
SELECT * FROM pools WHERE pool_id = 'btcd-main-pool';

-- Check TVL and users
SELECT 
  p.pool_id,
  p.total_value_locked,
  p.total_shares,
  p.exchange_rate,
  COUNT(DISTINCT ups.user_id) as active_users
FROM pools p
LEFT JOIN user_pool_shares ups ON p.pool_id = ups.pool_id
WHERE p.pool_id = 'btcd-main-pool'
GROUP BY p.pool_id;
```

### Pause pool (emergency)

```javascript
// Using hardhat console
const pool = await ethers.getContractAt("Pool", process.env.POOL_CONTRACT_ADDRESS);
await pool.pause();
```

### Fund additional rewards

```bash
cd backend
npx ts-node scripts/fundPoolRewards.ts 5000
```

## Troubleshooting

### "BTCD_TOKEN_ADDRESS not set"

Make sure `backend/.env` has all required variables set.

### "Connection refused" to database

Ensure PostgreSQL is running and DATABASE_URL is correct:
```bash
psql $DATABASE_URL -c "SELECT version();"
```

### "Insufficient balance"

Admin wallet needs both ETH (for gas) and BTCD (for funding):
```bash
# Check ETH balance
cast balance $ADMIN_WALLET_ADDRESS

# Check BTCD balance
cast call $BTCD_TOKEN_ADDRESS "balanceOf(address)(uint256)" $ADMIN_WALLET_ADDRESS
```

### Deployment fails

1. Check network connectivity to RPC
2. Verify admin wallet has sufficient ETH
3. Ensure BTCD_TOKEN_ADDRESS is valid contract
4. Review error logs in deployment output

## Security Notes

1. **Private Keys:** Never commit `.env` files with real private keys
2. **Admin Access:** Secure the admin wallet - it has full control over contracts
3. **Testing:** Always test on localhost/testnet before mainnet deployment
4. **Verification:** Verify contract source code on block explorer after deployment
5. **Audits:** Consider security audit before mainnet deployment with significant TVL

## Next Steps

After successful deployment:

1. ✅ Update frontend with contract addresses
2. ✅ Set up monitoring for contract events
3. ✅ Configure alerting for risk violations
4. ✅ Test complete deposit/withdraw flow
5. ✅ Document contract addresses in secure location
6. ✅ Set up epoch finalization cron job
7. ✅ Implement reward calculation backend service

## Support

- Full deployment guide: `docs/POOL_V1_DEPLOYMENT.md`
- Contract tests: `contracts/pools/test/`
- Backend integration: `blueprints/BACKEND_INTEGRATION_GUIDE.md`
- Pool blueprint: `blueprints/POOL_IMPLEMENTATION_BLUEPRINT.md`
