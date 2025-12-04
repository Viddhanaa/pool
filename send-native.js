#!/usr/bin/env node
/**
 * Send Native Coin (ETH/BTCD native)
 * Usage: node send-native.js <to_address> <amount>
 */

const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

// Configuration
const TO_ADDRESS = process.argv[2] || '0x987d3241ae658af82822e3c227cd3433e982b976';
const AMOUNT = process.argv[3] || '100';
const RPC_URL = 'http://localhost:8545';
// Use signer2 account which has more funds (from genesis prefund)
const ADMIN_PRIVATE_KEY = process.argv[4] || '0x3fb8252edb90a488e196bb78712aba27ee7fcd4ef8ec148d402fefbef9dc4a3e';

async function sendNative() {
  try {
    console.log('🔄 Sending Native Coin...');
    console.log('========================');
    console.log(`To: ${TO_ADDRESS}`);
    console.log(`Amount: ${AMOUNT} BTCD\n`);

    if (!ADMIN_PRIVATE_KEY) {
      console.error('❌ ADMIN_PRIVATE_KEY not set in backend/.env');
      process.exit(1);
    }

    // Connect to blockchain (ethers v5)
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    console.log(`1️⃣ Connected to RPC: ${RPC_URL}`);
    console.log(`   From: ${wallet.address}\n`);

    // Check balance
    const balance = await wallet.getBalance();
    const balanceFormatted = ethers.utils.formatEther(balance);

    console.log(`2️⃣ Current balance: ${balanceFormatted} BTCD`);

    const amountToSend = ethers.utils.parseEther(AMOUNT);

    if (balance.lt(amountToSend)) {
      console.error(`❌ Insufficient balance!`);
      console.error(`   Need: ${AMOUNT} BTCD`);
      console.error(`   Have: ${balanceFormatted} BTCD`);
      process.exit(1);
    }

    // Send transaction
    console.log(`\n3️⃣ Sending ${AMOUNT} BTCD to ${TO_ADDRESS}...`);
    const tx = await wallet.sendTransaction({
      to: TO_ADDRESS,
      value: amountToSend
    });
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

    // Check new balances
    const newSenderBalance = await wallet.getBalance();
    const recipientBalance = await provider.getBalance(TO_ADDRESS);

    console.log(`\n4️⃣ Final balances:`);
    console.log(`   Sender: ${ethers.utils.formatEther(newSenderBalance)} BTCD`);
    console.log(`   Recipient: ${ethers.utils.formatEther(recipientBalance)} BTCD`);
    console.log(`\n✅ Transfer completed successfully!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('   Data:', error.data);
    }
    process.exit(1);
  }
}

sendNative();
