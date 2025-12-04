import { JsonRpcProvider, Wallet, parseUnits, formatUnits } from 'ethers';
import { config } from '../config/env';

const rpcUrls = config.rpcUrls.length ? config.rpcUrls : [config.rpcUrl];

function buildSigner(rpcUrl: string) {
  if (!config.adminPrivateKey) throw new Error('ADMIN_PRIVATE_KEY missing');
  const provider = new JsonRpcProvider(rpcUrl);
  return { signer: new Wallet(config.adminPrivateKey, provider), provider };
}

export async function transferViddhana(toWallet: string, amount: number): Promise<string> {
  // Validate address format to prevent ENS lookup
  if (!toWallet.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error(`Invalid wallet address format: ${toWallet}`);
  }
  
  const value = parseUnits(amount.toString(), 18);
  let lastErr: unknown;
  for (const url of rpcUrls) {
    try {
      const { signer } = buildSigner(url);
      // Send transaction with explicit gasLimit to avoid ENS resolution
      const tx = await signer.sendTransaction({ 
        to: toWallet, 
        value,
        gasLimit: 21000, // Standard transfer
        gasPrice: 1000000000n // 1 gwei
      });
      await tx.wait(); // Wait for transaction to be mined
      return tx.hash;
    } catch (err) {
      lastErr = err;
      // try next RPC
      continue;
    }
  }
  throw lastErr ?? new Error('No RPC endpoints available');
}

export async function getBalance(address: string): Promise<string> {
  let lastErr: unknown;
  for (const url of rpcUrls) {
    try {
      const provider = new JsonRpcProvider(url);
      const bal = await provider.getBalance(address);
      return formatUnits(bal, 18);
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  throw lastErr ?? new Error('No RPC endpoints available');
}

// Alias for coin-specific naming
export const transferBtcd = transferViddhana;
