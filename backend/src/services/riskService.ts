/**
 * Risk management service for pool operations.
 * 
 * V1: Simplified risk checks - no cooldown periods, but keep TVL cap and withdrawal limits.
 * V2: Expand to include cooldown validation, lockup enforcement, multi-asset risk.
 */

import { Contract, JsonRpcProvider } from 'ethers';

import { config } from '../config/env';
import { POOL_CONFIG, getCooldownPeriod } from '../config/poolConfig';
import { query } from '../db/postgres';
import { log } from '../lib/logger';
import { metrics } from './prometheusMetrics';

// Risk parameters for a pool
export interface PoolRiskParameters {
  poolId: string;
  maxTvl: string; // Maximum total value locked
  maxDailyWithdrawals: string; // Max withdrawals per day
  maxUserDeposit: string; // Max single user deposit
  circuitBreakerThreshold: string; // Drawdown threshold to trigger pause
  emergencyPaused: boolean;
  lastUpdated: Date;
}

// Circuit breaker status
export interface CircuitBreakerStatus {
  poolId: string;
  active: boolean;
  reason: string | null;
  triggeredAt: Date | null;
}

// Risk violation event
export interface RiskViolation {
  poolId: string;
  violationType: string;
  message: string;
  timestamp: Date;
}

// Risk engine contract ABI
const RISK_ENGINE_ABI = [
  'function getMaxTvl(address pool) view returns (uint256)',
  'function getMaxDailyWithdrawals(address pool) view returns (uint256)',
  'function isCircuitBreakerActive(address pool) view returns (bool)',
  'function circuitBreakerReason(address pool) view returns (string)',
  'function emergencyPaused(address pool) view returns (bool)'
];

interface RiskParametersRow {
  pool_id: string;
  max_tvl: string;
  max_daily_withdrawals: string;
  max_user_deposit: string;
  circuit_breaker_threshold: string;
  emergency_paused: boolean;
  last_updated: Date;
}

interface CircuitBreakerRow {
  pool_id: string;
  active: boolean;
  reason: string | null;
  triggered_at: Date | null;
}

interface RiskViolationRow {
  pool_id: string;
  violation_type: string;
  message: string;
  timestamp: Date;
}

/**
 * Fetches risk parameters from on-chain risk engine contract.
 * @param poolId - Pool identifier
 * @param poolAddress - Pool contract address
 * @param riskEngineAddress - Risk engine contract address
 * @returns Risk parameters
 */
export async function fetchRiskParameters(
  poolId: string,
  poolAddress: string,
  riskEngineAddress: string
): Promise<PoolRiskParameters> {
  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    const riskEngine = new Contract(riskEngineAddress, RISK_ENGINE_ABI, provider);

    const [maxTvl, maxDailyWithdrawals, emergencyPaused] = await Promise.all([
      riskEngine.getMaxTvl(poolAddress),
      riskEngine.getMaxDailyWithdrawals(poolAddress),
      riskEngine.emergencyPaused(poolAddress)
    ]);

    // TODO: fetch maxUserDeposit and circuitBreakerThreshold from contract or config
    const maxUserDeposit = '1000000'; // placeholder
    const circuitBreakerThreshold = '0.1'; // 10% drawdown

    const params: PoolRiskParameters = {
      poolId,
      maxTvl: maxTvl.toString(),
      maxDailyWithdrawals: maxDailyWithdrawals.toString(),
      maxUserDeposit,
      circuitBreakerThreshold,
      emergencyPaused,
      lastUpdated: new Date()
    };

    // Cache in DB
    await cacheRiskParameters(params);

    log.info('risk parameters fetched', { poolId, emergencyPaused });
    return params;
  } catch (err) {
    log.error('fetch risk parameters error', { poolId, err });
    throw new Error(`Failed to fetch risk parameters for ${poolId}: ${err}`);
  }
}

/**
 * Caches risk parameters in database.
 * @param params - Risk parameters
 */
async function cacheRiskParameters(params: PoolRiskParameters): Promise<void> {
  await query(
    `INSERT INTO pool_risk_parameters (pool_id, max_tvl, max_daily_withdrawals, max_user_deposit, circuit_breaker_threshold, emergency_paused)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (pool_id)
     DO UPDATE SET
       max_tvl = EXCLUDED.max_tvl,
       max_daily_withdrawals = EXCLUDED.max_daily_withdrawals,
       max_user_deposit = EXCLUDED.max_user_deposit,
       circuit_breaker_threshold = EXCLUDED.circuit_breaker_threshold,
       emergency_paused = EXCLUDED.emergency_paused,
       last_updated = NOW()`,
    [
      params.poolId,
      params.maxTvl,
      params.maxDailyWithdrawals,
      params.maxUserDeposit,
      params.circuitBreakerThreshold,
      params.emergencyPaused ? 1 : 0
    ]
  );
}

/**
 * Retrieves cached risk parameters from DB.
 * @param poolId - Pool identifier
 * @returns Risk parameters or null if not found
 */
export async function getCachedRiskParameters(
  poolId: string
): Promise<PoolRiskParameters | null> {
  const rows = await query<RiskParametersRow>(
    `SELECT pool_id, max_tvl, max_daily_withdrawals, max_user_deposit, circuit_breaker_threshold, emergency_paused, last_updated
     FROM pool_risk_parameters
     WHERE pool_id = $1`,
    [poolId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    poolId: row.pool_id,
    maxTvl: row.max_tvl,
    maxDailyWithdrawals: row.max_daily_withdrawals,
    maxUserDeposit: row.max_user_deposit,
    circuitBreakerThreshold: row.circuit_breaker_threshold,
    emergencyPaused: row.emergency_paused,
    lastUpdated: row.last_updated
  };
}

/**
 * Checks if TVL cap is exceeded for a pool.
 * V1: Keep TVL cap enforcement for risk management.
 * V2: Can add dynamic TVL caps based on oracle data, collateralization ratios.
 * 
 * @param poolId - Pool identifier
 * @param currentTvl - Current TVL
 * @returns True if cap exceeded
 */
export async function checkTvlCap(poolId: string, currentTvl: string): Promise<boolean> {
  const params = await getCachedRiskParameters(poolId);
  if (!params) {
    log.warn('risk parameters not found for TVL check', { poolId });
    return false;
  }

  const tvlNum = parseFloat(currentTvl);
  const maxTvlNum = parseFloat(params.maxTvl);

  if (tvlNum > maxTvlNum) {
    // Increment circuit breaker trip metric
    metrics.poolCircuitBreakerTripsTotal.inc({ pool_id: poolId, reason: 'tvl_cap_exceeded' });

    log.error('TVL cap exceeded', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: { 
        poolId, 
        currentTvl, 
        maxTvl: params.maxTvl, 
        utilizationPercent: (tvlNum / maxTvlNum * 100).toFixed(2),
        asset: POOL_CONFIG.DEPOSIT_ASSET // V1: Single asset
      },
      message: 'Pool TVL cap exceeded - deposits should be blocked'
    });
    await logRiskViolation(poolId, 'tvl_cap_exceeded', `TVL ${currentTvl} exceeds max ${params.maxTvl}`);
    return true;
  }

  return false;
}

/**
 * Checks if daily withdrawal limit is exceeded for a pool.
 * V1: Keep withdrawal limit enforcement, no cooldown checks.
 * V2: Can add per-user withdrawal limits, cooldown validation.
 * 
 * @param poolId - Pool identifier
 * @returns True if limit exceeded
 */
export async function checkDailyWithdrawalLimit(poolId: string): Promise<boolean> {
  const params = await getCachedRiskParameters(poolId);
  if (!params) {
    log.warn('risk parameters not found for withdrawal limit check', { poolId });
    return false;
  }

  // V1: No cooldown period check (handled in poolService validation)
  // Cooldown period is 0 in v1 config
  const cooldownPeriod = getCooldownPeriod();
  
  // Calculate total withdrawals today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await query<{ total_withdrawals: string }>(
    `SELECT COALESCE(SUM(amount), 0)::numeric(38,18) AS total_withdrawals
     FROM pool_withdrawals
     WHERE pool_id = $1 AND created_at >= $2`,
    [poolId, today.toISOString()]
  );

  const totalWithdrawals = parseFloat(rows[0]?.total_withdrawals ?? '0');
  const maxDailyNum = parseFloat(params.maxDailyWithdrawals);

  if (totalWithdrawals > maxDailyNum) {
    // Increment circuit breaker trip metric
    metrics.poolCircuitBreakerTripsTotal.inc({ pool_id: poolId, reason: 'daily_withdrawal_limit' });

    log.error('daily withdrawal limit exceeded', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: {
        poolId,
        totalWithdrawals,
        maxDailyWithdrawals: params.maxDailyWithdrawals,
        utilizationPercent: (totalWithdrawals / maxDailyNum * 100).toFixed(2),
        cooldownPeriod, // V1: 0 seconds
        asset: POOL_CONFIG.DEPOSIT_ASSET // V1: Single asset
      },
      message: 'Pool daily withdrawal limit exceeded - further withdrawals should be blocked'
    });
    await logRiskViolation(
      poolId,
      'daily_withdrawal_limit_exceeded',
      `Daily withdrawals ${totalWithdrawals} exceed max ${params.maxDailyWithdrawals}`
    );
    return true;
  }

  return false;
}

/**
 * Checks circuit breaker status for a pool.
 * @param poolId - Pool identifier
 * @param poolAddress - Pool contract address
 * @param riskEngineAddress - Risk engine contract address
 * @returns Circuit breaker status
 */
export async function checkCircuitBreaker(
  poolId: string,
  poolAddress: string,
  riskEngineAddress: string
): Promise<CircuitBreakerStatus> {
  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    const riskEngine = new Contract(riskEngineAddress, RISK_ENGINE_ABI, provider);

    const [active, reason] = await Promise.all([
      riskEngine.isCircuitBreakerActive(poolAddress),
      riskEngine.circuitBreakerReason(poolAddress)
    ]);

    const status: CircuitBreakerStatus = {
      poolId,
      active,
      reason: reason || null,
      triggeredAt: active ? new Date() : null
    };

    // Store status in DB
    await query(
      `INSERT INTO circuit_breaker_status (pool_id, active, reason, triggered_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pool_id)
       DO UPDATE SET
         active = EXCLUDED.active,
         reason = EXCLUDED.reason,
         triggered_at = EXCLUDED.triggered_at,
         updated_at = NOW()`,
      [poolId, active, reason || null, status.triggeredAt?.toISOString() ?? null]
    );

    if (active) {
      // Increment circuit breaker trip metric
      metrics.poolCircuitBreakerTripsTotal.inc({ pool_id: poolId, reason: reason || 'unknown' });

      log.error('circuit breaker active', {
        level: 'error',
        timestamp: new Date().toISOString(),
        context: { poolId, reason, triggeredAt: status.triggeredAt?.toISOString() },
        message: 'ALERT: Pool circuit breaker is active - operations are restricted'
      });
      await logRiskViolation(poolId, 'circuit_breaker_active', reason || 'Unknown reason');
    }

    return status;
  } catch (err) {
    log.error('check circuit breaker error', { poolId, err });
    throw new Error(`Failed to check circuit breaker for ${poolId}: ${err}`);
  }
}

/**
 * Retrieves cached circuit breaker status from DB.
 * @param poolId - Pool identifier
 * @returns Circuit breaker status or null
 */
export async function getCachedCircuitBreakerStatus(
  poolId: string
): Promise<CircuitBreakerStatus | null> {
  const rows = await query<CircuitBreakerRow>(
    `SELECT pool_id, active, reason, triggered_at
     FROM circuit_breaker_status
     WHERE pool_id = $1`,
    [poolId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    poolId: row.pool_id,
    active: row.active,
    reason: row.reason,
    triggeredAt: row.triggered_at
  };
}

/**
 * Checks emergency pause status for a pool.
 * @param poolId - Pool identifier
 * @returns True if pool is emergency paused
 */
export async function checkEmergencyPause(poolId: string): Promise<boolean> {
  const params = await getCachedRiskParameters(poolId);
  if (!params) {
    log.warn('risk parameters not found for emergency pause check', { poolId });
    return false;
  }

  if (params.emergencyPaused) {
    // Increment emergency pause metric
    metrics.poolEmergencyPausesTotal.inc({ pool_id: poolId });

    log.error('pool is emergency paused', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: { poolId, lastUpdated: params.lastUpdated.toISOString() },
      message: 'ALERT: Pool is in emergency pause state - all operations blocked'
    });
    await logRiskViolation(poolId, 'emergency_pause', 'Pool is in emergency pause state');
    return true;
  }

  return false;
}

/**
 * Logs a risk violation event.
 * @param poolId - Pool identifier
 * @param violationType - Type of violation
 * @param message - Violation message
 */
async function logRiskViolation(
  poolId: string,
  violationType: string,
  message: string
): Promise<void> {
  await query(
    `INSERT INTO risk_violations (pool_id, violation_type, message, timestamp)
     VALUES ($1, $2, $3, NOW())`,
    [poolId, violationType, message]
  );

  log.error('risk violation logged', {
    level: 'error',
    timestamp: new Date().toISOString(),
    context: { poolId, violationType, message },
    message: 'Risk violation event recorded for pool'
  });
}

/**
 * Retrieves recent risk violations.
 * @param poolId - Pool identifier (optional, for all pools if omitted)
 * @param limit - Max violations to return
 * @returns Array of violations
 */
export async function getRecentRiskViolations(
  poolId?: string,
  limit: number = 50
): Promise<RiskViolation[]> {
  const queryStr = poolId
    ? `SELECT pool_id, violation_type, message, timestamp
       FROM risk_violations
       WHERE pool_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`
    : `SELECT pool_id, violation_type, message, timestamp
       FROM risk_violations
       ORDER BY timestamp DESC
       LIMIT $1`;

  const params = poolId ? [poolId, limit] : [limit];

  const rows = await query<RiskViolationRow>(queryStr, params);

  return rows.map((row) => ({
    poolId: row.pool_id,
    violationType: row.violation_type,
    message: row.message,
    timestamp: row.timestamp
  }));
}

/**
 * Performs comprehensive risk checks for a pool.
 * @param poolId - Pool identifier
 * @param poolAddress - Pool contract address
 * @param riskEngineAddress - Risk engine contract address
 * @param currentTvl - Current TVL
 * @returns Object with violation flags
 */
export async function performRiskChecks(
  poolId: string,
  poolAddress: string,
  riskEngineAddress: string,
  currentTvl: string
): Promise<{
  tvlCapExceeded: boolean;
  dailyWithdrawalLimitExceeded: boolean;
  circuitBreakerActive: boolean;
  emergencyPaused: boolean;
  anyViolation: boolean;
}> {
  const [tvlCapExceeded, dailyLimitExceeded, cbStatus, emergencyPaused] = await Promise.all([
    checkTvlCap(poolId, currentTvl),
    checkDailyWithdrawalLimit(poolId),
    checkCircuitBreaker(poolId, poolAddress, riskEngineAddress),
    checkEmergencyPause(poolId)
  ]);

  const anyViolation =
    tvlCapExceeded || dailyLimitExceeded || cbStatus.active || emergencyPaused;

  if (anyViolation) {
    log.error('risk checks failed', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: {
        poolId,
        currentTvl,
        tvlCapExceeded,
        dailyLimitExceeded,
        circuitBreakerActive: cbStatus.active,
        circuitBreakerReason: cbStatus.reason,
        emergencyPaused
      },
      message: 'ALERT: Pool risk checks failed - operations may be restricted'
    });
  } else {
    log.info('risk checks passed', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: { poolId, currentTvl },
      message: 'Pool risk checks passed successfully'
    });
  }

  return {
    tvlCapExceeded,
    dailyWithdrawalLimitExceeded: dailyLimitExceeded,
    circuitBreakerActive: cbStatus.active,
    emergencyPaused,
    anyViolation
  };
}
