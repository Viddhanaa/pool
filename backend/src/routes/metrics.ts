import { Router } from 'express';
import { metricsHandler } from '../services/prometheusMetrics';

const router = Router();

// Prometheus metrics endpoint
router.get('/metrics', metricsHandler);

export default router;
