const { ethers } = require('ethers');

// Connect to geth1
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

// Pool wallet (has funds from coinbase/mining)
const poolPrivateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113b37c3f3a1181096b4f6f8f12';
const poolWallet = new ethers.Wallet(poolPrivateKey, provider);

// Target addresses (miners)
const targets = [
  '0x90e76fe52CC9F89e863B9B8067c6C8312F9f4697',
  '0xaf16CFE6334a211A7240928f72F3913c4700Ee65',
  '0x781EA68C378c9AE8AB522cB12592B2F369a7985B',
  '0x78C9361Ec496d05E5f11f77002eD088C8Ff63136',
  '0x731604449fe66e78cb5aEff1512A58c4F0C5bb3A',
  '0x7A55B83B9546f7302d3e1218b0FF5f7cCAB3ae1e',
  '0x3790Fb5f5e9486691adC86e262ddA222c3a02579',
  '0x9f5bf92c65Cf9360FEEeC54895B45Dd46145AA90',
  '0x1C6dc474C40d563506eb8374d0d78079d0a19fD3',
  '0x98f1bA6889C6339E961ABEE01fF40eBbc98EC3d7',
];

async function generateTransactions(count = 100) {
  console.log('Generating', count, 'transactions...');
  
  let balance = await provider.getBalance(poolWallet.address);
  console.log('Pool wallet balance:', ethers.utils.formatEther(balance), 'VIDDHANA');
  
  for (let i = 0; i < count; i++) {
    try {
      // Random target
      const target = targets[Math.floor(Math.random() * targets.length)];
      
      // Random amount between 0.1 and 2 VIDDHANA
      const amount = ethers.utils.parseEther((Math.random() * 1.9 + 0.1).toFixed(4));
      
      const tx = await poolWallet.sendTransaction({
        to: target,
        value: amount,
        gasLimit: 21000,
      });
      
      console.log(`[${i + 1}/${count}] TX sent: ${tx.hash.substring(0, 18)}... (${ethers.utils.formatEther(amount)} VIDDHANA to ${target.substring(0, 10)}...)`);
      
      // Wait for confirmation
      await tx.wait();
      
      // Small delay between transactions
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Error on transaction ${i + 1}:`, error.message);
      
      // If out of funds, stop
      if (error.message.includes('insufficient funds')) {
        console.log('Insufficient funds, stopping.');
        break;
      }
    }
  }
  
  console.log('Finished generating transactions');
}

// Run
const txCount = process.argv[2] ? parseInt(process.argv[2]) : 50;
generateTransactions(txCount).catch(console.error);
