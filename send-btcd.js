#!/usr/bin/env node
/**
 * Send BTCD to address
 * Usage: node send-btcd.js <to_address> <amount>
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const execAsync = promisify(exec);

// Configuration
const TO_ADDRESS = process.argv[2] || '0x987d3241ae658af82822e3c227cd3433e982b976';
const AMOUNT = process.argv[3] || '100';
const RPC_URL = 'http://localhost:8545';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const BTCD_TOKEN_ADDRESS = process.env.BTCD_TOKEN_ADDRESS;

// Minimal ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

async function sendBTCD() {
  try {
    console.log('🔄 Sending BTCD...');
    console.log('===================');
    console.log(`To: ${TO_ADDRESS}`);
    console.log(`Amount: ${AMOUNT} BTCD\n`);

    if (!BTCD_TOKEN_ADDRESS) {
      console.error('❌ BTCD_TOKEN_ADDRESS not set in backend/.env');
      process.exit(1);
    }

    if (!ADMIN_PRIVATE_KEY) {
      console.error('❌ ADMIN_PRIVATE_KEY not set in backend/.env');
      process.exit(1);
    }

    // Connect to blockchain (ethers v5)
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const btcdToken = new ethers.Contract(BTCD_TOKEN_ADDRESS, ERC20_ABI, wallet);

    console.log(`1️⃣ Connected to RPC: ${RPC_URL}`);
    console.log(`   From: ${wallet.address}`);
    console.log(`   BTCD Token: ${BTCD_TOKEN_ADDRESS}\n`);

    // Check balance
    const balance = await btcdToken.balanceOf(wallet.address);
    const decimals = await btcdToken.decimals();
    const symbol = await btcdToken.symbol();
    const balanceFormatted = ethers.utils.formatUnits(balance, decimals);

    console.log(`2️⃣ Current balance: ${balanceFormatted} ${symbol}`);

    const amountToSend = ethers.utils.parseUnits(AMOUNT, decimals);

    if (balance.lt(amountToSend)) {
      console.error(`❌ Insufficient balance!`);
      console.error(`   Need: ${AMOUNT} ${symbol}`);
      console.error(`   Have: ${balanceFormatted} ${symbol}`);
      process.exit(1);
    }

    // Send transaction
    console.log(`\n3️⃣ Sending ${AMOUNT} ${symbol} to ${TO_ADDRESS}...`);
    const tx = await btcdToken.transfer(TO_ADDRESS, amountToSend);
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

    // Check new balances
    const newSenderBalance = await btcdToken.balanceOf(wallet.address);
    const recipientBalance = await btcdToken.balanceOf(TO_ADDRESS);

    console.log(`\n4️⃣ Final balances:`);
    console.log(`   Sender: ${ethers.utils.formatUnits(newSenderBalance, decimals)} ${symbol}`);
    console.log(`   Recipient: ${ethers.utils.formatUnits(recipientBalance, decimals)} ${symbol}`);
    console.log(`\n✅ Transfer completed successfully!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('   Data:', error.data);
    }
    process.exit(1);
  }
}

sendBTCD();
