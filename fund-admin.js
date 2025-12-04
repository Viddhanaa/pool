const { ethers } = require('ethers');

const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
const funderKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const adminAddr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const funder = new ethers.Wallet(funderKey, provider);

async function fundAdmin() {
  try {
    const balance = await provider.getBalance(adminAddr);
    console.log('💰 Current admin balance:', ethers.utils.formatEther(balance), 'BTCD');
    
    if (balance.lt(ethers.utils.parseEther('1000'))) {
      console.log('💸 Funding admin wallet with 10,000 BTCD...');
      const tx = await funder.sendTransaction({
        to: adminAddr,
        value: ethers.utils.parseEther('10000'),
        gasLimit: 21000
      });
      console.log('📤 Transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Admin wallet funded successfully!');
      
      const newBalance = await provider.getBalance(adminAddr);
      console.log('💰 New balance:', ethers.utils.formatEther(newBalance), 'BTCD');
    } else {
      console.log('✅ Admin wallet already has sufficient funds');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fundAdmin();
