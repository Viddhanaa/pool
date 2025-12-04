// TDD: Verify Geth JSON-RPC availability, admin wallet prefunded, and ability to send a tx
// Usage:
//   ADMIN_PRIVATE_KEY=0x... RECIPIENT=0x... node scripts/test-geth.js
// If ADMIN_PRIVATE_KEY is not provided, a default dev key (funded in genesis) is used.

const { ethers } = require('ethers');

async function main() {
  const rpc = process.env.GETH_RPC_URL || 'http://localhost:8545';
  const provider = new ethers.providers.JsonRpcProvider(rpc);

  const defaultAdminKey = process.env.ADMIN_PRIVATE_KEY ||
    '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113b37c3f3a1181096b4f6f8f12'; // dev key
  const wallet = new ethers.Wallet(defaultAdminKey, provider);
  const adminAddress = await wallet.getAddress();

  console.log('RPC:', rpc);
  const network = await provider.getNetwork();
  console.log('Network chainId:', Number(network.chainId));
  if (process.env.STRICT_CHAINID === '1' && Number(network.chainId) !== 202401) {
    throw new Error('Unexpected chainId; expected 202401');
  }

  const bal = await provider.getBalance(adminAddress);
  console.log('Admin address:', adminAddress);
  console.log('Admin balance (wei):', bal.toString());
  if (bal <= 0n) {
    throw new Error('Admin wallet has zero balance');
  }

  const recipient = process.env.RECIPIENT || ethers.Wallet.createRandom().address;
  const amountWei = ethers.utils.parseEther('1'); // 1 VIDDHANA

  console.log('Sending 1 VIDDHANA to:', recipient);
  const tx = await wallet.sendTransaction({
    to: recipient,
    value: amountWei,
    gasLimit: ethers.BigNumber.from(21000),
    gasPrice: ethers.utils.parseUnits('1', 'gwei'),
    type: 0,
  });
  const receipt = await provider.waitForTransaction(tx.hash);
  console.log('Tx hash:', receipt && receipt.hash);
  if (!receipt || receipt.status !== 1) {
    throw new Error('Transaction failed');
  }

  const recipientBal = await provider.getBalance(recipient);
  console.log('Recipient balance (wei):', recipientBal.toString());
  if (recipientBal.lt(amountWei)) {
    throw new Error('Recipient did not receive expected amount');
  }

  console.log('OK: JSON-RPC up, admin funded, tx confirmed');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
