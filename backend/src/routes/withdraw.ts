import { Router } from 'express';
// JWT auth removed per requirement
// import { AuthedRequest, requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { listWithdrawals, requestWithdrawal } from '../services/withdrawalService';

const router = Router();

router.post(
  '/withdraw',
  rateLimit({ key: 'withdraw', limit: 5, windowSeconds: 60, idFrom: (req) => Number(req.body?.miner_id ?? req.body?.minerId) }),
  async (req, res) => {
  const minerId = Number(req.body?.minerId ?? req.body?.miner_id);
  const amount = Number(req.body?.amount);
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const sharedSecret = req.headers['x-withdraw-secret'] as string | undefined;
  const expectedSecret = (await import('../config/env')).config.withdrawSharedSecret;

  // Only check secret if it's configured (non-empty)
  if (expectedSecret && expectedSecret.length > 0 && sharedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized withdraw' });
  }

  if (!Number.isFinite(minerId) || !Number.isFinite(amount)) {
    return res.status(400).json({ error: 'minerId and amount are required' });
  }

  try {
    const withdrawalId = await requestWithdrawal(minerId, amount, idempotencyKey);
    res.json({ withdrawalId });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
  }
);

router.get('/withdrawals', async (req, res) => {
  // Enforce minerId to be provided via query params for explicitness
  const minerId = Number(req.query.minerId ?? req.query.miner_id);
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);

  if (!Number.isFinite(minerId)) {
    return res.status(400).json({ error: 'minerId required' });
  }

  const rows = await listWithdrawals(minerId, { limit, offset });
  res.json(rows);
});

export default router;
