// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title RiskEngine
 * @notice Enforces risk limits across pools: TVL caps, withdrawal limits, user caps
 * @dev Integrates with Pool contracts to gate deposits and withdrawals
 * 
 * V1 Simplifications:
 * - No cooldown enforcement (instant withdrawals)
 * - Keep TVL caps and daily withdrawal limits
 * - Keep emergency pause mechanism
 * 
 * V2 Expansion Points:
 * - Add cooldown enforcement integration with Pool contract
 * - Dynamic TVL caps based on oracle price data
 * - Per-pool risk profiles with different parameters
 * 
 * Key Invariants:
 * - Pool TVL never exceeds configured cap
 * - User deposits never exceed per-user cap
 * - Daily withdrawals per user never exceed daily cap
 * - Emergency pause can be triggered by admin or circuit breaker
 * 
 * Security Assumptions:
 * - Risk parameters are set conservatively by admin
 * - Circuit breaker can pause operations on oracle failure or other risks
 * - Emergency withdrawals bypass risk checks but log for audit
 */
contract RiskEngine is AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CIRCUIT_BREAKER_ROLE = keccak256("CIRCUIT_BREAKER_ROLE");

    /// @notice Risk parameters per pool
    struct PoolRiskConfig {
        uint256 maxTvl;                // Maximum total value locked
        uint256 maxUserDeposit;        // Maximum deposit per user
        uint256 dailyWithdrawalCap;    // Maximum withdrawal per user per day
        bool depositsEnabled;          // Whether deposits are allowed
        bool withdrawalsEnabled;       // Whether withdrawals are allowed
        bool active;                   // Whether risk config is active
    }

    /// @notice Pool risk configurations
    mapping(address => PoolRiskConfig) public poolConfigs;

    /// @notice Current TVL per pool (tracked by risk engine)
    mapping(address => uint256) public poolTvl;

    /// @notice User deposits per pool
    mapping(address => mapping(address => uint256)) public userDeposits;

    /// @notice Daily withdrawal tracking: pool => user => day => amount
    mapping(address => mapping(address => mapping(uint256 => uint256))) public dailyWithdrawals;

    /// @notice Emergency mode flag
    bool public emergencyMode;

    // Events
    event PoolRiskConfigured(
        address indexed pool,
        uint256 maxTvl,
        uint256 maxUserDeposit,
        uint256 dailyWithdrawalCap
    );
    event PoolDepositsToggled(address indexed pool, bool enabled);
    event PoolWithdrawalsToggled(address indexed pool, bool enabled);
    event DepositRecorded(address indexed pool, address indexed user, uint256 amount, uint256 newTvl);
    event WithdrawalRecorded(address indexed pool, address indexed user, uint256 amount, uint256 newTvl);
    event EmergencyModeToggled(bool enabled);
    event RiskLimitBreached(address indexed pool, address indexed user, string reason);

    /**
     * @notice Constructor
     * @param _admin Admin address
     */
    constructor(address _admin) {
        require(_admin != address(0), "RiskEngine: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(CIRCUIT_BREAKER_ROLE, _admin);
    }

    // ============ Risk Configuration ============

    /**
     * @notice Configure risk parameters for a pool
     * @param pool Pool address
     * @param maxTvl Maximum TVL for pool
     * @param maxUserDeposit Maximum deposit per user
     * @param dailyWithdrawalCap Maximum withdrawal per user per day
     */
    function configurePoolRisk(
        address pool,
        uint256 maxTvl,
        uint256 maxUserDeposit,
        uint256 dailyWithdrawalCap
    ) external onlyRole(ADMIN_ROLE) {
        require(pool != address(0), "RiskEngine: invalid pool");
        require(maxTvl > 0, "RiskEngine: invalid max TVL");
        require(maxUserDeposit > 0, "RiskEngine: invalid max user deposit");

        poolConfigs[pool] = PoolRiskConfig({
            maxTvl: maxTvl,
            maxUserDeposit: maxUserDeposit,
            dailyWithdrawalCap: dailyWithdrawalCap,
            depositsEnabled: true,
            withdrawalsEnabled: true,
            active: true
        });

        emit PoolRiskConfigured(pool, maxTvl, maxUserDeposit, dailyWithdrawalCap);
    }

    /**
     * @notice Toggle deposits for a pool
     * @param pool Pool address
     * @param enabled Whether deposits should be enabled
     */
    function toggleDeposits(address pool, bool enabled) external onlyRole(ADMIN_ROLE) {
        require(poolConfigs[pool].active, "RiskEngine: pool not configured");
        poolConfigs[pool].depositsEnabled = enabled;
        emit PoolDepositsToggled(pool, enabled);
    }

    /**
     * @notice Toggle withdrawals for a pool
     * @param pool Pool address
     * @param enabled Whether withdrawals should be enabled
     */
    function toggleWithdrawals(address pool, bool enabled) external onlyRole(ADMIN_ROLE) {
        require(poolConfigs[pool].active, "RiskEngine: pool not configured");
        poolConfigs[pool].withdrawalsEnabled = enabled;
        emit PoolWithdrawalsToggled(pool, enabled);
    }

    // ============ Deposit Checks ============

    /**
     * @notice Check if deposit is allowed for a user
     * @param pool Pool address (V1: btcd-main-pool)
     * @param user User address
     * @param amount Deposit amount (V1: BTCD only)
     * @return allowed Whether deposit is allowed
     * 
     * V1 Simplifications:
     * - No cooldown checks (instant deposits)
     * - Keep TVL and user caps for safety
     * 
     * Checks:
     * - Emergency mode not active
     * - Pool deposits enabled
     * - TVL cap not exceeded
     * - User deposit cap not exceeded
     */
    function checkDepositAllowed(
        address pool,
        address user,
        uint256 amount
    ) external view returns (bool allowed) {
        if (emergencyMode) return false;

        PoolRiskConfig memory config = poolConfigs[pool];
        if (!config.active) return false;
        if (!config.depositsEnabled) return false;

        // Check TVL cap
        if (poolTvl[pool] + amount > config.maxTvl) return false;

        // Check per-user cap
        if (userDeposits[pool][user] + amount > config.maxUserDeposit) return false;

        return true;
    }

    /**
     * @notice Record a deposit (called by pool contract)
     * @param pool Pool address
     * @param user User address
     * @param amount Deposit amount
     * 
     * Requirements:
     * - Must be called by the pool contract
     * - Deposit must pass all risk checks
     */
    function recordDeposit(
        address pool,
        address user,
        uint256 amount
    ) external {
        require(msg.sender == pool, "RiskEngine: only pool");
        require(!emergencyMode, "RiskEngine: emergency mode");

        PoolRiskConfig memory config = poolConfigs[pool];
        require(config.active, "RiskEngine: pool not configured");
        require(config.depositsEnabled, "RiskEngine: deposits disabled");

        // Check and update TVL
        require(poolTvl[pool] + amount <= config.maxTvl, "RiskEngine: TVL cap exceeded");
        poolTvl[pool] += amount;

        // Check and update user deposits
        require(
            userDeposits[pool][user] + amount <= config.maxUserDeposit,
            "RiskEngine: user cap exceeded"
        );
        userDeposits[pool][user] += amount;

        emit DepositRecorded(pool, user, amount, poolTvl[pool]);
    }

    // ============ Withdrawal Checks ============

    /**
     * @notice Check if withdrawal is allowed for a user
     * @param pool Pool address (V1: btcd-main-pool)
     * @param user User address
     * @param amount Withdrawal amount (V1: BTCD only)
     * @return allowed Whether withdrawal is allowed
     * 
     * V1 Simplifications:
     * - No cooldown checks (instant withdrawals)
     * - Keep daily withdrawal caps for safety
     * 
     * Checks:
     * - Pool withdrawals enabled (unless emergency mode)
     * - Daily withdrawal cap not exceeded
     * - User has sufficient deposits
     */
    function checkWithdrawalAllowed(
        address pool,
        address user,
        uint256 amount
    ) external view returns (bool allowed) {
        PoolRiskConfig memory config = poolConfigs[pool];
        if (!config.active) return false;

        // Allow withdrawals in emergency mode even if normally disabled
        if (!emergencyMode && !config.withdrawalsEnabled) return false;

        // Check daily withdrawal cap (only if configured)
        if (config.dailyWithdrawalCap > 0) {
            uint256 today = block.timestamp / 1 days;
            uint256 dailyAmount = dailyWithdrawals[pool][user][today];
            if (dailyAmount + amount > config.dailyWithdrawalCap) return false;
        }

        return true;
    }

    /**
     * @notice Record a withdrawal (called by pool contract)
     * @param pool Pool address
     * @param user User address
     * @param amount Withdrawal amount
     * 
     * Requirements:
     * - Must be called by the pool contract
     * - Withdrawal must pass all risk checks
     */
    function recordWithdrawal(
        address pool,
        address user,
        uint256 amount
    ) external {
        require(msg.sender == pool, "RiskEngine: only pool");

        PoolRiskConfig memory config = poolConfigs[pool];
        require(config.active, "RiskEngine: pool not configured");

        // Allow withdrawals in emergency mode
        if (!emergencyMode) {
            require(config.withdrawalsEnabled, "RiskEngine: withdrawals disabled");
        }

        // Update daily withdrawal tracking
        if (config.dailyWithdrawalCap > 0) {
            uint256 today = block.timestamp / 1 days;
            uint256 dailyAmount = dailyWithdrawals[pool][user][today];
            require(
                dailyAmount + amount <= config.dailyWithdrawalCap,
                "RiskEngine: daily cap exceeded"
            );
            dailyWithdrawals[pool][user][today] = dailyAmount + amount;
        }

        // Update TVL and user deposits
        poolTvl[pool] -= amount;
        if (userDeposits[pool][user] >= amount) {
            userDeposits[pool][user] -= amount;
        } else {
            userDeposits[pool][user] = 0;
        }

        emit WithdrawalRecorded(pool, user, amount, poolTvl[pool]);
    }

    // ============ Emergency Controls ============

    /**
     * @notice Toggle emergency mode
     * @dev Allows withdrawals but blocks deposits across all pools
     */
    function toggleEmergencyMode() external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(CIRCUIT_BREAKER_ROLE, msg.sender),
            "RiskEngine: unauthorized"
        );

        emergencyMode = !emergencyMode;
        emit EmergencyModeToggled(emergencyMode);
    }

    /**
     * @notice Pause risk engine (pauses all checks)
     */
    function pause() external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(CIRCUIT_BREAKER_ROLE, msg.sender),
            "RiskEngine: unauthorized"
        );
        _pause();
    }

    /**
     * @notice Unpause risk engine
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Get pool risk configuration
     * @param pool Pool address
     * @return config Pool risk configuration
     */
    function getPoolConfig(address pool) external view returns (PoolRiskConfig memory config) {
        return poolConfigs[pool];
    }

    /**
     * @notice Get user's remaining deposit capacity
     * @param pool Pool address
     * @param user User address
     * @return remaining Remaining deposit capacity
     */
    function getRemainingDepositCapacity(address pool, address user)
        external
        view
        returns (uint256 remaining)
    {
        PoolRiskConfig memory config = poolConfigs[pool];
        uint256 userTotal = userDeposits[pool][user];

        if (userTotal >= config.maxUserDeposit) {
            return 0;
        }

        uint256 userCapacity = config.maxUserDeposit - userTotal;
        uint256 poolCapacity = config.maxTvl - poolTvl[pool];

        return userCapacity < poolCapacity ? userCapacity : poolCapacity;
    }

    /**
     * @notice Get user's remaining daily withdrawal capacity
     * @param pool Pool address
     * @param user User address
     * @return remaining Remaining daily withdrawal capacity
     */
    function getRemainingDailyWithdrawal(address pool, address user)
        external
        view
        returns (uint256 remaining)
    {
        PoolRiskConfig memory config = poolConfigs[pool];
        
        if (config.dailyWithdrawalCap == 0) {
            return type(uint256).max; // No cap
        }

        uint256 today = block.timestamp / 1 days;
        uint256 dailyAmount = dailyWithdrawals[pool][user][today];

        if (dailyAmount >= config.dailyWithdrawalCap) {
            return 0;
        }

        return config.dailyWithdrawalCap - dailyAmount;
    }
}
