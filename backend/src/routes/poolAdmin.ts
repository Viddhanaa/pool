import { Router, Request, Response, NextFunction } from 'express';
import { log } from '../lib/logger';
import { requireAdminAuth, AdminRequest } from '../middleware/adminAuth';
import {
  CreatePoolRequest,
  CreatePoolResponse,
  PausePoolRequest,
  SetRewardWeightsRequest,
  RiskStatusResponse
} from '../types/pool';

const router = Router();

// All routes in this router require admin auth
router.use(requireAdminAuth);

// Validation helpers
function isValidPoolId(poolId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(poolId);
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// POST /api/pool/admin/create - Create new pool
// V1: Only btcd-main-pool pool should exist. This endpoint is kept for future use.
router.post('/create', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const createReq = req.body as CreatePoolRequest;
    const { name, asset, depositCap, cooldownPeriod, rewardWeight } = createReq;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.length === 0 || name.length > 100) {
      return res.status(400).json({ error: 'Invalid pool name (1-100 characters required)' });
    }

    if (!isValidAddress(asset)) {
      return res.status(400).json({ error: 'Invalid asset address' });
    }

    if (depositCap !== undefined) {
      try {
        const cap = BigInt(depositCap);
        if (cap <= BigInt(0)) {
          return res.status(400).json({ error: 'Deposit cap must be positive' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid deposit cap format' });
      }
    }

    // V1: Cooldown period should be 0 (no cooldown)
    if (!Number.isFinite(cooldownPeriod) || cooldownPeriod < 0) {
      return res.status(400).json({ error: 'Invalid cooldown period' });
    }

    if (!Number.isFinite(rewardWeight) || rewardWeight < 0 || rewardWeight > 100) {
      return res.status(400).json({ error: 'Reward weight must be between 0 and 100' });
    }

    // TODO: Delegate to poolService.createPool(createReq)
    // This should:
    // - Generate unique pool ID
    // - Deploy or initialize pool contract
    // - Store pool configuration in DB
    // - Set up reward distribution weights
    // - Initialize risk parameters
    // V1 Note: For production V1, only btcd-main-pool should exist

    const poolId = `pool-${Date.now()}`; // Placeholder
    const response: CreatePoolResponse = {
      success: true,
      poolId
    };

    log.info('Pool created:', { poolId, name, asset, admin: req.admin });
    res.status(201).json(response);
  } catch (err) {
    log.error('Error creating pool:', err);
    next(err);
  }
});

// POST /api/pool/admin/pause - Pause pool operations
router.post('/pause', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const pauseReq = req.body as PausePoolRequest;
    const { poolId, reason } = pauseReq;

    if (!isValidPoolId(poolId)) {
      return res.status(400).json({ error: 'Invalid pool ID format' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason required for pausing pool' });
    }

    // TODO: Delegate to poolService.pausePool(poolId, reason)
    // This should:
    // - Validate pool exists
    // - Update pool status to paused
    // - Emit pause event
    // - Log action with reason

    log.info('Pool paused:', { poolId, reason, admin: req.admin });
    res.json({ success: true });
  } catch (err) {
    log.error('Error pausing pool:', err);
    next(err);
  }
});

// POST /api/pool/admin/resume - Resume pool operations
router.post('/resume', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { poolId } = req.body;

    if (!poolId || !isValidPoolId(poolId)) {
      return res.status(400).json({ error: 'Invalid pool ID format' });
    }

    // TODO: Delegate to poolService.resumePool(poolId)
    // This should:
    // - Validate pool exists and is paused
    // - Check risk conditions are satisfied
    // - Update pool status to active
    // - Emit resume event

    log.info('Pool resumed:', { poolId, admin: req.admin });
    res.json({ success: true });
  } catch (err) {
    log.error('Error resuming pool:', err);
    next(err);
  }
});

// POST /api/pool/admin/set-reward-weights - Configure pool reward weights
router.post('/set-reward-weights', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const weightReq = req.body as SetRewardWeightsRequest;
    const { poolId, weights } = weightReq;

    if (!isValidPoolId(poolId)) {
      return res.status(400).json({ error: 'Invalid pool ID format' });
    }

    if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
      return res.status(400).json({ error: 'Weights must be an object' });
    }

    // Validate weights structure
    const entries = Object.entries(weights);
    if (entries.length === 0) {
      return res.status(400).json({ error: 'At least one weight required' });
    }

    for (const [key, value] of entries) {
      if (typeof key !== 'string' || key.length === 0) {
        return res.status(400).json({ error: 'Invalid weight key' });
      }
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return res.status(400).json({ error: `Weight for ${key} must be between 0 and 100` });
      }
    }

    // Validate total weights don't exceed 100
    const totalWeight = entries.reduce((sum, [, value]) => sum + value, 0);
    if (totalWeight > 100) {
      return res.status(400).json({ error: 'Total weights cannot exceed 100' });
    }

    // TODO: Delegate to poolRewardService.setRewardWeights(poolId, weights)
    // This should:
    // - Validate pool exists
    // - Update reward weight configuration
    // - Emit configuration change event

    log.info('Reward weights updated:', { poolId, weights, admin: req.admin });
    res.json({ success: true });
  } catch (err) {
    log.error('Error setting reward weights:', err);
    next(err);
  }
});

// GET /api/pool/admin/risk-status - Get circuit breaker and risk metrics
router.get('/risk-status', async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { poolId } = req.query;

    if (!poolId || typeof poolId !== 'string' || !isValidPoolId(poolId)) {
      return res.status(400).json({ error: 'Valid poolId query parameter required' });
    }

    // TODO: Delegate to poolRiskService.getRiskStatus(poolId)
    // Placeholder response
    const response: RiskStatusResponse = {
      poolId,
      circuitBreakerActive: false,
      currentTvl: '0',
      tvlCap: '0',
      utilizationRate: '0',
      oracleStatus: 'healthy',
      lastOracleUpdate: Date.now(),
      withdrawalCap24h: '0',
      withdrawalsLast24h: '0'
    };

    log.info('Risk status requested:', { poolId, admin: req.admin });
    res.json(response);
  } catch (err) {
    log.error('Error fetching risk status:', err);
    next(err);
  }
});

export default router;
