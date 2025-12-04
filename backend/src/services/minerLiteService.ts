import { redis } from '../db/redis';
import { query } from '../db/postgres';
import { handlePing } from './pingService';
import { log } from '../lib/logger';
import { verifyMessage } from 'ethers';

const MAX_HASHRATE = 1_000_000_000_000; // cap to prevent fake hashrate spam

export async function registerMinerLite(params: {
  wallet: string;
  minerType?: string;
  deviceInfo?: any;
  hashrate?: number;
}) {
  const wallet = params.wallet.toLowerCase();
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    throw new Error('Invalid wallet address');
  }
  const hashrateRaw = Number(params.hashrate ?? 0);
  if (!Number.isFinite(hashrateRaw) || hashrateRaw <= 0 || hashrateRaw > MAX_HASHRATE) {
    throw new Error('Invalid hashrate');
  }
  const hashrate = hashrateRaw;
  const deviceInfo = params.deviceInfo ?? {};
  const minerType = params.minerType ?? 'VALIDATOR';

  const rows = await query<{ miner_id: number }>(
    `INSERT INTO miners (wallet_address, device_type, hashrate, status, miner_type, device_info)
     VALUES ($1, $2, $3, 'offline', $4, $5)
     ON CONFLICT (wallet_address) DO UPDATE
       SET device_type = EXCLUDED.device_type,
           hashrate = EXCLUDED.hashrate,
           miner_type = EXCLUDED.miner_type,
           device_info = EXCLUDED.device_info
     RETURNING miner_id`,
    [wallet, params.minerType ?? null, hashrate, minerType, deviceInfo]
  );

  return { minerId: rows[0].miner_id, wallet };
}

export async function recordHeartbeatLite(minerId: number, metrics?: any, ip?: string) {
  const [miner] = await query<{ miner_id: number }>(`SELECT miner_id FROM miners WHERE miner_id = $1`, [minerId]);
  if (!miner) {
    throw new Error('Miner not found');
  }
  await handlePing(minerId, ip);
  if (metrics) {
    await redis.setex(`metrics:${minerId}`, 600, JSON.stringify({ metrics, at: new Date().toISOString() }));
  }
}

export function getSampleTasks(limit = 5) {
  const samples = [
    {
      task_id: 'oracle_price_1',
      type: 'VALIDATE_ORACLE_PRICE',
      payload: { symbol: 'BTCD/USDC', sources: ['binance', 'okx', 'coingecko'] }
    },
    {
      task_id: 'chain_state_1',
      type: 'CHAIN_STATE_CHECK',
      payload: { rpc: 'local', check: 'latest_block' }
    }
  ];
  return samples.slice(0, limit);
}

export async function submitTaskResult(input: {
  minerId: number;
  taskId: string;
  result: any;
  signature?: string;
  timestamp?: number;
}) {
  // Get miner's wallet address
  const [miner] = await query<{ wallet_address: string }>(
    'SELECT wallet_address FROM miners WHERE miner_id = $1',
    [input.minerId]
  );
  if (!miner) {
    throw new Error('Miner not found');
  }

  // Verify signature if provided (optional for now, will be required in production)
  if (input.signature && input.timestamp) {
    const message = JSON.stringify({
      task_id: input.taskId,
      result: input.result,
      timestamp: input.timestamp
    });

    const recovered = verifyMessage(message, input.signature).toLowerCase();
    if (recovered !== miner.wallet_address.toLowerCase()) {
      throw new Error('Invalid signature');
    }

    // Check timestamp freshness (within 60 seconds)
    if (Math.abs(Date.now() - input.timestamp) > 60000) {
      throw new Error('Stale submission');
    }
  }

  const entry = {
    minerId: input.minerId,
    taskId: input.taskId,
    result: input.result,
    signature: input.signature,
    verified: true,
    at: new Date().toISOString()
  };

  try {
    await redis.lpush('task_submissions', JSON.stringify(entry));
    await redis.ltrim('task_submissions', 0, 999);
  } catch (err) {
    log.error('store task submission failed', err);
  }
  return entry;
}
