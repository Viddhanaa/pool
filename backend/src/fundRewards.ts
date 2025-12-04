import { ethers } from 'ethers';

async function fundRewardsWallet() {
  const rpcUrls = (
    process.env.RPC_URLS?.split(',') ||
    (process.env.RPC_URL ? [process.env.RPC_URL] : [
      'http://geth1:8545',
      'http://geth2:8545'
    ])
  );
  
  // Use admin account (has plenty of balance from mining)
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  
  for (const url of rpcUrls) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      const fromWallet = new ethers.Wallet(adminPrivateKey, provider);
      
      // Rewards wallet - correct address from private key
      const toAddress = '0x63FaC9201494f0bd17B9892B9fae4d52fe3BD377';
      
      console.log('🔗 RPC:', url);
      console.log('📤 From (Admin):', fromWallet.address);
      console.log('📥 To (Rewards):', toAddress);
      
      const balance = await provider.getBalance(fromWallet.address);
      console.log('💰 Admin balance:', ethers.formatEther(balance), 'VIDDHANA');
      
      if (balance < ethers.parseEther('1000')) {
        console.log('⚠️  Insufficient admin funds, trying next RPC...');
        continue;
      }
      
      // Send 50,000 VIDDHANA to rewards wallet for pool operations
      const sendAmount = ethers.parseEther('50000');
      console.log(`📨 Sending ${ethers.formatEther(sendAmount)} VIDDHANA to pool...`);
      
      const tx = await fromWallet.sendTransaction({
        to: toAddress,
        value: sendAmount,
        gasLimit: 21000,
        gasPrice: ethers.parseUnits('1', 'gwei') // Low gas price
      });
      
      console.log('🔗 TX hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Transfer complete! Block:', receipt?.blockNumber);
      
      const newBalance = await provider.getBalance(toAddress);
      console.log('💰 New pool balance:', ethers.formatEther(newBalance), 'VIDDHANA');
      
      return;
    } catch (err) {
      console.error(`❌ Error with ${url}:`, (err as Error).message);
    }
  }
  
  console.error('❌ All RPCs failed');
}

fundRewardsWallet().catch(console.error);
