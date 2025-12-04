import { Router } from 'express';
// JWT auth removed per requirement; keep route open with rate limits applied in service
// import { AuthedRequest, requireAuth } from '../middleware/auth';
import { handlePing, RateLimitError, NotFoundError } from '../services/pingService';

const router = Router();

// Open ping endpoint: identify miner by explicit param
router.post('/ping', async (req, res) => {
  const minerId = Number(req.body?.minerId ?? req.body?.miner_id);
  if (!Number.isFinite(minerId)) {
    return res.status(400).json({ error: 'minerId required' });
  }

  try {
    await handlePing(minerId, req.ip);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return res.status(429).json({ error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'failed to record ping', detail: String(err) });
  }
});

export default router;
