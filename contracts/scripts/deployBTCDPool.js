#!/usr/bin/env node

/**
 * BTCDPool v1 Deployment Script
 * 
 * Deploys the simplified BTCDPool.sol contract for BTCD staking
 * 
 * Features:
 * - Single-asset staking (BTCD only)
 * - Direct balance tracking (no shares/vault model)
 * - No cooldown periods
 * - No oracle or risk engine dependencies
 * - Pausable deposits (admin only)
 * - Instant withdrawals
 * 
 * Usage: 
 *   npx hardhat run scripts/deployBTCDPool.js --network localhost
 *   npx hardhat run scripts/deployBTCDPool.js --network testnet
 *   npx hardhat run scripts/deployBTCDPool.js --network mainnet
 */

const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('========================================');
  console.log('BTCDPool v1 Deployment');
  console.log('========================================\n');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH\n');

  // Read BTCD token address from environment
  const BTCD_TOKEN_ADDRESS = process.env.BTCD_TOKEN_ADDRESS;

  if (!BTCD_TOKEN_ADDRESS) {
    throw new Error(
      'BTCD_TOKEN_ADDRESS not set in environment.\n' +
      'Please set BTCD_TOKEN_ADDRESS in your .env file or environment variables.\n' +
      'Example: BTCD_TOKEN_ADDRESS=0x1234...'
    );
  }

  // Validate address format
  if (!ethers.isAddress(BTCD_TOKEN_ADDRESS)) {
    throw new Error(`Invalid BTCD token address format: ${BTCD_TOKEN_ADDRESS}`);
  }

  console.log('Configuration:');
  console.log('  BTCD Token Address:', BTCD_TOKEN_ADDRESS);
  console.log('  Deployer (Owner):', deployer.address);
  console.log('');

  // Deploy BTCDPool
  console.log('Deploying BTCDPool contract...');
  const BTCDPool = await ethers.getContractFactory('BTCDPool');
  const btcdPool = await BTCDPool.deploy(BTCD_TOKEN_ADDRESS);
  
  console.log('Waiting for deployment transaction to be mined...');
  await btcdPool.waitForDeployment();
  
  const poolAddress = await btcdPool.getAddress();
  console.log('✓ BTCDPool deployed to:', poolAddress);
  console.log('');

  // Verify deployment by reading contract state
  console.log('Verifying deployment...');
  const btcdTokenAddr = await btcdPool.btcdToken();
  const totalStaked = await btcdPool.totalStaked();
  const owner = await btcdPool.owner();
  const isPaused = await btcdPool.isPaused();

  console.log('  BTCD Token:', btcdTokenAddr);
  console.log('  Total Staked:', ethers.formatEther(totalStaked), 'BTCD');
  console.log('  Owner:', owner);
  console.log('  Paused:', isPaused);
  console.log('');

  // Verify addresses match
  if (btcdTokenAddr.toLowerCase() !== BTCD_TOKEN_ADDRESS.toLowerCase()) {
    throw new Error('BTCD token address mismatch!');
  }

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error('Owner address mismatch!');
  }

  console.log('✓ Deployment verified successfully\n');

  // Print deployment summary
  console.log('========================================');
  console.log('DEPLOYMENT SUMMARY');
  console.log('========================================');
  
  const network = await ethers.provider.getNetwork();
  console.log('Network:', network.name);
  console.log('Chain ID:', network.chainId.toString());
  console.log('');
  
  console.log('Contract Address:');
  console.log('  BTCDPool:', poolAddress);
  console.log('');
  
  console.log('Configuration:');
  console.log('  BTCD Token:', BTCD_TOKEN_ADDRESS);
  console.log('  Owner/Admin:', deployer.address);
  console.log('  Initial State:', isPaused ? 'PAUSED' : 'ACTIVE');
  console.log('');

  // Print .env configuration for backend
  console.log('.env Configuration (add to backend/.env):');
  console.log('----------------------------------------');
  console.log(`BTCD_TOKEN_ADDRESS=${BTCD_TOKEN_ADDRESS}`);
  console.log(`BTCD_POOL_CONTRACT_ADDRESS=${poolAddress}`);
  console.log(`ADMIN_WALLET_ADDRESS=${deployer.address}`);
  console.log('----------------------------------------');
  console.log('');

  // Print next steps
  console.log('Next Steps:');
  console.log('1. Update backend/.env with the contract address above');
  console.log('2. Run database migration: cd backend && npm run migrate');
  console.log('3. Ensure pool_config table has btcd-main-pool entry');
  console.log('4. Fund admin wallet with BTCD for withdrawals');
  console.log('5. Start backend server: cd backend && npm run dev');
  console.log('6. Verify pool info API: GET /api/pool/btcd/info');
  console.log('');

  // Print contract interaction examples
  console.log('Contract Interaction Examples:');
  console.log('----------------------------------------');
  console.log('# Pause deposits (admin only)');
  console.log(`await btcdPool.pause();`);
  console.log('');
  console.log('# Unpause deposits');
  console.log(`await btcdPool.unpause();`);
  console.log('');
  console.log('# Check user balance');
  console.log(`await btcdPool.balanceOf("0x...");`);
  console.log('');
  console.log('# Get total staked');
  console.log(`await btcdPool.getTotalStaked();`);
  console.log('----------------------------------------');
  console.log('');

  console.log('✓ Deployment complete!');
  console.log('========================================');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n========================================');
    console.error('❌ DEPLOYMENT FAILED');
    console.error('========================================');
    console.error(error);
    console.error('');
    process.exit(1);
  });
