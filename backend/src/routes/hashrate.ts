import { Router } from 'express';
// JWT auth removed per requirement
// import { AuthedRequest, requireAuth } from '../middleware/auth';
import { updateHashrate } from '../services/hashrateService';

const router = Router();

router.post('/hashrate', async (req, res) => {
  const minerId = Number(req.body?.minerId ?? req.body?.miner_id);
  const hashrate = Number(req.body?.hashrate);
  const deviceType = req.body?.deviceType ?? req.body?.device_type;

  if (!Number.isFinite(minerId)) return res.status(400).json({ error: 'minerId required' });
  if (!Number.isFinite(hashrate) || hashrate <= 0) return res.status(400).json({ error: 'Invalid hashrate' });

  try {
    await updateHashrate(minerId, hashrate, deviceType);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
