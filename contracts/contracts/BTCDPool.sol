// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BTCDPool
 * @notice Minimal single-asset staking pool for BTCD v1
 * @dev Users deposit BTCD, earn BTCD rewards (calculated off-chain), withdraw anytime (no lockup)
 * 
 * Security features:
 * - ReentrancyGuard: Prevents reentrancy attacks on deposit/withdraw
 * - Pausable: Admin can pause deposits in emergency
 * - Ownable: Only owner can pause/unpause
 * - SafeERC20: Safe token transfers with proper error handling
 * - Checks-effects-interactions: State updates before external calls
 * 
 * Architecture:
 * - No shares/vault model (direct balance tracking)
 * - No cooldown periods (instant withdrawals)
 * - No on-chain rewards (handled by backend reward engine)
 * - Immutable BTCD token address (set in constructor)
 */
contract BTCDPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice BTCD token contract (immutable for security)
    IERC20 public immutable btcdToken;

    /// @notice Total BTCD staked across all users
    uint256 public totalStaked;

    /// @notice User address => staked BTCD amount
    mapping(address => uint256) public userStaked;

    // ============ Events ============

    /**
     * @notice Emitted when user deposits BTCD
     * @param user Address of depositor
     * @param amount Amount of BTCD deposited
     * @param timestamp Block timestamp of deposit
     */
    event Deposited(address indexed user, uint256 amount, uint256 timestamp);

    /**
     * @notice Emitted when user withdraws BTCD
     * @param user Address of withdrawer
     * @param amount Amount of BTCD withdrawn
     * @param timestamp Block timestamp of withdrawal
     */
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp);

    // ============ Constructor ============

    /**
     * @notice Initialize the BTCD Pool
     * @param _btcdToken Address of BTCD token contract
     */
    constructor(address _btcdToken) {
        require(_btcdToken != address(0), "BTCDPool: Invalid BTCD token address");
        btcdToken = IERC20(_btcdToken);
    }

    // ============ External Functions ============

    /**
     * @notice Deposit BTCD into the pool
     * @dev User must approve this contract to spend BTCD before calling
     * @param amount Amount of BTCD to deposit (must be > 0)
     * 
     * Requirements:
     * - amount must be greater than 0
     * - contract must not be paused
     * - user must have sufficient BTCD balance
     * - user must have approved this contract to spend amount
     * 
     * Effects:
     * - Increases user's staked balance
     * - Increases total staked amount
     * - Transfers BTCD from user to pool
     * - Emits Deposited event
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "BTCDPool: Amount must be greater than 0");

        // Effects: Update state before external calls (CEI pattern)
        userStaked[msg.sender] += amount;
        totalStaked += amount;

        // Interactions: Transfer BTCD from user to pool (uses SafeERC20)
        btcdToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Withdraw BTCD from the pool
     * @dev No cooldown period - instant withdrawal
     * @param amount Amount of BTCD to withdraw (must be > 0)
     * 
     * Requirements:
     * - amount must be greater than 0
     * - user must have sufficient staked balance
     * 
     * Effects:
     * - Decreases user's staked balance
     * - Decreases total staked amount
     * - Transfers BTCD from pool to user
     * - Emits Withdrawn event
     * 
     * Note: Withdrawals are allowed even when contract is paused
     * to ensure users can always access their funds
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "BTCDPool: Amount must be greater than 0");
        require(userStaked[msg.sender] >= amount, "BTCDPool: Insufficient balance");

        // Effects: Update state before external calls (CEI pattern)
        userStaked[msg.sender] -= amount;
        totalStaked -= amount;

        // Interactions: Transfer BTCD from pool to user (uses SafeERC20)
        btcdToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Get user's staked balance
     * @param user Address to query
     * @return User's staked BTCD amount
     */
    function balanceOf(address user) external view returns (uint256) {
        return userStaked[user];
    }

    // ============ Admin Functions ============

    /**
     * @notice Pause deposits (admin only)
     * @dev Withdrawals remain active to ensure users can access funds
     * 
     * Use cases:
     * - Emergency stop for security incidents
     * - Maintenance mode
     * - Pool migration
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause deposits (admin only)
     * @dev Resumes normal pool operation
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Get total BTCD staked in pool
     * @return Total staked amount across all users
     */
    function getTotalStaked() external view returns (uint256) {
        return totalStaked;
    }

    /**
     * @notice Check if contract is paused
     * @return True if paused, false otherwise
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
}
