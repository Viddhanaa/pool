import { Request, Response, NextFunction } from 'express';
import { verifyMessage } from 'ethers';
import { query } from '../db/postgres';
import { redis } from '../db/redis';

export interface AuthenticatedRequest extends Request {
  miner?: {
    minerId: number;
    wallet: string;
  };
}

export async function requireMinerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { minerId, signature, timestamp, nonce } = req.body;

  if (!minerId || !signature || !timestamp || !nonce) {
    return res.status(400).json({
      error: 'minerId, signature, timestamp, and nonce required'
    });
  }

  try {
    // Check timestamp freshness (within 30s)
    if (Math.abs(Date.now() - timestamp) > 30000) {
      return res.status(401).json({ error: 'Stale request' });
    }

    // Check nonce not reused
    const nonceKey = `nonce:${minerId}:${nonce}`;
    const exists = await redis.get(nonceKey);
    if (exists) {
      return res.status(401).json({ error: 'Nonce reused' });
    }

    // Get miner's wallet
    const [miner] = await query<{ wallet_address: string }>(
      'SELECT wallet_address FROM miners WHERE miner_id = $1',
      [minerId]
    );
    if (!miner) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    // Verify signature
    const message = `${minerId}:${timestamp}:${nonce}`;
    const recovered = verifyMessage(message, signature).toLowerCase();
    if (recovered !== miner.wallet_address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Mark nonce as used (30s TTL)
    await redis.setex(nonceKey, 30, '1');

    // Attach miner info to request
    req.miner = {
      minerId,
      wallet: miner.wallet_address
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export async function requireMinerAuthOptional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { minerId, signature, timestamp, nonce } = req.body;

  // If no auth params provided, continue without authentication
  if (!minerId || !signature || !timestamp || !nonce) {
    return next();
  }

  try {
    // Check timestamp freshness (within 30s)
    if (Math.abs(Date.now() - timestamp) > 30000) {
      return res.status(401).json({ error: 'Stale request' });
    }

    // Check nonce not reused
    const nonceKey = `nonce:${minerId}:${nonce}`;
    const exists = await redis.get(nonceKey);
    if (exists) {
      return res.status(401).json({ error: 'Nonce reused' });
    }

    // Get miner's wallet
    const [miner] = await query<{ wallet_address: string }>(
      'SELECT wallet_address FROM miners WHERE miner_id = $1',
      [minerId]
    );
    if (!miner) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    // Verify signature
    const message = `${minerId}:${timestamp}:${nonce}`;
    const recovered = verifyMessage(message, signature).toLowerCase();
    if (recovered !== miner.wallet_address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Mark nonce as used (30s TTL)
    await redis.setex(nonceKey, 30, '1');

    // Attach miner info to request
    req.miner = {
      minerId,
      wallet: miner.wallet_address
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
