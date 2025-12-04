// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Pool
 * @notice Main pool contract for VIDDHANA BTCD staking pool (V1)
 * @dev Manages deposits, withdrawals, share accounting, and exchange rate calculation
 * 
 * V1 Simplifications:
 * - Single asset: BTCD token only (both deposit and reward)
 * - No lockup/cooldown: Users can deposit/withdraw anytime, no penalties
 * - Single pool: "btcd-main-pool" pool instance
 * - Simplified flow: No cooldown logic, no multi-asset complexity
 * 
 * V2 Expansion Points:
 * - Add cooldown periods (lastDepositTime tracking restored)
 * - Support multi-asset deposits (ETH, USDC, etc.)
 * - Tiered lockup periods with bonus rewards
 * - Multiple pool instances for different strategies
 * 
 * Key Invariants:
 * - totalAssets() >= sum of all user shares converted to assets
 * - Exchange rate never decreases except during loss events
 * - Shares are minted based on assets deposited / current exchange rate
 * - No admin funds stored; only user deposits and protocol rewards
 */
contract Pool is ERC20, ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RISK_ENGINE_ROLE = keccak256("RISK_ENGINE_ROLE");

    /// @notice The underlying asset token (V1: BTCD only)
    IERC20 public immutable asset;

    /// @notice Risk engine contract that enforces caps and limits
    address public riskEngine;

    /// @notice Reward distributor contract
    address public rewardDistributor;

    /// @notice V1: No cooldown period (instant withdrawals)
    /// @dev V2: Can add cooldown via setWithdrawalCooldown() if needed
    uint256 public withdrawalCooldown;

    /// @notice V1: Not used (no cooldown enforcement)
    /// @dev V2: Will track last deposit time for cooldown enforcement
    mapping(address => uint256) public lastDepositTime;

    /// @notice Total assets under management (excludes pending rewards)
    uint256 private _totalAssets;

    /// @notice Minimum deposit amount to prevent dust attacks
    uint256 public minDepositAmount;

    /// @notice Emergency withdrawal enabled flag
    bool public emergencyWithdrawalEnabled;

    // Events
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event RiskEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event RewardDistributorUpdated(address indexed oldDistributor, address indexed newDistributor);
    event WithdrawalCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event MinDepositAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event EmergencyWithdrawalToggled(bool enabled);
    event RewardsAccrued(uint256 amount);

    /**
     * @notice Constructor
     * @param _asset The underlying ERC20 asset (V1: BTCD token address)
     * @param _name Pool share token name (V1: "VIDDHANA BTCD Staking Pool")
     * @param _symbol Pool share token symbol (V1: "vBTCD")
     * @param _admin Admin address for AccessControl
     * 
     * V1 Configuration:
     * - asset = BTCD token address (immutable)
     * - withdrawalCooldown = 0 (instant withdrawals)
     * - minDepositAmount = 1e18 (1 BTCD minimum, 18 decimals)
     */
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _admin
    ) ERC20(_name, _symbol) {
        require(address(_asset) != address(0), "Pool: invalid asset");
        require(_admin != address(0), "Pool: invalid admin");

        asset = _asset;
        withdrawalCooldown = 0; // V1: No cooldown (instant withdrawals)
        minDepositAmount = 1e18; // V1: 1 BTCD minimum (18 decimals)

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    // ============ Deposit Logic ============

    /**
     * @notice Deposit assets and receive pool shares
     * @dev Validates asset amount, checks risk limits, mints shares based on exchange rate
     * @param assets Amount of underlying asset to deposit (V1: BTCD only)
     * @return shares Amount of pool shares minted
     * 
     * V1 Simplifications:
     * - Only BTCD asset accepted (enforced by immutable asset field)
     * - No cooldown tracking (lastDepositTime not used)
     * - Instant withdrawals allowed
     * 
     * Checks:
     * - Amount > 0 and >= minDepositAmount
     * - Pool not paused
     * - Risk engine allows deposit (TVL caps, etc.)
     * 
     * Effects:
     * - Mints shares to depositor
     * - Updates totalAssets
     * 
     * Interactions:
     * - Transfers BTCD from user to pool
     */
    function deposit(uint256 assets) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(assets > 0, "Pool: zero deposit");
        require(assets >= minDepositAmount, "Pool: below minimum");

        // Check risk engine constraints before accepting deposit
        if (riskEngine != address(0)) {
            require(
                IRiskEngine(riskEngine).checkDepositAllowed(address(this), msg.sender, assets),
                "Pool: deposit blocked by risk engine"
            );
        }

        // Calculate shares to mint based on current exchange rate
        shares = _convertToShares(assets);
        require(shares > 0, "Pool: zero shares");

        // Effects: update state before external calls
        _totalAssets += assets;
        // V1: No cooldown tracking needed (instant withdrawals)
        // lastDepositTime[msg.sender] = block.timestamp; // V2: Uncomment for cooldown

        _mint(msg.sender, shares);

        // Interactions: transfer assets from user
        asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposit(msg.sender, assets, shares);
    }

    // ============ Withdrawal Logic ============

    /**
     * @notice Withdraw assets by burning pool shares
     * @dev Burns shares, computes underlying assets, transfers to user
     * @param shares Amount of pool shares to burn
     * @return assets Amount of underlying assets withdrawn (V1: BTCD only)
     * 
     * V1 Simplifications:
     * - No cooldown enforcement (instant withdrawals)
     * - Only BTCD asset returned
     * - No withdrawal penalties
     * 
     * Checks:
     * - shares > 0 and user has sufficient balance
     * - Risk engine allows withdrawal (TVL limits, daily caps)
     * - Pool not paused (unless emergency withdrawal)
     * 
     * Effects:
     * - Burns shares
     * - Updates totalAssets
     * 
     * Interactions:
     * - Transfers BTCD to user
     */
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        require(shares > 0, "Pool: zero withdrawal");
        require(balanceOf(msg.sender) >= shares, "Pool: insufficient shares");

        // Allow emergency withdrawals to bypass pause
        if (!emergencyWithdrawalEnabled) {
            require(!paused(), "Pool: paused");
        }

        // V1: No cooldown check (instant withdrawals)
        // V2: Uncomment for cooldown enforcement
        // require(
        //     block.timestamp >= lastDepositTime[msg.sender] + withdrawalCooldown,
        //     "Pool: cooldown not elapsed"
        // );

        // Calculate assets to return based on current exchange rate
        assets = _convertToAssets(shares);
        require(assets > 0, "Pool: zero assets");

        // Check risk engine constraints
        if (riskEngine != address(0)) {
            require(
                IRiskEngine(riskEngine).checkWithdrawalAllowed(address(this), msg.sender, assets),
                "Pool: withdrawal blocked by risk engine"
            );
        }

        // Effects: burn shares and update total assets
        _burn(msg.sender, shares);
        _totalAssets -= assets;

        // Interactions: transfer assets to user
        asset.safeTransfer(msg.sender, assets);

        emit Withdraw(msg.sender, assets, shares);
    }

    // ============ Share/Asset Conversion ============

    /**
     * @notice Convert assets to shares based on current exchange rate
     * @dev If pool is empty, use 1:1 ratio; otherwise use totalAssets/totalShares
     * @param assets Amount of assets
     * @return shares Equivalent shares
     */
    function _convertToShares(uint256 assets) internal view returns (uint256 shares) {
        uint256 supply = totalSupply();
        
        if (supply == 0) {
            // Initial deposit: 1:1 ratio
            return assets;
        }

        // shares = assets * totalSupply / totalAssets
        // Ensures rounding benefits the pool
        return (assets * supply) / _totalAssets;
    }

    /**
     * @notice Convert shares to assets based on current exchange rate
     * @param shares Amount of shares
     * @return assets Equivalent assets
     */
    function _convertToAssets(uint256 shares) internal view returns (uint256 assets) {
        uint256 supply = totalSupply();
        
        if (supply == 0) {
            return 0;
        }

        // assets = shares * totalAssets / totalSupply
        return (shares * _totalAssets) / supply;
    }

    /**
     * @notice Get total assets under management
     * @return Total assets held by pool
     */
    function totalAssets() public view returns (uint256) {
        return _totalAssets;
    }

    /**
     * @notice Preview how many shares will be minted for asset amount
     * @param assets Amount of assets to deposit
     * @return shares Expected shares to receive
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares) {
        return _convertToShares(assets);
    }

    /**
     * @notice Preview how many assets will be received for share amount
     * @param shares Amount of shares to burn
     * @return assets Expected assets to receive
     */
    function previewWithdraw(uint256 shares) external view returns (uint256 assets) {
        return _convertToAssets(shares);
    }

    /**
     * @notice Get current exchange rate (assets per share, scaled by 1e18)
     * @return rate Exchange rate scaled by 1e18
     */
    function exchangeRate() external view returns (uint256 rate) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return 1e18; // 1:1 initial rate
        }
        return (_totalAssets * 1e18) / supply;
    }

    // ============ Reward Integration ============

    /**
     * @notice Accrue rewards from reward distributor
     * @dev Only callable by reward distributor; increases totalAssets without minting shares
     * @param amount Amount of rewards to accrue (V1: BTCD only)
     * 
     * V1 Simplifications:
     * - Reward token = BTCD (same as deposit token)
     * - All rewards distributed as BTCD to pool
     * - Exchange rate increases, benefiting all share holders proportionally
     * 
     * This increases the exchange rate, benefiting all share holders proportionally
     */
    function accrueRewards(uint256 amount) external nonReentrant {
        require(msg.sender == rewardDistributor, "Pool: only reward distributor");
        require(amount > 0, "Pool: zero rewards");

        // Rewards increase totalAssets, improving exchange rate for all holders
        _totalAssets += amount;

        // Transfer reward tokens from distributor (V1: BTCD only)
        asset.safeTransferFrom(msg.sender, address(this), amount);

        emit RewardsAccrued(amount);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set risk engine contract
     * @param _riskEngine Address of risk engine
     */
    function setRiskEngine(address _riskEngine) external onlyRole(ADMIN_ROLE) {
        address old = riskEngine;
        riskEngine = _riskEngine;
        emit RiskEngineUpdated(old, _riskEngine);
    }

    /**
     * @notice Set reward distributor contract
     * @param _rewardDistributor Address of reward distributor
     */
    function setRewardDistributor(address _rewardDistributor) external onlyRole(ADMIN_ROLE) {
        address old = rewardDistributor;
        rewardDistributor = _rewardDistributor;
        emit RewardDistributorUpdated(old, _rewardDistributor);
    }

    /**
     * @notice Set withdrawal cooldown period
     * @param _cooldown Cooldown in seconds
     * 
     * V1: Not used (cooldown = 0 for instant withdrawals)
     * V2: Can enable cooldown by setting > 0 and uncommenting checks in deposit/withdraw
     */
    function setWithdrawalCooldown(uint256 _cooldown) external onlyRole(ADMIN_ROLE) {
        require(_cooldown <= 30 days, "Pool: cooldown too long");
        uint256 old = withdrawalCooldown;
        withdrawalCooldown = _cooldown;
        emit WithdrawalCooldownUpdated(old, _cooldown);
    }

    /**
     * @notice Set minimum deposit amount
     * @param _minAmount Minimum deposit amount
     */
    function setMinDepositAmount(uint256 _minAmount) external onlyRole(ADMIN_ROLE) {
        uint256 old = minDepositAmount;
        minDepositAmount = _minAmount;
        emit MinDepositAmountUpdated(old, _minAmount);
    }

    /**
     * @notice Toggle emergency withdrawal mode
     * @dev Allows withdrawals even when paused
     */
    function toggleEmergencyWithdrawal() external onlyRole(ADMIN_ROLE) {
        emergencyWithdrawalEnabled = !emergencyWithdrawalEnabled;
        emit EmergencyWithdrawalToggled(emergencyWithdrawalEnabled);
    }

    /**
     * @notice Pause pool operations
     * @dev Only callable by admin or risk engine
     */
    function pause() external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == riskEngine,
            "Pool: unauthorized"
        );
        _pause();
    }

    /**
     * @notice Unpause pool operations
     * @dev Only callable by admin
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}

/**
 * @notice Interface for risk engine integration
 */
interface IRiskEngine {
    function checkDepositAllowed(
        address pool,
        address user,
        uint256 amount
    ) external view returns (bool);

    function checkWithdrawalAllowed(
        address pool,
        address user,
        uint256 amount
    ) external view returns (bool);
}
