import { Router } from 'express';
import { getHealth } from '../services/healthService';

const router = Router();

router.get('/health', async (_req, res) => {
  const health = await getHealth();
  res.json(health);
});

export default router;
