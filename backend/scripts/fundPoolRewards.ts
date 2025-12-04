#!/usr/bin/env node

/**
 * Pool Reward Funding Script
 * 
 * Funds RewardDistributor contract with BTCD and configures reward rates
 * Usage: npx ts-node backend/scripts/fundPoolRewards.ts <amount>
 */

import path from 'path';
import { config } from 'dotenv';
import { ethers } from 'ethers';

config({ path: path.join(__dirname, '..', '.env') });

// Minimal ERC20 ABI for transfers and approvals
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// RewardDistributor ABI (minimal)
const REWARD_DISTRIBUTOR_ABI = [
  'function rewardToken() view returns (address)',
  'function currentEpoch() view returns (uint256)',
  'function epochDuration() view returns (uint256)',
  'function lastEpochTime() view returns (uint256)',
  'function whitelistedPools(address) view returns (bool)',
  'function poolWeights(address) view returns (uint256)',
  'function getEpochInfo(uint256) view returns (uint256 totalRewards, uint256 totalClaimed, bool finalized)',
];

async function fundPoolRewards(amountStr: string): Promise<void> {
  console.log('Starting Pool Reward Funding...\n');

  // Read configuration from environment
  const BTCD_TOKEN_ADDRESS = process.env.BTCD_TOKEN_ADDRESS;
  const REWARD_DISTRIBUTOR_ADDRESS = process.env.REWARD_DISTRIBUTOR_ADDRESS;
  const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL || process.env.RPC_URLS?.split(',')[0] || 'http://localhost:8545';

  if (!BTCD_TOKEN_ADDRESS) {
    throw new Error('BTCD_TOKEN_ADDRESS not set in environment');
  }

  if (!REWARD_DISTRIBUTOR_ADDRESS) {
    throw new Error('REWARD_DISTRIBUTOR_ADDRESS not set in environment');
  }

  if (!ADMIN_PRIVATE_KEY) {
    throw new Error('ADMIN_PRIVATE_KEY not set in environment');
  }

  if (!amountStr) {
    throw new Error('Usage: npx ts-node backend/scripts/fundPoolRewards.ts <amount>');
  }

  console.log('Configuration:');
  console.log('  RPC URL:', RPC_URL);
  console.log('  BTCD Token:', BTCD_TOKEN_ADDRESS);
  console.log('  RewardDistributor:', REWARD_DISTRIBUTOR_ADDRESS);
  console.log('  Amount:', amountStr, 'BTCD');
  console.log();

  // Connect to provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

  console.log('Connected to network:', (await provider.getNetwork()).name);
  console.log('Admin wallet:', wallet.address);
  console.log('Wallet balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH\n');

  // Connect to contracts
  const btcdToken = new ethers.Contract(BTCD_TOKEN_ADDRESS, ERC20_ABI, wallet);
  const rewardDistributor = new ethers.Contract(
    REWARD_DISTRIBUTOR_ADDRESS,
    REWARD_DISTRIBUTOR_ABI,
    wallet
  );

  try {
    // 1. Verify BTCD token
    console.log('1. Verifying BTCD token...');
    const decimals = await btcdToken.decimals();
    const balance = await btcdToken.balanceOf(wallet.address);
    console.log('   Token decimals:', decimals);
    console.log('   Admin balance:', ethers.formatUnits(balance, decimals), 'BTCD');

    // Parse amount with correct decimals
    const amount = ethers.parseUnits(amountStr, decimals);

    if (balance < amount) {
      throw new Error(`Insufficient balance. Need ${amountStr} BTCD, have ${ethers.formatUnits(balance, decimals)} BTCD`);
    }

    console.log('   ✓ Balance sufficient');

    // 2. Check current allowance
    console.log('\n2. Checking allowance...');
    const currentAllowance = await btcdToken.allowance(wallet.address, REWARD_DISTRIBUTOR_ADDRESS);
    console.log('   Current allowance:', ethers.formatUnits(currentAllowance, decimals), 'BTCD');

    if (currentAllowance < amount) {
      console.log('   Approving RewardDistributor...');
      const approveTx = await btcdToken.approve(REWARD_DISTRIBUTOR_ADDRESS, amount);
      console.log('   Transaction hash:', approveTx.hash);
      await approveTx.wait();
      console.log('   ✓ Approval confirmed');
    } else {
      console.log('   ✓ Allowance already sufficient');
    }

    // 3. Transfer tokens to RewardDistributor
    console.log('\n3. Funding RewardDistributor...');
    const transferTx = await btcdToken.transfer(REWARD_DISTRIBUTOR_ADDRESS, amount);
    console.log('   Transaction hash:', transferTx.hash);
    await transferTx.wait();
    console.log('   ✓ Transfer confirmed');

    // 4. Verify funding
    console.log('\n4. Verifying funding...');
    const distributorBalance = await btcdToken.balanceOf(REWARD_DISTRIBUTOR_ADDRESS);
    console.log('   RewardDistributor balance:', ethers.formatUnits(distributorBalance, decimals), 'BTCD');

    // 5. Display current epoch info
    console.log('\n5. Current epoch information...');
    const currentEpoch = await rewardDistributor.currentEpoch();
    const epochDuration = await rewardDistributor.epochDuration();
    const lastEpochTime = await rewardDistributor.lastEpochTime();

    console.log('   Current epoch:', currentEpoch.toString());
    console.log('   Epoch duration:', epochDuration.toString(), 'seconds');
    console.log('   Last epoch time:', new Date(Number(lastEpochTime) * 1000).toISOString());

    const timeUntilNextEpoch = Number(lastEpochTime) + Number(epochDuration) - Math.floor(Date.now() / 1000);
    console.log('   Time until next epoch:', Math.max(0, timeUntilNextEpoch), 'seconds');

    // Print summary
    console.log('\n========================================');
    console.log('FUNDING SUMMARY');
    console.log('========================================');
    console.log('Amount Funded:', amountStr, 'BTCD');
    console.log('Transaction Hash:', transferTx.hash);
    console.log('RewardDistributor Balance:', ethers.formatUnits(distributorBalance, decimals), 'BTCD');
    console.log('Current Epoch:', currentEpoch.toString());
    console.log('\nNext Steps:');
    console.log('1. Wait for epoch to elapse');
    console.log('2. Call finalizeEpoch on RewardDistributor');
    console.log('3. Call allocateRewards to distribute to users');
    console.log('\n✓ Funding complete!');

  } catch (error) {
    console.error('\n❌ Error during funding:');
    throw error;
  }
}

// Get amount from command line args
const amount = process.argv[2];

if (!amount) {
  console.error('Usage: npx ts-node backend/scripts/fundPoolRewards.ts <amount>');
  console.error('Example: npx ts-node backend/scripts/fundPoolRewards.ts 10000');
  process.exit(1);
}

fundPoolRewards(amount)
  .then(() => {
    console.log('\nExiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Funding failed:');
    console.error(error);
    process.exit(1);
  });
