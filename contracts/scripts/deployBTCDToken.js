#!/usr/bin/env node

/**
 * Deploy BTCD Token
 */

const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('========================================');
  console.log('BTCD Token Deployment');
  console.log('========================================\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH\n');

  console.log('Deploying BTCDToken contract...');
  const BTCDToken = await ethers.getContractFactory('BTCDToken');
  const btcdToken = await BTCDToken.deploy();
  
  console.log('Waiting for deployment...');
  await btcdToken.waitForDeployment();
  
  const tokenAddress = await btcdToken.getAddress();
  console.log('✓ BTCDToken deployed to:', tokenAddress);
  console.log('');

  // Verify
  const name = await btcdToken.name();
  const symbol = await btcdToken.symbol();
  const decimals = await btcdToken.decimals();
  const totalSupply = await btcdToken.totalSupply();
  const deployerBalance = await btcdToken.balanceOf(deployer.address);

  console.log('Token Details:');
  console.log('  Name:', name);
  console.log('  Symbol:', symbol);
  console.log('  Decimals:', decimals.toString());
  console.log('  Total Supply:', ethers.formatEther(totalSupply), symbol);
  console.log('  Deployer Balance:', ethers.formatEther(deployerBalance), symbol);
  console.log('');

  console.log('========================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('Add this to your backend/.env file:');
  console.log(`BTCD_TOKEN_ADDRESS=${tokenAddress}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
