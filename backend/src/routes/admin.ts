import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { query, pool } from '../db/postgres';
import { clearConfigCache } from '../services/configService';
import { getAdminMetrics } from '../services/adminMetricsService';
import { config } from '../config/env';
import { requireAdminAuth } from '../middleware/adminAuth';
import { normalizeConfigValue, ConfigKey } from '../config/systemConfig';
import { getHealth } from '../services/healthService';
import {
  listAdminWithdrawals,
  markWithdrawalFailed,
  retryWithdrawalAdmin
} from '../services/adminWithdrawalService';
import { DatabaseMonitor } from '../services/databaseMonitor';

const router = Router();
const dbMonitor = new DatabaseMonitor(pool as Pool);

// Login route - BEFORE auth middleware so it's public
router.post('/login', (req, res) => {
  const password = req.body?.password;
  if (!password || password !== config.adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = jwt.sign({ role: 'admin' }, config.adminJwtSecret, { expiresIn: '12h' });
  res.json({ token });
});

// All other routes in this router require admin auth
router.use(requireAdminAuth);

router.get('/health', async (_req, res) => {
  const health = await getHealth();
  res.json(health);
});

router.post('/config', async (req, res) => {
  const { key, value } = req.body ?? {};
  const normalized = normalizeConfigValue(key as ConfigKey, value);
  if ('error' in normalized) {
    return res.status(400).json({ error: normalized.error });
  }

  await query(
    `INSERT INTO system_config (config_key, config_value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
    [normalized.key, normalized.value]
  );
  clearConfigCache();
  res.json({ ok: true });
});

router.get('/config', async (_req, res) => {
  const rows = await query<{ config_key: string; config_value: unknown; updated_at: string }>(
    `SELECT config_key, config_value, updated_at FROM system_config`
  );
  res.json(rows);
});

router.get('/metrics', async (_req, res) => {
  const metrics = await getAdminMetrics();
  res.json(metrics);
});

router.get('/withdrawals', async (_req, res) => {
  const rows = await listAdminWithdrawals();
  res.json(rows);
});

router.post('/withdrawals/:id/retry', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid withdrawal id' });
  }
  await retryWithdrawalAdmin(id);
  res.json({ ok: true });
});

router.post('/withdrawals/:id/mark-failed', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid withdrawal id' });
  }
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason : undefined;
  await markWithdrawalFailed(id, reason);
  res.json({ ok: true });
});

// Database monitoring endpoints
router.get('/db/slow-queries', async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const queries = await dbMonitor.getSlowQueries(limit);
  res.json(queries);
});

router.get('/db/pool-stats', async (_req, res) => {
  const stats = dbMonitor.getPoolStats();
  res.json(stats);
});

router.get('/db/size', async (_req, res) => {
  const size = await dbMonitor.getDatabaseSize();
  res.json({ size });
});

router.get('/db/table-sizes', async (_req, res) => {
  const tables = await dbMonitor.getTableSizes();
  res.json(tables);
});

router.get('/db/index-usage', async (_req, res) => {
  const indexes = await dbMonitor.getIndexUsage();
  res.json(indexes);
});

router.post('/db/reset-stats', async (_req, res) => {
  await dbMonitor.resetStats();
  res.json({ ok: true });
});

export default router;
