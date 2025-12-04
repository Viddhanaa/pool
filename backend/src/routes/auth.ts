import { Router } from 'express';
import { registerMiner, registerMinerOpen } from '../services/authService';
import { generateChallenge, validateChallenge, verifySignature } from '../services/signatureService';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.post(
  '/auth/challenge',
  rateLimit({ key: 'auth_challenge', limit: 5, windowSeconds: 60, idFrom: (req) => req.ip ?? 'anon' }),
  async (req, res) => {
  const wallet = req.body?.wallet_address ?? req.body?.wallet;
  if (!wallet) return res.status(400).json({ error: 'wallet_address required' });
  const { challenge, expiresAt } = await generateChallenge(wallet);
  res.json({ challenge, expires_at: expiresAt });
  }
);

router.post('/auth/register', async (req, res) => {
  const { wallet_address, signature, challenge, hashrate, device_type } = req.body ?? {};
  const wallet = wallet_address ?? req.body?.wallet;
  try {
    if (!wallet || !signature || !challenge) {
      return res.status(400).json({ error: 'wallet_address, signature, challenge required' });
    }
    const valid = await validateChallenge(wallet, challenge);
    if (!valid || !verifySignature(wallet, signature, challenge)) {
      return res.status(400).json({ error: 'Invalid signature or challenge' });
    }
    const result = await registerMiner({
      wallet,
      signature,
      message: challenge,
      hashrate: Number(hashrate),
      deviceType: device_type
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// Open registration: DISABLED - Critical security vulnerability
// This endpoint allowed anyone to register with any wallet address without verification
router.post('/auth/register-open', (req, res) => {
  res.status(410).json({
    error: 'This endpoint is deprecated and disabled due to security concerns. Use /auth/register with signature verification.'
  });
});

// Signature-based login disabled when JWT auth is removed

export default router;
