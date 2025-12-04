import { verifyMessage } from 'ethers';
import { query } from '../db/postgres';

const REGISTER_MESSAGE_PREFIX = 'VIDDHANA Miner Register:';

const MIN_HASHRATE = 1;
const MAX_HASHRATE = 1_000_000_000; // 1 GH/s reasonable max

function validateHashrate(hashrate: number): number {
  if (!Number.isFinite(hashrate)) {
    throw new Error('Invalid hashrate: must be number');
  }
  if (hashrate < MIN_HASHRATE) {
    throw new Error(`Hashrate too low: min ${MIN_HASHRATE}`);
  }
  if (hashrate > MAX_HASHRATE) {
    throw new Error(`Hashrate too high: max ${MAX_HASHRATE}`);
  }
  return hashrate;
}

function isValidEthAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function registerMiner(params: {
  wallet: string;
  signature: string;
  message: string;
  hashrate: number;
  deviceType?: string;
}) {
  const { wallet, signature, message, hashrate, deviceType } = params;
  if (!wallet || !signature || !message) throw new Error('Wallet, signature, and challenge required');
  if (!Number.isFinite(hashrate) || hashrate <= 0) throw new Error('Invalid hashrate');

  const recovered = verifyMessage(message, signature).toLowerCase();
  if (recovered !== wallet.toLowerCase()) {
    throw new Error('Signature verification failed');
  }

  const rows = await query<{ miner_id: number }>(
    `INSERT INTO miners (wallet_address, device_type, hashrate, status)
     VALUES ($1, $2, $3, 'offline')
     ON CONFLICT (wallet_address) DO UPDATE
       SET device_type = EXCLUDED.device_type,
           hashrate = EXCLUDED.hashrate
     RETURNING miner_id`,
    [wallet, deviceType ?? null, hashrate]
  );

  const minerId = rows[0].miner_id;
  return { minerId, message };
}

// Open registration: no signature required (for frictionless miner onboarding)
export async function registerMinerOpen(params: {
  wallet: string;
  hashrate: number;
  deviceType?: string;
}) {
  const { wallet, hashrate, deviceType } = params;
  if (!wallet) throw new Error('Wallet required');
  if (!Number.isFinite(hashrate) || hashrate <= 0) throw new Error('Invalid hashrate');

  const rows = await query<{ miner_id: number }>(
    `INSERT INTO miners (wallet_address, device_type, hashrate, status)
     VALUES ($1, $2, $3, 'offline')
     ON CONFLICT (wallet_address) DO UPDATE
       SET device_type = EXCLUDED.device_type,
           hashrate = EXCLUDED.hashrate
     RETURNING miner_id`,
    [wallet, deviceType ?? null, hashrate]
  );

  const minerId = rows[0].miner_id;
  return { minerId };
}
