import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

// Database metrics
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

const dbConnectionPoolSize = new client.Gauge({
  name: 'db_connection_pool_size',
  help: 'Number of database connections in the pool',
  labelNames: ['state'], // 'active', 'idle', 'waiting'
  registers: [register],
});

const redisOperationDuration = new client.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Business metrics
const activeMinersGauge = new client.Gauge({
  name: 'active_miners_total',
  help: 'Total number of active miners',
  registers: [register],
});

const pendingWithdrawalsGauge = new client.Gauge({
  name: 'pending_withdrawals_total',
  help: 'Total number of pending withdrawals',
  registers: [register],
});

const totalHashrateGauge = new client.Gauge({
  name: 'total_hashrate',
  help: 'Total pool hashrate',
  registers: [register],
});

// Cache metrics
const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_key'],
  registers: [register],
});

const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_key'],
  registers: [register],
});

// Pool metrics
const poolDepositsTotal = new client.Counter({
  name: 'pool_deposits_total',
  help: 'Total number of pool deposits',
  labelNames: ['pool_id', 'asset'],
  registers: [register],
});

const poolWithdrawalsTotal = new client.Counter({
  name: 'pool_withdrawals_total',
  help: 'Total number of pool withdrawals',
  labelNames: ['pool_id', 'asset'],
  registers: [register],
});

const poolTvlUsd = new client.Gauge({
  name: 'pool_tvl_usd',
  help: 'Total value locked in pool (USD)',
  labelNames: ['pool_id'],
  registers: [register],
});

const poolApyPercent = new client.Gauge({
  name: 'pool_apy_percent',
  help: 'Pool APY percentage',
  labelNames: ['pool_id'],
  registers: [register],
});

const poolOracleFailuresTotal = new client.Counter({
  name: 'pool_oracle_failures_total',
  help: 'Total number of oracle failures',
  labelNames: ['oracle_id'],
  registers: [register],
});

const poolCircuitBreakerTripsTotal = new client.Counter({
  name: 'pool_circuit_breaker_trips_total',
  help: 'Total number of circuit breaker trips',
  labelNames: ['pool_id', 'reason'],
  registers: [register],
});

const poolEmergencyPausesTotal = new client.Counter({
  name: 'pool_emergency_pauses_total',
  help: 'Total number of emergency pauses',
  labelNames: ['pool_id'],
  registers: [register],
});

/**
 * Express middleware to track HTTP metrics
 */
export function prometheusMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Get route pattern (e.g., /api/miner/stats instead of /api/miner/stats?minerId=1)
  const route = req.route?.path || req.path;
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    
    if (res.statusCode >= 400) {
      httpRequestErrors.inc({
        method: req.method,
        route,
        error_type: res.statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  });
  
  next();
}

/**
 * Endpoint to expose metrics for Prometheus scraping
 */
export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

// Export metrics for use in services
export const metrics = {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestErrors,
  dbQueryDuration,
  dbConnectionPoolSize,
  redisOperationDuration,
  activeMinersGauge,
  pendingWithdrawalsGauge,
  totalHashrateGauge,
  cacheHits,
  cacheMisses,
  poolDepositsTotal,
  poolWithdrawalsTotal,
  poolTvlUsd,
  poolApyPercent,
  poolOracleFailuresTotal,
  poolCircuitBreakerTripsTotal,
  poolEmergencyPausesTotal,
  register,
};
