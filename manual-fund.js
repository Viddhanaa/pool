#!/usr/bin/env node
/**
 * Manual funding script - Fund admin account from pre-mine or external source
 * Since all accounts are depleted, we need to:
 * 1. Use geth1 etherbase (mining account) which should have accumulated rewards
 * 2. Unlock it and send funds to admin account
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GETH_CONTAINER = 'chocochoco-geth1-1';
const GETH1_ADDRESS = '0xcd2d7b8aa8a679b59a03eb0f4870518bc266bc7f';
const ADMIN_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const AMOUNT = '100000'; // 100,000 VIDDHANA for pool operations

console.log('🔧 Manual Fund Script');
console.log('=====================');
console.log(`From (Geth1): ${GETH1_ADDRESS}`);
console.log(`To (Admin): ${ADMIN_ADDRESS}`);
console.log(`Amount: ${AMOUNT} VIDDHANA\n`);

async function checkBalance(address) {
  const cmd = `curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["${address}","latest"],"id":1}'`;
  const { stdout } = await execAsync(cmd);
  const data = JSON.parse(stdout);
  const wei = BigInt(data.result);
  const eth = Number(wei) / 1e18;
  return eth;
}

async function unlockAndSend() {
  try {
    console.log('1️⃣ Checking current balances...');
    const geth1Bal = await checkBalance(GETH1_ADDRESS);
    const adminBal = await checkBalance(ADMIN_ADDRESS);
    console.log(`   Geth1: ${geth1Bal.toFixed(2)} VIDDHANA`);
    console.log(`   Admin: ${adminBal.toFixed(2)} VIDDHANA\n`);

    if (geth1Bal < parseFloat(AMOUNT)) {
      console.log(`❌ Insufficient balance in Geth1 account!`);
      console.log(`   Need: ${AMOUNT} VIDDHANA`);
      console.log(`   Have: ${geth1Bal.toFixed(2)} VIDDHANA\n`);
      console.log('💡 Options:');
      console.log('   1. Wait for more mining rewards to accumulate');
      console.log('   2. Reduce the AMOUNT in this script');
      console.log('   3. Check genesis.json for pre-mine allocation\n');
      return;
    }

    console.log('2️⃣ Unlocking Geth1 account in geth console...');
    console.log('   (This requires the account password from geth keystore)\n');
    
    // Create geth console command
    const gethCmd = `
      docker exec -i ${GETH_CONTAINER} geth attach /data/geth.ipc << 'EOF'
personal.unlockAccount("${GETH1_ADDRESS}", "", 300)
eth.sendTransaction({from: "${GETH1_ADDRESS}", to: "${ADMIN_ADDRESS}", value: web3.toWei(${AMOUNT}, "ether"), gas: 21000})
exit
EOF
    `.trim();

    console.log('📝 Command to run:');
    console.log(gethCmd);
    console.log('\n⚠️  Manual execution required!');
    console.log('   Copy the above command and run it, or:');
    console.log('   1. docker exec -it chocochoco-geth1-1 geth attach /data/geth.ipc');
    console.log(`   2. personal.unlockAccount("${GETH1_ADDRESS}", "PASSWORD", 300)`);
    console.log(`   3. eth.sendTransaction({from: "${GETH1_ADDRESS}", to: "${ADMIN_ADDRESS}", value: web3.toWei(${AMOUNT}, "ether"), gas: 21000})`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

unlockAndSend();
