#!/usr/bin/env node

/**
 * Pool v1 Backend Initialization Script
 * 
  * Initializes btcd-main-pool pool in database
 * Usage: npx ts-node backend/scripts/initializePool.ts
 */

import path from 'path';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

interface PoolConfig {
  poolId: string;
  assetAddress: string;
  maxTvl: string;
  maxUserDeposit: string;
  dailyWithdrawalCap: string;
  rewardWeight: string;
}

async function initializePool(): Promise<void> {
  console.log('Starting Pool v1 backend initialization...\n');

  // Read configuration from environment
  const POOL_CONTRACT_ADDRESS = process.env.POOL_CONTRACT_ADDRESS;
  const BTCD_TOKEN_ADDRESS = process.env.BTCD_TOKEN_ADDRESS;
  const POOL_INITIAL_TVL_CAP = process.env.POOL_INITIAL_TVL_CAP || '1000000';
  const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/asdminer';

  if (!POOL_CONTRACT_ADDRESS) {
    throw new Error('POOL_CONTRACT_ADDRESS not set in environment');
  }

  if (!BTCD_TOKEN_ADDRESS) {
    throw new Error('BTCD_TOKEN_ADDRESS not set in environment');
  }

  console.log('Configuration:');
  console.log('  Pool Contract:', POOL_CONTRACT_ADDRESS);
  console.log('  BTCD Token:', BTCD_TOKEN_ADDRESS);
  console.log('  TVL Cap:', POOL_INITIAL_TVL_CAP);
  console.log('  Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
  console.log();

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('✓ Connected to database');

    // Start transaction
    await client.query('BEGIN');

    // 1. Insert pool into pools table
    console.log('\n1. Creating pool record...');
    const poolId = 'btcd-main-pool';
    
    const poolInsertResult = await client.query(
      `INSERT INTO pools (pool_id, asset_address, total_value_locked, total_shares, exchange_rate, paused, last_update_block)
       VALUES ($1, $2, 0, 0, 1.0, false, 0)
       ON CONFLICT (pool_id) DO UPDATE SET
         asset_address = EXCLUDED.asset_address,
         updated_at = NOW()
       RETURNING pool_id`,
      [poolId, BTCD_TOKEN_ADDRESS.toLowerCase()]
    );

    console.log('   ✓ Pool created:', poolInsertResult.rows[0].pool_id);

    // 2. Set pool risk parameters
    console.log('\n2. Setting risk parameters...');
    
    const maxTvl = POOL_INITIAL_TVL_CAP;
    const maxUserDeposit = '100000';
    const dailyWithdrawalCap = '50000';

    await client.query(
      `INSERT INTO pool_risk_parameters (pool_id, max_tvl, max_daily_withdrawals, max_user_deposit, circuit_breaker_threshold, emergency_paused)
       VALUES ($1, $2, $3, $4, 0.1, false)
       ON CONFLICT (pool_id) DO UPDATE SET
         max_tvl = EXCLUDED.max_tvl,
         max_daily_withdrawals = EXCLUDED.max_daily_withdrawals,
         max_user_deposit = EXCLUDED.max_user_deposit,
         last_updated = NOW()`,
      [poolId, maxTvl, dailyWithdrawalCap, maxUserDeposit]
    );

    console.log('   ✓ Risk parameters set:');
    console.log('     - Max TVL:', maxTvl, 'BTCD');
    console.log('     - Max User Deposit:', maxUserDeposit, 'BTCD');
    console.log('     - Daily Withdrawal Cap:', dailyWithdrawalCap, 'BTCD');

    // 3. Initialize circuit breaker status
    console.log('\n3. Initializing circuit breaker...');
    
    await client.query(
      `INSERT INTO circuit_breaker_status (pool_id, active, reason, triggered_at)
       VALUES ($1, false, NULL, NULL)
       ON CONFLICT (pool_id) DO NOTHING`,
      [poolId]
    );

    console.log('   ✓ Circuit breaker initialized (inactive)');

    // 4. Set reward weight
    console.log('\n4. Setting reward weight...');
    
    await client.query(
      `INSERT INTO pool_reward_weights (pool_id, weight)
       VALUES ($1, 1.0)
       ON CONFLICT (pool_id) DO UPDATE SET
         weight = EXCLUDED.weight,
         updated_at = NOW()`,
      [poolId]
    );

    console.log('   ✓ Reward weight set to 100%');

    // 5. Create first reward epoch
    console.log('\n5. Creating initial reward epoch...');
    
    const epochResult = await client.query(
      `INSERT INTO pool_reward_epochs (pool_id, start_block, end_block, total_reward, snapshot_at)
       VALUES ($1, 0, 0, 0, NOW())
       RETURNING epoch_id`,
      [poolId]
    );

    console.log('   ✓ Initial epoch created:', epochResult.rows[0].epoch_id);

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('INITIALIZATION SUMMARY');
    console.log('========================================');
    console.log('Pool ID:', poolId);
    console.log('Asset:', BTCD_TOKEN_ADDRESS);
    console.log('Contract:', POOL_CONTRACT_ADDRESS);
    console.log('Status: Active');
    console.log('Initial TVL: 0');
    console.log('Initial Shares: 0');
    console.log('Exchange Rate: 1.0');
    console.log('Cooldown Period: 0 seconds');
    console.log('Reward Weight: 100%');
    console.log('Initial Epoch:', epochResult.rows[0].epoch_id);
    console.log('\n✓ Initialization complete!');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initializePool()
  .then(() => {
    console.log('\nExiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Initialization failed:');
    console.error(error);
    process.exit(1);
  });
