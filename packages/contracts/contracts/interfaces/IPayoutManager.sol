// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPayoutManager
 * @author Viddhana Pool
 * @notice Interface for the PayoutManager contract
 * @dev Defines the external interface for payout operations
 */
interface IPayoutManager {
    // ============ Enums ============

    /// @notice Payout status enum
    enum PayoutStatus {
        Pending,
        Processing,
        Completed,
        Failed,
        Cancelled
    }

    // ============ Structs ============

    /// @notice Payout request structure
    struct PayoutRequest {
        uint256 id;
        address recipient;
        uint256 amount;
        PayoutStatus status;
        uint256 queuedAt;
        uint256 processedAt;
        bytes32 referenceId;
    }

    // ============ Events ============

    /// @notice Emitted when a payout is queued
    event PayoutQueued(
        uint256 indexed payoutId,
        address indexed recipient,
        uint256 amount,
        bytes32 referenceId
    );

    /// @notice Emitted when a payout is processed
    event PayoutProcessed(
        uint256 indexed payoutId,
        address indexed recipient,
        uint256 amount
    );

    /// @notice Emitted when a payout fails
    event PayoutFailed(
        uint256 indexed payoutId,
        address indexed recipient,
        uint256 amount,
        string reason
    );

    /// @notice Emitted when a batch payout is processed
    event BatchPayoutProcessed(
        uint256[] payoutIds,
        uint256 totalAmount,
        uint256 successCount,
        uint256 failCount
    );

    /// @notice Emitted when circuit breaker is triggered
    event CircuitBreakerTriggered(address indexed triggeredBy, string reason);

    /// @notice Emitted when circuit breaker is reset
    event CircuitBreakerReset(address indexed resetBy);

    /// @notice Emitted when daily limit is updated
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);

    /// @notice Emitted when minimum payout threshold is updated
    event MinPayoutThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    /// @notice Emitted when treasury is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Emitted when fee percent is updated
    event FeePercentUpdated(uint256 oldFee, uint256 newFee);

    // ============ External Functions ============

    /**
     * @notice Queue a payout for processing
     * @param recipient The address to receive the payout
     * @param amount The amount to pay out
     * @param referenceId External reference identifier
     * @return payoutId The ID of the queued payout
     */
    function queuePayout(
        address recipient,
        uint256 amount,
        bytes32 referenceId
    ) external returns (uint256 payoutId);

    /**
     * @notice Process a single queued payout
     * @param payoutId The ID of the payout to process
     */
    function processPayout(uint256 payoutId) external;

    /**
     * @notice Process multiple payouts in a batch
     * @param payoutIds Array of payout IDs to process
     */
    function processBatchPayout(uint256[] calldata payoutIds) external;

    /**
     * @notice Trigger the circuit breaker
     * @param reason The reason for triggering
     */
    function triggerCircuitBreaker(string calldata reason) external;

    /**
     * @notice Reset the circuit breaker
     */
    function resetCircuitBreaker() external;

    /**
     * @notice Get payout details
     * @param payoutId The payout ID
     * @return The payout request details
     */
    function getPayout(uint256 payoutId) external view returns (PayoutRequest memory);

    /**
     * @notice Get the current daily payout total
     * @return The total amount paid out today
     */
    function getDailyPayoutTotal() external view returns (uint256);

    /**
     * @notice Check if circuit breaker is active
     * @return True if circuit breaker is active
     */
    function isCircuitBreakerActive() external view returns (bool);
}
