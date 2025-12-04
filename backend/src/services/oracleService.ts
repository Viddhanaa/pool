/**
 * Oracle service for fetching price data.
 * 
 * V1: BTCD oracle is OPTIONAL - can use fixed price or skip oracle validation.
 * Since v1 is BTCD-only staking with BTCD rewards, price oracle may not be critical
 * for core functionality. Oracle becomes more important in v2 for:
 * - Multi-asset pools requiring price conversion
 * - Cross-asset reward calculations
 * - Risk management with dynamic position sizing
 * 
 * V2: Expand oracle integration for multi-asset support and dynamic pricing.
 */

import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

import { config } from '../config/env';
import { POOL_CONFIG } from '../config/poolConfig';
import { query } from '../db/postgres';
import { log } from '../lib/logger';
import { metrics } from './prometheusMetrics';

// Price data from oracle
export interface OraclePrice {
  asset: string;
  price: string; // in USD or base unit
  decimals: number;
  timestamp: Date;
  source: string; // e.g., "chainlink", "custom"
  stale: boolean;
}

// Oracle adapter contract ABI
const ORACLE_ABI = [
  'function latestAnswer() view returns (int256)',
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

interface OracleCacheRow {
  asset: string;
  price: string;
  decimals: number;
  timestamp: Date;
  source: string;
}

/**
 * Fetches price from on-chain oracle adapter.
 * V1: Optional for BTCD - can use fixed price or skip.
 * V2: Required for multi-asset pools.
 * 
 * @param asset - Asset symbol or identifier (e.g., "BTCD", "ETH")
 * @param oracleAddress - Oracle contract address
 * @param maxStalenessSeconds - Max allowed staleness in seconds (default: 3600 = 1 hour)
 * @returns Oracle price data
 */
export async function fetchOraclePrice(
  asset: string,
  oracleAddress: string,
  maxStalenessSeconds: number = 3600
): Promise<OraclePrice> {
  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    const oracleContract = new Contract(oracleAddress, ORACLE_ABI, provider);

    const [roundData, decimals] = await Promise.all([
      oracleContract.latestRoundData(),
      oracleContract.decimals()
    ]);

    const [, answer, , updatedAt] = roundData;

    // Staleness check
    const now = Math.floor(Date.now() / 1000);
    const updatedAtSec = Number(updatedAt);
    const ageSeconds = now - updatedAtSec;
    const stale = ageSeconds > maxStalenessSeconds;
    const timestamp = new Date(updatedAtSec * 1000);

    if (stale) {
      log.warn('oracle price is stale', {
        context: {
          asset,
          oracleAddress,
          ageSeconds,
          maxStalenessSeconds,
          updatedAt: timestamp.toISOString()
        },
        message: 'Oracle price data is stale and may be unreliable'
      });
      // Emit alert (could integrate with monitoring system)
      emitOracleStaleAlert(asset, oracleAddress, ageSeconds);
    }

    // Validate answer is positive
    const answerBigInt = BigInt(answer.toString());
    if (answerBigInt <= BigInt(0)) {
      log.error('oracle returned invalid price', { asset, oracleAddress, answer: answer.toString() });
      throw new Error(`Invalid oracle price for ${asset}: ${answer}`);
    }

    const price = formatUnits(answer, decimals);

    const oraclePrice: OraclePrice = {
      asset,
      price,
      decimals,
      timestamp,
      source: 'chainlink', // or derive from config
      stale
    };

    // Cache price in DB
    await cachePriceInDB(oraclePrice);

    log.info('oracle price fetched', {
      level: 'info',
      timestamp: new Date().toISOString(),
      context: {
        asset,
        oracleAddress,
        price,
        decimals,
        stale,
        updatedAt: timestamp.toISOString(),
        source: oraclePrice.source
      },
      message: 'Oracle price fetched successfully from on-chain source'
    });
    return oraclePrice;
  } catch (err) {
    // Increment oracle failure metric
    metrics.poolOracleFailuresTotal.inc({ oracle_id: oracleAddress });

    log.error('fetch oracle price error', {
      level: 'error',
      timestamp: new Date().toISOString(),
      context: { asset, oracleAddress },
      message: 'Failed to fetch oracle price from on-chain source',
      error: err
    });
    emitOracleFailureAlert(asset, oracleAddress, String(err));
    throw new Error(`Failed to fetch oracle price for ${asset}: ${err}`);
  }
}

/**
 * Caches oracle price in database with TTL.
 * @param oraclePrice - Price data to cache
 */
async function cachePriceInDB(oraclePrice: OraclePrice): Promise<void> {
  await query(
    `INSERT INTO oracle_price_cache (asset, price, decimals, timestamp, source)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (asset)
     DO UPDATE SET
       price = EXCLUDED.price,
       decimals = EXCLUDED.decimals,
       timestamp = EXCLUDED.timestamp,
       source = EXCLUDED.source,
       updated_at = NOW()`,
    [
      oraclePrice.asset,
      oraclePrice.price,
      oraclePrice.decimals,
      oraclePrice.timestamp.toISOString(),
      oraclePrice.source
    ]
  );
}

/**
 * Retrieves cached oracle price from DB.
 * V1: Optional for BTCD - can return fixed price or null.
 * V2: Required for multi-asset pricing.
 * 
 * @param asset - Asset symbol
 * @param maxAgeSec - Max cache age in seconds (default: 300 = 5 minutes)
 * @returns Cached price or null if not found/expired
 */
export async function getCachedOraclePrice(
  asset: string,
  maxAgeSec: number = 300
): Promise<OraclePrice | null> {
  const rows = await query<OracleCacheRow>(
    `SELECT asset, price, decimals, timestamp, source
     FROM oracle_price_cache
     WHERE asset = $1
       AND updated_at > NOW() - INTERVAL '1 second' * $2`,
    [asset, maxAgeSec]
  );

  if (!rows.length) return null;

  const row = rows[0];
  const now = Date.now();
  const cacheAge = now - new Date(row.timestamp).getTime();
  const stale = cacheAge > maxAgeSec * 1000;

  return {
    asset: row.asset,
    price: row.price,
    decimals: row.decimals,
    timestamp: row.timestamp,
    source: row.source,
    stale
  };
}

/**
 * Fetches oracle price with cache fallback.
 * Tries cache first, then on-chain if cache miss or expired.
 * V1: Optional for BTCD - can skip or use fixed price.
 * V2: Required for multi-asset pools.
 * 
 * @param asset - Asset symbol
 * @param oracleAddress - Oracle contract address
 * @param cacheTTL - Cache TTL in seconds
 * @returns Oracle price
 */
export async function getOraclePriceWithCache(
  asset: string,
  oracleAddress: string,
  cacheTTL: number = 300
): Promise<OraclePrice> {
  // V1: For BTCD, can return fixed price if oracle not configured
  if (asset.toUpperCase() === POOL_CONFIG.DEPOSIT_ASSET && !oracleAddress) {
    log.info('oracle not configured for BTCD - using fixed price (v1)', { asset });
    return {
      asset,
      price: '1.0', // Fixed price for v1
      decimals: 18,
      timestamp: new Date(),
      source: 'fixed',
      stale: false
    };
  }

  // Try cache first
  const cached = await getCachedOraclePrice(asset, cacheTTL);
  if (cached && !cached.stale) {
    log.info('oracle price from cache', { asset, price: cached.price });
    return cached;
  }

  // Fetch fresh price
  return fetchOraclePrice(asset, oracleAddress, cacheTTL);
}

/**
 * Validates multiple oracle prices and returns a median or average.
 * Useful for multi-oracle setups to prevent manipulation.
 * @param asset - Asset symbol
 * @param oracleAddresses - Array of oracle contract addresses
 * @returns Aggregated price
 */
export async function fetchAggregatedOraclePrice(
  asset: string,
  oracleAddresses: string[]
): Promise<OraclePrice> {
  if (!oracleAddresses.length) {
    throw new Error('No oracle addresses provided');
  }

  const prices: OraclePrice[] = [];
  for (const addr of oracleAddresses) {
    try {
      const price = await fetchOraclePrice(asset, addr);
      prices.push(price);
    } catch (err) {
      log.warn('skipping failed oracle', { asset, oracleAddress: addr, err });
      // Continue to next oracle
    }
  }

  if (!prices.length) {
    throw new Error(`All oracles failed for asset ${asset}`);
  }

  // Sort by price and take median
  const sortedPrices = prices.map((p) => parseFloat(p.price)).sort((a, b) => a - b);
  const medianIdx = Math.floor(sortedPrices.length / 2);
  const medianPrice = sortedPrices[medianIdx].toString();

  // Return median price with latest timestamp
  const latestTimestamp = prices.reduce((max, p) =>
    p.timestamp > max ? p.timestamp : max
  , prices[0].timestamp);

  const aggregated: OraclePrice = {
    asset,
    price: medianPrice,
    decimals: prices[0].decimals,
    timestamp: latestTimestamp,
    source: 'aggregated',
    stale: prices.some((p) => p.stale)
  };

  log.info('aggregated oracle price', { asset, medianPrice, sources: prices.length });
  return aggregated;
}

/**
 * Emits alert for stale oracle data.
 * @param asset - Asset symbol
 * @param oracleAddress - Oracle contract address
 * @param ageSeconds - Age in seconds
 */
function emitOracleStaleAlert(asset: string, oracleAddress: string, ageSeconds: number): void {
  // Increment oracle failure metric for staleness
  metrics.poolOracleFailuresTotal.inc({ oracle_id: oracleAddress });

  log.error('ALERT: oracle stale', {
    level: 'error',
    timestamp: new Date().toISOString(),
    context: { asset, oracleAddress, ageSeconds },
    message: 'ALERT: Oracle price data is stale'
  });

  // Store alert in DB for tracking
  query(
    `INSERT INTO oracle_alerts (asset, oracle_address, alert_type, message, created_at)
     VALUES ($1, $2, 'stale', $3, NOW())`,
    [asset, oracleAddress, `Price stale by ${ageSeconds}s`]
  ).catch((err) => log.error('failed to store oracle alert', err));
}

/**
 * Emits alert for failed oracle read.
 * @param asset - Asset symbol
 * @param oracleAddress - Oracle contract address
 * @param errorMsg - Error message
 */
function emitOracleFailureAlert(asset: string, oracleAddress: string, errorMsg: string): void {
  log.error('ALERT: oracle failure', {
    level: 'error',
    timestamp: new Date().toISOString(),
    context: { asset, oracleAddress, errorMsg },
    message: 'ALERT: Oracle read failure detected'
  });

  query(
    `INSERT INTO oracle_alerts (asset, oracle_address, alert_type, message, created_at)
     VALUES ($1, $2, 'failure', $3, NOW())`,
    [asset, oracleAddress, errorMsg]
  ).catch((err) => log.error('failed to store oracle alert', err));
}

/**
 * Validates oracle price against min/max bounds.
 * @param asset - Asset symbol
 * @param price - Price to validate
 * @param minPrice - Minimum acceptable price
 * @param maxPrice - Maximum acceptable price
 * @returns True if price is within bounds
 */
export function validateOraclePriceBounds(
  asset: string,
  price: string,
  minPrice: number,
  maxPrice: number
): boolean {
  const priceNum = parseFloat(price);
  if (priceNum < minPrice || priceNum > maxPrice) {
    log.error('oracle price out of bounds', { asset, price, minPrice, maxPrice });
    return false;
  }
  return true;
}

/**
 * Lists recent oracle alerts.
 * @param limit - Max alerts to return
 * @returns Array of alerts
 */
export async function getRecentOracleAlerts(
  limit: number = 50
): Promise<Array<{ asset: string; oracleAddress: string; alertType: string; message: string; createdAt: Date }>> {
  const rows = await query<{
    asset: string;
    oracle_address: string;
    alert_type: string;
    message: string;
    created_at: Date;
  }>(
    `SELECT asset, oracle_address, alert_type, message, created_at
     FROM oracle_alerts
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return rows.map((row) => ({
    asset: row.asset,
    oracleAddress: row.oracle_address,
    alertType: row.alert_type,
    message: row.message,
    createdAt: row.created_at
  }));
}
