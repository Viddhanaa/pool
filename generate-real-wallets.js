const ethers = require('ethers');

console.log('Generating 10 real wallet addresses...\n');

const wallets = [];
for (let i = 0; i < 10; i++) {
  const wallet = ethers.Wallet.createRandom();
  wallets.push({
    minerId: i + 2,
    address: wallet.address,
    privateKey: wallet.privateKey
  });
  console.log(`Miner ${i + 2}: ${wallet.address}`);
}

console.log('\n--- SQL UPDATE COMMANDS ---');
for (const w of wallets) {
  console.log(`UPDATE miners SET wallet_address = '${w.address}' WHERE id = ${w.minerId};`);
}
