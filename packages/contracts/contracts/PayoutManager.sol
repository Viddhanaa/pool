// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IPayoutManager.sol";

/**
 * @title PayoutManager
 * @author Viddhana Pool
 * @notice Manages payout operations for the mining pool with security features
 * @dev Implements UUPS upgradeable pattern with access control, circuit breaker, and daily limits
 */
contract PayoutManager is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IPayoutManager
{
    // ============ Constants ============

    /// @notice Role for operators who can queue and process payouts
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Role for triggering circuit breaker
    bytes32 public constant CIRCUIT_BREAKER_ROLE = keccak256("CIRCUIT_BREAKER_ROLE");

    /// @notice Role for upgrading the contract
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice Maximum batch size for batch payouts
    uint256 public constant MAX_BATCH_SIZE = 100;

    /// @notice Seconds in a day for daily limit calculations
    uint256 private constant SECONDS_PER_DAY = 86400;

    // ============ State Variables ============

    /// @notice Counter for payout IDs
    uint256 private _payoutIdCounter;

    /// @notice Mapping from payout ID to payout request
    mapping(uint256 => PayoutRequest) private _payouts;

    /// @notice Daily payout limit in wei
    uint256 public dailyPayoutLimit;

    /// @notice Minimum payout threshold in wei
    uint256 public minPayoutThreshold;

    /// @notice Circuit breaker state
    bool private _circuitBreakerActive;

    /// @notice Timestamp of circuit breaker activation
    uint256 public circuitBreakerActivatedAt;

    /// @notice Reason for circuit breaker activation
    string public circuitBreakerReason;

    /// @notice Daily payout tracking - day number to total amount
    mapping(uint256 => uint256) private _dailyPayouts;

    /// @notice Treasury address for receiving fees
    address public treasury;

    /// @notice Fee percentage in basis points (100 = 1%)
    uint256 public feePercent;

    /// @notice Gap for future storage variables
    uint256[50] private __gap;

    // ============ Errors ============

    /// @notice Thrown when payout amount is below minimum threshold
    error BelowMinimumThreshold(uint256 amount, uint256 minimum);

    /// @notice Thrown when daily limit would be exceeded
    error DailyLimitExceeded(uint256 requested, uint256 remaining);

    /// @notice Thrown when circuit breaker is active
    error CircuitBreakerActive();

    /// @notice Thrown when circuit breaker is not active
    error CircuitBreakerNotActive();

    /// @notice Thrown when payout not found
    error PayoutNotFound(uint256 payoutId);

    /// @notice Thrown when payout already processed
    error PayoutAlreadyProcessed(uint256 payoutId);

    /// @notice Thrown when batch size exceeds maximum
    error BatchSizeTooLarge(uint256 size, uint256 maximum);

    /// @notice Thrown when recipient address is zero
    error InvalidRecipient();

    /// @notice Thrown when amount is zero
    error InvalidAmount();

    /// @notice Thrown when transfer fails
    error TransferFailed(address recipient, uint256 amount);

    /// @notice Thrown when contract has insufficient balance
    error InsufficientContractBalance(uint256 requested, uint256 available);

    // ============ Modifiers ============

    /// @notice Ensures circuit breaker is not active
    modifier whenCircuitBreakerInactive() {
        if (_circuitBreakerActive) revert CircuitBreakerActive();
        _;
    }

    // ============ Initializer ============

    /**
     * @notice Initializes the contract with initial settings
     * @param admin Address to receive admin role
     * @param _treasury Address to receive fees
     * @param _dailyLimit Initial daily payout limit
     * @param _minThreshold Minimum payout threshold
     * @param _feePercent Fee percentage in basis points
     */
    function initialize(
        address admin,
        address _treasury,
        uint256 _dailyLimit,
        uint256 _minThreshold,
        uint256 _feePercent
    ) public initializer {
        require(admin != address(0), "Invalid admin address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_feePercent <= 1000, "Fee too high"); // Max 10%
        
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(CIRCUIT_BREAKER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        treasury = _treasury;
        dailyPayoutLimit = _dailyLimit;
        minPayoutThreshold = _minThreshold;
        feePercent = _feePercent;
        _payoutIdCounter = 1;
    }

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
    )
        external
        override
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        whenCircuitBreakerInactive
        returns (uint256 payoutId)
    {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (amount < minPayoutThreshold) {
            revert BelowMinimumThreshold(amount, minPayoutThreshold);
        }

        payoutId = _payoutIdCounter++;

        _payouts[payoutId] = PayoutRequest({
            id: payoutId,
            recipient: recipient,
            amount: amount,
            status: PayoutStatus.Pending,
            queuedAt: block.timestamp,
            processedAt: 0,
            referenceId: referenceId
        });

        emit PayoutQueued(payoutId, recipient, amount, referenceId);
    }

    /**
     * @notice Process a single queued payout
     * @param payoutId The ID of the payout to process
     */
    function processPayout(
        uint256 payoutId
    )
        external
        override
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
        whenCircuitBreakerInactive
    {
        PayoutRequest storage payout = _payouts[payoutId];

        if (payout.id == 0) revert PayoutNotFound(payoutId);
        if (payout.status != PayoutStatus.Pending) {
            revert PayoutAlreadyProcessed(payoutId);
        }

        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        uint256 dailyTotal = _dailyPayouts[currentDay];

        if (dailyTotal + payout.amount > dailyPayoutLimit) {
            revert DailyLimitExceeded(
                payout.amount,
                dailyPayoutLimit - dailyTotal
            );
        }

        if (address(this).balance < payout.amount) {
            revert InsufficientContractBalance(payout.amount, address(this).balance);
        }

        payout.status = PayoutStatus.Processing;

        // Calculate fee
        uint256 fee = (payout.amount * feePercent) / 10000;
        uint256 netAmount = payout.amount - fee;

        // Update daily total
        _dailyPayouts[currentDay] += payout.amount;

        // Transfer fee to treasury
        if (fee > 0 && treasury != address(0)) {
            (bool feeSuccess, ) = payable(treasury).call{value: fee}("");
            if (!feeSuccess) {
                payout.status = PayoutStatus.Failed;
                _dailyPayouts[currentDay] -= payout.amount;
                emit PayoutFailed(payoutId, payout.recipient, payout.amount, "Fee transfer failed");
                return;
            }
        }

        // Transfer to recipient
        (bool success, ) = payable(payout.recipient).call{value: netAmount}("");

        if (success) {
            payout.status = PayoutStatus.Completed;
            payout.processedAt = block.timestamp;
            emit PayoutProcessed(payoutId, payout.recipient, payout.amount);
        } else {
            payout.status = PayoutStatus.Failed;
            _dailyPayouts[currentDay] -= payout.amount;
            emit PayoutFailed(payoutId, payout.recipient, payout.amount, "Transfer failed");
        }
    }

    /**
     * @notice Process multiple payouts in a batch
     * @param payoutIds Array of payout IDs to process
     */
    function processBatchPayout(
        uint256[] calldata payoutIds
    )
        external
        override
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
        whenCircuitBreakerInactive
    {
        uint256 length = payoutIds.length;
        if (length > MAX_BATCH_SIZE) {
            revert BatchSizeTooLarge(length, MAX_BATCH_SIZE);
        }

        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        uint256 dailyTotal = _dailyPayouts[currentDay];
        uint256 totalAmount = 0;
        uint256 successCount = 0;
        uint256 failCount = 0;

        // First pass: validate and calculate total
        for (uint256 i = 0; i < length; i++) {
            PayoutRequest storage payout = _payouts[payoutIds[i]];
            if (payout.id != 0 && payout.status == PayoutStatus.Pending) {
                totalAmount += payout.amount;
            }
        }

        // Check daily limit
        if (dailyTotal + totalAmount > dailyPayoutLimit) {
            revert DailyLimitExceeded(totalAmount, dailyPayoutLimit - dailyTotal);
        }

        // Check contract balance
        if (address(this).balance < totalAmount) {
            revert InsufficientContractBalance(totalAmount, address(this).balance);
        }

        // Second pass: process payouts
        for (uint256 i = 0; i < length; i++) {
            uint256 payoutId = payoutIds[i];
            PayoutRequest storage payout = _payouts[payoutId];

            if (payout.id == 0 || payout.status != PayoutStatus.Pending) {
                continue;
            }

            payout.status = PayoutStatus.Processing;

            // Calculate fee
            uint256 fee = (payout.amount * feePercent) / 10000;
            uint256 netAmount = payout.amount - fee;

            // Update daily total
            _dailyPayouts[currentDay] += payout.amount;

            // Transfer fee to treasury
            bool feeSuccess = true;
            if (fee > 0 && treasury != address(0)) {
                (feeSuccess, ) = payable(treasury).call{value: fee}("");
            }

            if (!feeSuccess) {
                payout.status = PayoutStatus.Failed;
                _dailyPayouts[currentDay] -= payout.amount;
                failCount++;
                emit PayoutFailed(payoutId, payout.recipient, payout.amount, "Fee transfer failed");
                continue;
            }

            // Transfer to recipient
            (bool success, ) = payable(payout.recipient).call{value: netAmount}("");

            if (success) {
                payout.status = PayoutStatus.Completed;
                payout.processedAt = block.timestamp;
                successCount++;
                emit PayoutProcessed(payoutId, payout.recipient, payout.amount);
            } else {
                payout.status = PayoutStatus.Failed;
                _dailyPayouts[currentDay] -= payout.amount;
                failCount++;
                emit PayoutFailed(payoutId, payout.recipient, payout.amount, "Transfer failed");
            }
        }

        emit BatchPayoutProcessed(payoutIds, totalAmount, successCount, failCount);
    }

    /**
     * @notice Trigger the circuit breaker to halt all payouts
     * @param reason The reason for triggering the circuit breaker
     */
    function triggerCircuitBreaker(
        string calldata reason
    ) external override onlyRole(CIRCUIT_BREAKER_ROLE) {
        if (_circuitBreakerActive) revert CircuitBreakerActive();

        _circuitBreakerActive = true;
        circuitBreakerActivatedAt = block.timestamp;
        circuitBreakerReason = reason;

        emit CircuitBreakerTriggered(msg.sender, reason);
    }

    /**
     * @notice Reset the circuit breaker to resume payouts
     */
    function resetCircuitBreaker()
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!_circuitBreakerActive) revert CircuitBreakerNotActive();

        _circuitBreakerActive = false;
        circuitBreakerActivatedAt = 0;
        circuitBreakerReason = "";

        emit CircuitBreakerReset(msg.sender);
    }

    /**
     * @notice Cancel a pending payout
     * @param payoutId The payout ID to cancel
     */
    function cancelPayout(
        uint256 payoutId
    ) external onlyRole(OPERATOR_ROLE) {
        PayoutRequest storage payout = _payouts[payoutId];

        if (payout.id == 0) revert PayoutNotFound(payoutId);
        if (payout.status != PayoutStatus.Pending) {
            revert PayoutAlreadyProcessed(payoutId);
        }

        payout.status = PayoutStatus.Cancelled;
        payout.processedAt = block.timestamp;
    }

    /**
     * @notice Update the daily payout limit
     * @param newLimit New daily limit in wei
     */
    function setDailyPayoutLimit(
        uint256 newLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldLimit = dailyPayoutLimit;
        dailyPayoutLimit = newLimit;
        emit DailyLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @notice Update the minimum payout threshold
     * @param newThreshold New minimum threshold in wei
     */
    function setMinPayoutThreshold(
        uint256 newThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldThreshold = minPayoutThreshold;
        minPayoutThreshold = newThreshold;
        emit MinPayoutThresholdUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Update the treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(
        address newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid treasury address");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update the fee percentage
     * @param newFeePercent New fee percentage in basis points
     */
    function setFeePercent(
        uint256 newFeePercent
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFeePercent <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = feePercent;
        feePercent = newFeePercent;
        emit FeePercentUpdated(oldFee, newFeePercent);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Deposit funds into the contract
     */
    function deposit() external payable {
        // Accept deposits
    }

    /**
     * @notice Emergency withdraw all funds
     * @param to Address to send funds to
     */
    function emergencyWithdraw(
        address to
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid address");
        uint256 balance = address(this).balance;
        (bool success, ) = payable(to).call{value: balance}("");
        require(success, "Transfer failed");
    }

    // ============ View Functions ============

    /**
     * @notice Get payout details
     * @param payoutId The payout ID
     * @return The payout request details
     */
    function getPayout(
        uint256 payoutId
    ) external view override returns (PayoutRequest memory) {
        return _payouts[payoutId];
    }

    /**
     * @notice Get the current daily payout total
     * @return The total amount paid out today
     */
    function getDailyPayoutTotal() external view override returns (uint256) {
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        return _dailyPayouts[currentDay];
    }

    /**
     * @notice Check if circuit breaker is active
     * @return True if circuit breaker is active
     */
    function isCircuitBreakerActive() external view override returns (bool) {
        return _circuitBreakerActive;
    }

    /**
     * @notice Get the remaining daily payout capacity
     * @return The remaining amount that can be paid out today
     */
    function getRemainingDailyCapacity() external view returns (uint256) {
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        uint256 used = _dailyPayouts[currentDay];
        if (used >= dailyPayoutLimit) return 0;
        return dailyPayoutLimit - used;
    }

    /**
     * @notice Get the current payout ID counter
     * @return The next payout ID that will be assigned
     */
    function getNextPayoutId() external view returns (uint256) {
        return _payoutIdCounter;
    }

    // ============ Internal Functions ============

    /**
     * @notice Authorizes contract upgrades
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    // ============ Receive Function ============

    /// @notice Allows contract to receive ETH
    receive() external payable {}
}
