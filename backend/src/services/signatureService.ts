import { randomUUID } from 'crypto';
import { verifyMessage } from 'ethers';
import { redis } from '../db/redis';

const CHALLENGE_TTL_SECONDS = 300;

function normalizeWallet(wallet: string) {
  return wallet?.toLowerCase();
}

export async function generateChallenge(walletAddress: string) {
  const nonce = randomUUID();
  const ts = Date.now();
  const challenge = `Sign this message to verify ownership:${nonce}:${ts}`;
  const key = challengeKey(walletAddress, nonce);
  await redis.setex(key, CHALLENGE_TTL_SECONDS, String(ts));
  return { challenge, expiresAt: ts + CHALLENGE_TTL_SECONDS * 1000 };
}

export async function validateChallenge(walletAddress: string, challenge: string): Promise<boolean> {
  const parts = challenge.split(':');
  const ts = Number(parts.pop());
  const nonce = parts.pop()?.trim();
  if (!nonce || !Number.isFinite(ts)) return false;
  if (Date.now() - ts > CHALLENGE_TTL_SECONDS * 1000) return false;

  const key = challengeKey(walletAddress, nonce);
  const storedTs = await redis.get(key);
  if (!storedTs) return false;
  await redis.del(key);
  return true;
}

export function verifySignature(walletAddress: string, signature: string, challenge: string): boolean {
  const recovered = verifyMessage(challenge, signature).toLowerCase();
  return recovered === normalizeWallet(walletAddress);
}

function challengeKey(wallet: string, nonce: string) {
  return `challenge:${normalizeWallet(wallet)}:${nonce}`;
}
