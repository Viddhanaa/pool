/**
 * Pool configuration for v1 implementation.
 * 
 * V1 Requirements:
 * - Single asset: BTCD only (deposit and reward)
 * - No lockup/cooldown periods
  * - Single pool: "btcd-main-pool"
 * 
 * V2 Expansion Points:
 * - Add cooldown periods
 * - Support multi-asset pools
 * - Add lockup periods with tiered rewards
 * - Support multiple pool instances
 */

export const POOL_CONFIG = {
  // V1: Single pool identifier
  POOL_ID: 'btcd-main-pool',
  POOL_NAME: 'BTCD Main Staking Pool',
  
  // V1: Single asset for deposits and rewards
  DEPOSIT_ASSET: 'BTCD',
  REWARD_ASSET: 'BTCD',
  
  // V1: No cooldown period (instant withdrawals)
  COOLDOWN_PERIOD: 0,
  
  // V2 expansion: Can add cooldown in seconds
  // COOLDOWN_PERIOD: 86400, // 24 hours
  
  // V2 expansion: Multi-asset support
  // SUPPORTED_ASSETS: ['BTCD', 'ETH', 'USDC'],
  
  // V2 expansion: Lockup periods with multipliers
  // LOCKUP_TIERS: [
  //   { period: 0, multiplier: 1.0 },      // No lockup
  //   { period: 2592000, multiplier: 1.2 }, // 30 days, 20% bonus
  //   { period: 7776000, multiplier: 1.5 }  // 90 days, 50% bonus
  // ]
} as const;

/**
 * Validates if an asset is supported for deposits.
 * V1: Only BTCD is supported.
 * V2: Can expand to check against SUPPORTED_ASSETS array.
 */
export function isValidDepositAsset(asset: string): boolean {
  return asset.toUpperCase() === POOL_CONFIG.DEPOSIT_ASSET;
}

/**
 * Validates if an asset is supported for rewards.
 * V1: Only BTCD is supported.
 * V2: Can expand to support multiple reward assets.
 */
export function isValidRewardAsset(asset: string): boolean {
  return asset.toUpperCase() === POOL_CONFIG.REWARD_ASSET;
}

/**
 * Gets the cooldown period in seconds.
 * V1: Returns 0 (no cooldown).
 * V2: Can return configured cooldown period.
 */
export function getCooldownPeriod(): number {
  return POOL_CONFIG.COOLDOWN_PERIOD;
}
