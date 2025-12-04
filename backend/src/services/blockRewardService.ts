import { ethers } from 'ethers';
import { log } from '../lib/logger';
import { config } from '../config/env';

/**
 * Block Reward Service
 * Automatically sends block rewards to validators after each block
 */

const BLOCK_REWARD_CONTRACT = '0x0000000000000000000000000000000000000001'; // Deploy later
const REWARD_AMOUNT = ethers.parseEther('2'); // 2 VIDDHANA per block

let provider: ethers.JsonRpcProvider;
let wallet: ethers.Wallet;
let lastProcessedBlock = 0;

export async function initBlockRewardService(privateKey: string) {
  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  wallet = new ethers.Wallet(privateKey, provider);
  
  const currentBlock = await provider.getBlockNumber();
  lastProcessedBlock = currentBlock;
  
  log.info('Block reward service initialized', { 
    currentBlock,
    rewardAmount: '2 VIDDHANA'
  });
  
  startBlockWatcher();
}

async function startBlockWatcher() {
  provider.on('block', async (blockNumber: number) => {
    try {
      if (blockNumber <= lastProcessedBlock) return;
      
      const block = await provider.getBlock(blockNumber);
      if (!block || !block.miner) return;
      
      // Send reward to miner (validator)
      await sendRewardToValidator(block.miner, blockNumber);
      
      lastProcessedBlock = blockNumber;
    } catch (error) {
      log.error('Error processing block reward', { blockNumber, error });
    }
  });
  
  log.info('Block watcher started');
}

async function sendRewardToValidator(validator: string, blockNumber: number) {
  try {
    // Send 2 VIDDHANA directly to the validator
    const tx = await wallet.sendTransaction({
      to: validator,
      value: REWARD_AMOUNT,
      gasLimit: 21000
    });
    
    await tx.wait();
    
    log.info('Block reward sent', {
      blockNumber,
      validator,
      amount: '2 VIDDHANA',
      txHash: tx.hash
    });
    
    return tx.hash;
  } catch (error) {
    log.error('Error sending block reward', { validator, blockNumber, error });
    throw error;
  }
}

export async function getValidatorRewards(address: string): Promise<string> {
  // Query total rewards from blockchain
  const filter = {
    topics: [
      ethers.id('Transfer(address,address,uint256)'),
      null,
      ethers.zeroPadValue(address, 32)
    ]
  };
  
  const logs = await provider.getLogs({
    ...filter,
    fromBlock: 0,
    toBlock: 'latest'
  });
  
  let totalRewards = BigInt(0);
  for (const log of logs) {
    const value = ethers.getBigInt(log.data);
    totalRewards += value;
  }
  
  return ethers.formatEther(totalRewards);
}
