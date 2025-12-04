// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RewardDistributor
 * @notice Epoch-based reward distribution with pull-based claiming
 * @dev Manages reward allocation across pools and users with snapshot-based accounting
 * 
 * V1 Simplifications:
 * - Reward token = BTCD (same as pool deposit token)
 * - Single pool: \"btcd-main-pool\"
 * - No multi-token reward logic
 * 
 * V2 Expansion Points:
 * - Support multiple reward tokens (BTCD, ETH, USDC)
 * - Multiple pool instances with different reward strategies
 * - Bonus multipliers for locked staking
 * 
 * Key Invariants:
 * - Rewards are calculated off-chain and committed on-chain per epoch
 * - Users can only claim rewards for completed epochs
 * - No unbounded loops over user sets
 * - Total claimed rewards never exceed total allocated rewards per epoch
 * 
 * Architecture:
 * - Backend computes rewards based on mining/staking activity
 * - Admin commits epoch snapshot with total rewards and merkle root (or weights)
 * - Users pull/claim their rewards based on their share
 */
contract RewardDistributor is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REWARD_ORACLE_ROLE = keccak256("REWARD_ORACLE_ROLE");

    /// @notice Reward token (V1: BTCD only, same as pool asset)
    IERC20 public immutable rewardToken;

    /// @notice Current epoch number
    uint256 public currentEpoch;

    /// @notice Epoch duration in seconds
    uint256 public epochDuration;

    /// @notice Timestamp of last epoch finalization
    uint256 public lastEpochTime;

    /// @notice Reward data per epoch
    struct EpochReward {
        uint256 totalRewards;      // Total rewards allocated for this epoch
        uint256 totalClaimed;       // Total rewards claimed so far
        bool finalized;             // Whether epoch is finalized
        mapping(address => mapping(address => uint256)) poolUserRewards; // pool => user => amount
        mapping(address => mapping(address => bool)) claimed; // pool => user => claimed
    }

    /// @notice Mapping from epoch to reward data
    mapping(uint256 => EpochReward) public epochRewards;

    /// @notice Per-pool weight for reward distribution (scaled by 1e18)
    mapping(address => uint256) public poolWeights;

    /// @notice Total pool weight (sum of all pool weights)
    uint256 public totalPoolWeight;

    /// @notice Whitelisted pools that can receive rewards
    mapping(address => bool) public whitelistedPools;

    // Events
    event EpochFinalized(uint256 indexed epoch, uint256 totalRewards);
    event RewardAllocated(uint256 indexed epoch, address indexed pool, address indexed user, uint256 amount);
    event RewardClaimed(uint256 indexed epoch, address indexed pool, address indexed user, uint256 amount);
    event PoolWeightUpdated(address indexed pool, uint256 oldWeight, uint256 newWeight);
    event PoolWhitelisted(address indexed pool, bool status);
    event EpochDurationUpdated(uint256 oldDuration, uint256 newDuration);

    /**
     * @notice Constructor
     * @param _rewardToken The ERC20 token used for rewards (V1: BTCD token address)
     * @param _epochDuration Duration of each epoch in seconds
     * @param _admin Admin address
     * 
     * V1 Configuration:
     * - rewardToken = BTCD (same as pool deposit token)
     * - Single reward token for all distributions
     * - Epoch-based distribution for mining/staking rewards
     */
    constructor(
        IERC20 _rewardToken,
        uint256 _epochDuration,
        address _admin
    ) {
        require(address(_rewardToken) != address(0), "RewardDistributor: invalid token");
        require(_epochDuration > 0, "RewardDistributor: invalid duration");
        require(_admin != address(0), "RewardDistributor: invalid admin");

        rewardToken = _rewardToken;
        epochDuration = _epochDuration;
        lastEpochTime = block.timestamp;
        currentEpoch = 0;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(REWARD_ORACLE_ROLE, _admin);
    }

    // ============ Epoch Management ============

    /**
     * @notice Finalize current epoch and start new one
     * @dev Called by reward oracle after computing off-chain rewards
     * @param totalRewards Total rewards to distribute in this epoch
     * 
     * Requirements:
     * - Only callable by reward oracle
     * - Epoch duration must have passed
     * - Current epoch must not be already finalized
     */
    function finalizeEpoch(uint256 totalRewards) external onlyRole(REWARD_ORACLE_ROLE) {
        require(
            block.timestamp >= lastEpochTime + epochDuration,
            "RewardDistributor: epoch not ready"
        );

        EpochReward storage epoch = epochRewards[currentEpoch];
        require(!epoch.finalized, "RewardDistributor: already finalized");

        epoch.totalRewards = totalRewards;
        epoch.finalized = true;

        emit EpochFinalized(currentEpoch, totalRewards);

        // Advance to next epoch
        currentEpoch++;
        lastEpochTime = block.timestamp;
    }

    /**
     * @notice Allocate rewards to specific users in a pool for an epoch
     * @dev Called by reward oracle to set individual user rewards
     * @param epoch Epoch number
     * @param pool Pool address
     * @param users Array of user addresses
     * @param amounts Array of reward amounts
     * 
     * Requirements:
     * - Only callable by reward oracle
     * - Epoch must be finalized
     * - Pool must be whitelisted
     * - Arrays must have same length and be non-empty
     * - Total allocated must not exceed epoch total
     */
    function allocateRewards(
        uint256 epoch,
        address pool,
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyRole(REWARD_ORACLE_ROLE) {
        require(users.length == amounts.length, "RewardDistributor: length mismatch");
        require(users.length > 0, "RewardDistributor: empty arrays");
        require(whitelistedPools[pool], "RewardDistributor: pool not whitelisted");
        require(epochRewards[epoch].finalized, "RewardDistributor: epoch not finalized");

        EpochReward storage epochData = epochRewards[epoch];

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 amount = amounts[i];

            require(user != address(0), "RewardDistributor: invalid user");
            require(amount > 0, "RewardDistributor: zero amount");

            epochData.poolUserRewards[pool][user] = amount;
            emit RewardAllocated(epoch, pool, user, amount);
        }
    }

    // ============ Claiming Logic ============

    /**
     * @notice Claim rewards for a specific epoch and pool
     * @dev Pull-based claiming pattern to avoid unbounded loops
     * @param epoch Epoch number
     * @param pool Pool address (V1: btcd-main-pool)
     * @return amount Amount of rewards claimed (V1: BTCD only)
     * 
     * V1 Simplifications:
     * - Reward token = BTCD only
     * - Single pool supported
     * - No multi-token reward logic
     * 
     * Requirements:
     * - Epoch must be finalized
     * - User must have unclaimed rewards
     * - Rewards must not exceed epoch total
     * 
     * Effects:
     * - Marks rewards as claimed
     * - Updates total claimed for epoch
     * 
     * Interactions:
     * - Transfers BTCD reward tokens to user
     */
    function claimReward(uint256 epoch, address pool) external nonReentrant whenNotPaused returns (uint256 amount) {
        require(epochRewards[epoch].finalized, "RewardDistributor: epoch not finalized");

        EpochReward storage epochData = epochRewards[epoch];
        require(!epochData.claimed[pool][msg.sender], "RewardDistributor: already claimed");

        amount = epochData.poolUserRewards[pool][msg.sender];
        require(amount > 0, "RewardDistributor: no rewards");

        // Check total claimed doesn't exceed total rewards
        require(
            epochData.totalClaimed + amount <= epochData.totalRewards,
            "RewardDistributor: exceeds total rewards"
        );

        // Effects: mark as claimed before transfer
        epochData.claimed[pool][msg.sender] = true;
        epochData.totalClaimed += amount;

        // Interactions: transfer rewards
        rewardToken.safeTransfer(msg.sender, amount);

        emit RewardClaimed(epoch, pool, msg.sender, amount);
    }

    /**
     * @notice Claim rewards for multiple epochs at once
     * @param epochs Array of epoch numbers
     * @param pools Array of pool addresses (must match epochs length)
     * @return totalAmount Total amount claimed
     */
    function claimMultipleRewards(
        uint256[] calldata epochs,
        address[] calldata pools
    ) external nonReentrant whenNotPaused returns (uint256 totalAmount) {
        require(epochs.length == pools.length, "RewardDistributor: length mismatch");

        for (uint256 i = 0; i < epochs.length; i++) {
            uint256 epoch = epochs[i];
            address pool = pools[i];

            if (!epochRewards[epoch].finalized) continue;
            if (epochRewards[epoch].claimed[pool][msg.sender]) continue;

            EpochReward storage epochData = epochRewards[epoch];
            uint256 amount = epochData.poolUserRewards[pool][msg.sender];

            if (amount == 0) continue;
            if (epochData.totalClaimed + amount > epochData.totalRewards) continue;

            epochData.claimed[pool][msg.sender] = true;
            epochData.totalClaimed += amount;
            totalAmount += amount;

            emit RewardClaimed(epoch, pool, msg.sender, amount);
        }

        require(totalAmount > 0, "RewardDistributor: no rewards to claim");
        rewardToken.safeTransfer(msg.sender, totalAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Get pending rewards for a user in a pool for a specific epoch
     * @param epoch Epoch number
     * @param pool Pool address
     * @param user User address
     * @return amount Pending reward amount
     */
    function getPendingReward(
        uint256 epoch,
        address pool,
        address user
    ) external view returns (uint256 amount) {
        EpochReward storage epochData = epochRewards[epoch];
        
        if (epochData.claimed[pool][user]) {
            return 0;
        }

        return epochData.poolUserRewards[pool][user];
    }

    /**
     * @notice Check if user has claimed rewards for epoch and pool
     * @param epoch Epoch number
     * @param pool Pool address
     * @param user User address
     * @return claimed Whether rewards have been claimed
     */
    function hasClaimed(
        uint256 epoch,
        address pool,
        address user
    ) external view returns (bool claimed) {
        return epochRewards[epoch].claimed[pool][user];
    }

    /**
     * @notice Get epoch info
     * @param epoch Epoch number
     * @return totalRewards Total rewards for epoch
     * @return totalClaimed Total claimed so far
     * @return finalized Whether epoch is finalized
     */
    function getEpochInfo(uint256 epoch)
        external
        view
        returns (
            uint256 totalRewards,
            uint256 totalClaimed,
            bool finalized
        )
    {
        EpochReward storage epochData = epochRewards[epoch];
        return (epochData.totalRewards, epochData.totalClaimed, epochData.finalized);
    }

    // ============ Admin Functions ============

    /**
     * @notice Whitelist or delist a pool
     * @param pool Pool address
     * @param status Whitelist status
     */
    function setPoolWhitelist(address pool, bool status) external onlyRole(ADMIN_ROLE) {
        require(pool != address(0), "RewardDistributor: invalid pool");
        whitelistedPools[pool] = status;
        emit PoolWhitelisted(pool, status);
    }

    /**
     * @notice Set pool weight for reward distribution
     * @param pool Pool address
     * @param weight Weight (scaled by 1e18)
     */
    function setPoolWeight(address pool, uint256 weight) external onlyRole(ADMIN_ROLE) {
        require(whitelistedPools[pool], "RewardDistributor: pool not whitelisted");

        uint256 oldWeight = poolWeights[pool];
        totalPoolWeight = totalPoolWeight - oldWeight + weight;
        poolWeights[pool] = weight;

        emit PoolWeightUpdated(pool, oldWeight, weight);
    }

    /**
     * @notice Set epoch duration
     * @param _epochDuration New epoch duration in seconds
     */
    function setEpochDuration(uint256 _epochDuration) external onlyRole(ADMIN_ROLE) {
        require(_epochDuration > 0, "RewardDistributor: invalid duration");
        require(_epochDuration <= 365 days, "RewardDistributor: duration too long");

        uint256 old = epochDuration;
        epochDuration = _epochDuration;
        emit EpochDurationUpdated(old, _epochDuration);
    }

    /**
     * @notice Pause reward claiming
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause reward claiming
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency token recovery
     * @dev Only callable by admin; for recovering accidentally sent tokens
     * @param token Token to recover
     * @param amount Amount to recover
     */
    function recoverToken(IERC20 token, uint256 amount) external onlyRole(ADMIN_ROLE) {
        token.safeTransfer(msg.sender, amount);
    }
}
