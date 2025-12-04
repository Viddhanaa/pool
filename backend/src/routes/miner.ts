import { Router } from 'express';
import { registerMinerLite, recordHeartbeatLite, getSampleTasks, submitTaskResult } from '../services/minerLiteService';

const router = Router();

// Dev-open registration: no signature or auth required
router.post('/miner/register', async (req, res) => {
  const wallet = req.body?.wallet_address ?? req.body?.wallet;
  const minerType = req.body?.miner_type ?? req.body?.type;
  const deviceInfo = req.body?.device_info ?? req.body?.deviceInfo;
  const hashrate = Number(req.body?.hashrate ?? 0);

  if (!wallet) {
    return res.status(400).json({ error: 'wallet_address required' });
  }

  try {
    const { minerId } = await registerMinerLite({ wallet, minerType, deviceInfo, hashrate });
    res.json({ minerId });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.post('/miner/heartbeat', async (req, res) => {
  const minerId = Number(req.body?.miner_id ?? req.body?.minerId);
  const metrics = req.body?.metrics;
  if (!Number.isFinite(minerId)) {
    return res.status(400).json({ error: 'miner_id required' });
  }
  try {
    await recordHeartbeatLite(minerId, metrics, req.ip);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/miner/tasks', async (req, res) => {
  const limit = Number(req.query.limit ?? 5);
  res.json({ tasks: getSampleTasks(limit) });
});

router.post('/miner/tasks/submit', async (req, res) => {
  const minerId = Number(req.body?.miner_id ?? req.body?.minerId);
  const taskId = req.body?.task_id ?? req.body?.taskId;
  const result = req.body?.result ?? {};
  const signature = req.body?.signature;
  const timestamp = req.body?.timestamp ? Number(req.body.timestamp) : Date.now();

  if (!Number.isFinite(minerId) || !taskId) {
    return res.status(400).json({ error: 'miner_id and task_id required' });
  }

  try {
    const entry = await submitTaskResult({ minerId, taskId, result, signature, timestamp });
    res.json({ stored: true, entry });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
