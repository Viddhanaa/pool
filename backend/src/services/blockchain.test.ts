import { describe, expect, test, vi, beforeEach } from 'vitest';
import { transferViddhana } from './blockchain';

const sendTransaction = vi.fn(async () => ({ hash: '0xhash', wait: vi.fn().mockResolvedValue({}) }));
const failingSend = vi.fn(async () => {
  throw new Error('rpc down');
});
const wallets: any[] = [];

vi.mock('../config/env', () => ({
  config: {
    adminPrivateKey: '0xpriv',
    rpcUrl: 'http://localhost:8545',
    rpcUrls: ['http://node1:8545', 'http://node2:8545']
  }
}));

vi.mock('ethers', () => ({
  JsonRpcProvider: vi.fn().mockImplementation((url: string) => ({ url })),
  Wallet: vi.fn().mockImplementation((_pk: string, provider: any) => {
    const wallet = {
      provider,
      connect: () => wallet,
      sendTransaction: provider.url === 'http://node1:8545' ? failingSend : sendTransaction
    };
    wallets.push(wallet);
    return wallet;
  }),
  parseUnits: (val: string | number, decimals: number) => `${val}-${decimals}`
}));

describe('blockchain transfer', () => {
  beforeEach(() => {
    sendTransaction.mockClear();
    failingSend.mockClear();
    wallets.length = 0;
  });

  test('sends transaction and returns hash', async () => {
    const hash = await transferViddhana('0xwallet', 1);
    expect(hash).toBe('0xhash');
    expect(sendTransaction).toHaveBeenCalled();
  });

  test('fails over to next RPC on error', async () => {
    const hash = await transferViddhana('0xwallet', 2);
    expect(failingSend).toHaveBeenCalled();
    expect(sendTransaction).toHaveBeenCalled();
    expect(hash).toBe('0xhash');
  });
});
