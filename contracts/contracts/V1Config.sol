// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title V1Config
 * @notice Configuration constants for V1 BTCD staking pool
 * @dev Centralizes V1-specific constants and parameters
 * 
 * V1 Requirements:
 * - Single asset: BTCD token only (both deposit and reward)
 * - No lockup/cooldown: Users can deposit/withdraw anytime, no penalties
 * - Single pool: Only "btcd-main-pool" pool
 * - Simplified flow: No cooldown logic, no multi-asset complexity
 * 
 * V2 Expansion Points:
 * - Add SUPPORTED_ASSETS array for multi-asset pools
 * - Add POOL_IDS array for multiple pool instances
 * - Add LOCKUP_TIERS for tiered staking rewards
 * - Add COOLDOWN_PERIOD for withdrawal delays
 */
library V1Config {
    // ============ Pool Identifiers ============
    
    /// @notice Pool ID for the main BTCD staking pool
    /// @dev Used for backend tracking and pool identification
    string public constant POOL_ID = "btcd-main-pool";
    
    /// @notice Pool name displayed to users
    string public constant POOL_NAME = "BTCD Main Staking Pool";
    
    /// @notice Pool share token symbol
    string public constant POOL_SYMBOL = "vBTCD";
    
    // ============ Asset Configuration ============
    
    /// @notice BTCD token address (set via environment variable BTCD_TOKEN_ADDRESS)
    /// @dev This is deployed separately and passed to Pool constructor
    /// NOTE: Update this address after BTCD token deployment or use constructor parameter
    
    // Example addresses (update for your deployment):
    // Testnet: TBD (set via BTCD_TOKEN_ADDRESS env var)
    // Mainnet: TBD (set via BTCD_TOKEN_ADDRESS env var)
    
    // ============ Risk Parameters ============
    
    /// @notice Initial TVL cap for the pool (in wei, 18 decimals)
    /// @dev Set conservatively for V1 launch, can be increased later
    uint256 public constant INITIAL_TVL_CAP = 1_000_000 * 1e18; // 1M BTCD
    
    /// @notice Maximum deposit per user (in wei, 18 decimals)
    uint256 public constant MAX_USER_DEPOSIT = 100_000 * 1e18; // 100k BTCD
    
    /// @notice Daily withdrawal cap per user (in wei, 18 decimals)
    /// @dev 0 = no cap, non-zero = enforce daily limit
    uint256 public constant DAILY_WITHDRAWAL_CAP = 50_000 * 1e18; // 50k BTCD
    
    /// @notice Minimum deposit amount (in wei, 18 decimals)
    /// @dev Prevents dust attacks and ensures meaningful deposits
    uint256 public constant MIN_DEPOSIT_AMOUNT = 1 * 1e18; // 1 BTCD
    
    // ============ Timing Parameters ============
    
    /// @notice Withdrawal cooldown period in seconds
    /// @dev V1: Set to 0 for instant withdrawals
    uint256 public constant WITHDRAWAL_COOLDOWN = 0; // No cooldown
    
    /// @notice Epoch duration for reward distribution (in seconds)
    /// @dev Default: 1 day, can be adjusted based on reward frequency
    uint256 public constant EPOCH_DURATION = 1 days;
    
    // ============ Token Decimals ============
    
    /// @notice BTCD token decimals
    /// @dev Used for display and conversion calculations
    uint8 public constant BTCD_DECIMALS = 18;
    
    // ============ V2 Placeholders ============
    
    // V2: Add support for multiple assets
    // string[] public constant SUPPORTED_ASSETS = ["BTCD", "ETH", "USDC"];
    
    // V2: Add support for multiple pools
    // string[] public constant POOL_IDS = ["btcd-main-pool", "btcd-locked-staking", "multi-asset-pool"];
    
    // V2: Add lockup tiers with bonus multipliers
    // struct LockupTier {
    //     uint256 period;      // Lockup period in seconds
    //     uint256 multiplier;  // Reward multiplier (1e18 = 1x, 1.2e18 = 1.2x)
    // }
    // LockupTier[] public LOCKUP_TIERS = [
    //     LockupTier(0, 1e18),           // No lockup, 1x rewards
    //     LockupTier(30 days, 1.2e18),   // 30 days, 1.2x rewards
    //     LockupTier(90 days, 1.5e18)    // 90 days, 1.5x rewards
    // ];
    
    // ============ Helper Functions ============
    
    /**
     * @notice Check if this is V1 configuration
     * @return isV1 True if V1 configuration
     */
    function isV1() internal pure returns (bool) {
        return WITHDRAWAL_COOLDOWN == 0;
    }
    
    /**
     * @notice Get pool configuration as a tuple
     * @return poolId Pool identifier
     * @return poolName Pool display name
     * @return poolSymbol Share token symbol
     * @return tvlCap TVL cap in wei
     * @return cooldown Withdrawal cooldown in seconds
     */
    function getPoolConfig() 
        internal 
        pure 
        returns (
            string memory poolId,
            string memory poolName,
            string memory poolSymbol,
            uint256 tvlCap,
            uint256 cooldown
        ) 
    {
        return (
            POOL_ID,
            POOL_NAME,
            POOL_SYMBOL,
            INITIAL_TVL_CAP,
            WITHDRAWAL_COOLDOWN
        );
    }
    
    /**
     * @notice Get risk configuration as a tuple
     * @return tvlCap Maximum TVL
     * @return maxUserDeposit Maximum deposit per user
     * @return dailyWithdrawalCap Daily withdrawal cap per user
     * @return minDepositAmount Minimum deposit amount
     */
    function getRiskConfig()
        internal
        pure
        returns (
            uint256 tvlCap,
            uint256 maxUserDeposit,
            uint256 dailyWithdrawalCap,
            uint256 minDepositAmount
        )
    {
        return (
            INITIAL_TVL_CAP,
            MAX_USER_DEPOSIT,
            DAILY_WITHDRAWAL_CAP,
            MIN_DEPOSIT_AMOUNT
        );
    }
}
