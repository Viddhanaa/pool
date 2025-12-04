#!/usr/bin/env node

/**
 * Pool v1 Deployment Script
 * 
 * Deploys Pool, RewardDistributor, and RiskEngine contracts for BTCD staking pool
 * Usage: npx hardhat run scripts/deployPool.js --network localhost
 */

const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('Starting Pool v1 deployment...\n');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Read configuration from environment
  const BTCD_TOKEN_ADDRESS = process.env.BTCD_TOKEN_ADDRESS;
  const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || deployer.address;
  const POOL_INITIAL_TVL_CAP = process.env.POOL_INITIAL_TVL_CAP || '1000000';
  const EPOCH_DURATION = process.env.EPOCH_DURATION || (7 * 24 * 60 * 60).toString(); // 7 days

  if (!BTCD_TOKEN_ADDRESS) {
    throw new Error('BTCD_TOKEN_ADDRESS not set in environment');
  }

  console.log('Configuration:');
  console.log('  BTCD Token:', BTCD_TOKEN_ADDRESS);
  console.log('  Admin Address:', ADMIN_WALLET_ADDRESS);
  console.log('  Initial TVL Cap:', POOL_INITIAL_TVL_CAP);
  console.log('  Epoch Duration:', EPOCH_DURATION, 'seconds\n');

  // Deploy RiskEngine
  console.log('1. Deploying RiskEngine...');
  const RiskEngine = await ethers.getContractFactory('RiskEngine');
  const riskEngine = await RiskEngine.deploy(ADMIN_WALLET_ADDRESS);
  await riskEngine.waitForDeployment();
  const riskEngineAddress = await riskEngine.getAddress();
  console.log('   RiskEngine deployed to:', riskEngineAddress);

  // Deploy RewardDistributor
  console.log('\n2. Deploying RewardDistributor...');
  const RewardDistributor = await ethers.getContractFactory('RewardDistributor');
  const rewardDistributor = await RewardDistributor.deploy(
    BTCD_TOKEN_ADDRESS,
    EPOCH_DURATION,
    ADMIN_WALLET_ADDRESS
  );
  await rewardDistributor.waitForDeployment();
  const rewardDistributorAddress = await rewardDistributor.getAddress();
  console.log('   RewardDistributor deployed to:', rewardDistributorAddress);

  // Deploy Pool
  console.log('\n3. Deploying Pool contract...');
  const Pool = await ethers.getContractFactory('Pool');
  const pool = await Pool.deploy(
    BTCD_TOKEN_ADDRESS,
    'VIDDHANA BTCD Staking Pool',
    'vBTCD',
    ADMIN_WALLET_ADDRESS
  );
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log('   Pool deployed to:', poolAddress);

  // Configure Pool
  console.log('\n4. Configuring Pool...');
  
  console.log('   Setting RiskEngine...');
  const setRiskEngineTx = await pool.setRiskEngine(riskEngineAddress);
  await setRiskEngineTx.wait();
  console.log('   ✓ RiskEngine set');

  console.log('   Setting RewardDistributor...');
  const setRewardDistributorTx = await pool.setRewardDistributor(rewardDistributorAddress);
  await setRewardDistributorTx.wait();
  console.log('   ✓ RewardDistributor set');

  console.log('   Setting withdrawal cooldown to 0...');
  const setCooldownTx = await pool.setWithdrawalCooldown(0);
  await setCooldownTx.wait();
  console.log('   ✓ Cooldown set');

  // Configure RiskEngine
  console.log('\n5. Configuring RiskEngine...');
  
  const tvlCapWei = ethers.parseEther(POOL_INITIAL_TVL_CAP);
  const maxUserDeposit = ethers.parseEther('100000'); // 100k BTCD per user
  const dailyWithdrawalCap = ethers.parseEther('50000'); // 50k BTCD per user per day

  console.log('   Configuring pool risk parameters...');
  const configRiskTx = await riskEngine.configurePoolRisk(
    poolAddress,
    tvlCapWei,
    maxUserDeposit,
    dailyWithdrawalCap
  );
  await configRiskTx.wait();
  console.log('   ✓ Risk parameters configured');
  console.log('     - Max TVL:', ethers.formatEther(tvlCapWei), 'BTCD');
  console.log('     - Max User Deposit:', ethers.formatEther(maxUserDeposit), 'BTCD');
  console.log('     - Daily Withdrawal Cap:', ethers.formatEther(dailyWithdrawalCap), 'BTCD');

  // Configure RewardDistributor
  console.log('\n6. Configuring RewardDistributor...');
  
  console.log('   Whitelisting pool...');
  const whitelistTx = await rewardDistributor.setPoolWhitelist(poolAddress, true);
  await whitelistTx.wait();
  console.log('   ✓ Pool whitelisted');

  console.log('   Setting pool weight to 100%...');
  const setWeightTx = await rewardDistributor.setPoolWeight(poolAddress, ethers.parseEther('1'));
  await setWeightTx.wait();
  console.log('   ✓ Pool weight set');

  // Print deployment summary
  console.log('\n========================================');
  console.log('DEPLOYMENT SUMMARY');
  console.log('========================================');
  console.log('Network:', (await ethers.provider.getNetwork()).name);
  console.log('Chain ID:', (await ethers.provider.getNetwork()).chainId);
  console.log('\nDeployed Contracts:');
  console.log('  Pool:', poolAddress);
  console.log('  RewardDistributor:', rewardDistributorAddress);
  console.log('  RiskEngine:', riskEngineAddress);
  console.log('\nConfiguration:');
  console.log('  BTCD Token:', BTCD_TOKEN_ADDRESS);
  console.log('  Admin:', ADMIN_WALLET_ADDRESS);
  console.log('  Pool Name: VIDDHANA BTCD Staking Pool');
  console.log('  Pool Symbol: vBTCD');
  console.log('  TVL Cap:', POOL_INITIAL_TVL_CAP, 'BTCD');
  console.log('  Epoch Duration:', EPOCH_DURATION, 'seconds');
  console.log('\n.env Configuration:');
  console.log('----------------------------------------');
  console.log(`BTCD_TOKEN_ADDRESS=${BTCD_TOKEN_ADDRESS}`);
  console.log(`POOL_CONTRACT_ADDRESS=${poolAddress}`);
  console.log(`REWARD_DISTRIBUTOR_ADDRESS=${rewardDistributorAddress}`);
  console.log(`RISK_ENGINE_ADDRESS=${riskEngineAddress}`);
  console.log(`POOL_INITIAL_TVL_CAP=${POOL_INITIAL_TVL_CAP}`);
  console.log('----------------------------------------');
  console.log('\n✓ Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  });
