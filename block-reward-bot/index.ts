import { ethers } from 'ethers';

const RPC_URL = process.env.RPC_URL || 'http://geth1:8545';
const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const REWARD_AMOUNT = ethers.parseEther('2'); // 2 BTCD

// Known validators
const VALIDATORS = [
  '0xcd2d7b8aa8a679b59a03eb0f4870518bc266bc7f', // geth1
  '0x45c3c0c9c2c4416b23966fd4e3acec8e84a0f434'  // geth2
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(ADMIN_KEY, provider);

let lastBlock = 0;
let validatorIndex = 0;

console.log('[Block Reward] Service started');
console.log('[Block Reward] Sending 2 BTCD rewards to validators every block...');
console.log(`[Block Reward] RPC: ${RPC_URL}`);
console.log(`[Block Reward] Validators: ${VALIDATORS.join(', ')}`);

async function processBlock(blockNumber: number) {
  try {
    // Alternate between validators (simple round-robin)
    const validator = VALIDATORS[validatorIndex];
    validatorIndex = (validatorIndex + 1) % VALIDATORS.length;
    
    console.log(`[Block ${blockNumber}] Sending 2 BTCD reward to ${validator}...`);
    
    const tx = await wallet.sendTransaction({
      to: validator,
      value: REWARD_AMOUNT,
      gasLimit: 21000,
      gasPrice: 1000000000n // 1 gwei = 10^9 wei
    });
    
    await tx.wait();
    
    console.log(`[Block ${blockNumber}] ✓ Reward sent (tx: ${tx.hash})`);
    
  } catch (error: any) {
    console.error(`[Block ${blockNumber}] Error:`, error.message);
    // If insufficient funds, log and continue (don't crash)
    if (error.message.includes('insufficient funds')) {
      console.error(`[Block ${blockNumber}] ⚠️  Admin account needs funding!`);
    }
  }
}

async function pollBlocks() {
  try {
    const currentBlock = await provider.getBlockNumber();
    
    // Only process one block at a time to avoid nonce conflicts
    if (currentBlock > lastBlock) {
      const blockToProcess = lastBlock + 1;
      console.log(`[Block Reward] New block detected: ${blockToProcess}`);
      
      await processBlock(blockToProcess);
      lastBlock = blockToProcess;
    }
  } catch (error: any) {
    console.error('[Block Reward] Polling error:', error.message);
  }
}

// Poll every 3 seconds (block time is 5s)
setInterval(pollBlocks, 3000);

// Initial run
pollBlocks();

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n[Block Reward] Shutting down...');
  process.exit(0);
});
