import { Router } from 'express';
import { responseCache } from '../services/responseCache';

const router = Router();

// Apply caching middleware to stats endpoint (30s TTL - frequently updated)
router.get('/miner/stats', responseCache.middleware('miner:stats', { ttl: 30 }), async (req, res) => {
  const minerId = Number(req.query.minerId ?? req.query.miner_id);
  if (!Number.isFinite(minerId)) {
    return res.status(400).json({ error: 'minerId required' });
  }

  try {
    const { getMinerStats } = await import('../services/statsService');
    const stats = await getMinerStats(minerId);
    res.json(stats);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

// Cache earnings history for 5 minutes (historical data doesn't change often)
router.get('/miner/earnings-history', responseCache.middleware('miner:earnings', { ttl: 300 }), async (req, res) => {
  const minerId = Number(req.query.minerId ?? req.query.miner_id);
  const period = Number(req.query.periodDays ?? 7);
  if (!Number.isFinite(minerId)) {
    return res.status(400).json({ error: 'minerId required' });
  }

  const { getEarningsHistory } = await import('../services/statsService');
  const history = await getEarningsHistory(minerId, period);
  res.json(history);
});

// Cache hashrate history for 2 minutes
router.get('/miner/hashrate-history', responseCache.middleware('miner:hashrate', { ttl: 120 }), async (req, res) => {
  const minerId = Number(req.query.minerId ?? req.query.miner_id);
  if (!Number.isFinite(minerId)) {
    return res.status(400).json({ error: 'minerId required' });
  }
  const { getHashrateHistory } = await import('../services/statsService');
  const rows = await getHashrateHistory(minerId);
  res.json(rows);
});

// Cache active history for 2 minutes
router.get('/miner/active-history', responseCache.middleware('miner:active', { ttl: 120 }), async (req, res) => {
  const minerId = Number(req.query.minerId ?? req.query.miner_id);
  if (!Number.isFinite(minerId)) {
    return res.status(400).json({ error: 'minerId required' });
  }
  const { getActiveMinutesHistory } = await import('../services/statsService');
  const rows = await getActiveMinutesHistory(minerId);
  res.json(rows);
});

export default router;
