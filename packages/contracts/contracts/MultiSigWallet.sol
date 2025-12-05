// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MultiSigWallet
 * @author Viddhana Pool
 * @notice Multi-signature wallet for secure treasury management
 * @dev Requires multiple owner confirmations before executing transactions
 */
contract MultiSigWallet is ReentrancyGuard {
    // ============ Events ============

    /// @notice Emitted when a deposit is made
    event Deposit(address indexed sender, uint256 amount, uint256 balance);

    /// @notice Emitted when a transaction is submitted
    event TransactionSubmitted(
        uint256 indexed txIndex,
        address indexed owner,
        address indexed to,
        uint256 value,
        bytes data
    );

    /// @notice Emitted when a transaction is confirmed
    event TransactionConfirmed(uint256 indexed txIndex, address indexed owner);

    /// @notice Emitted when a confirmation is revoked
    event ConfirmationRevoked(uint256 indexed txIndex, address indexed owner);

    /// @notice Emitted when a transaction is executed
    event TransactionExecuted(uint256 indexed txIndex, address indexed executor);

    /// @notice Emitted when an owner is added
    event OwnerAdded(address indexed owner);

    /// @notice Emitted when an owner is removed
    event OwnerRemoved(address indexed owner);

    /// @notice Emitted when confirmation threshold is changed
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);

    // ============ Structs ============

    /// @notice Transaction structure
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmationCount;
        uint256 submittedAt;
    }

    // ============ State Variables ============

    /// @notice Array of owner addresses
    address[] public owners;

    /// @notice Mapping to check if address is owner
    mapping(address => bool) public isOwner;

    /// @notice Number of confirmations required
    uint256 public confirmationsRequired;

    /// @notice Array of transactions
    Transaction[] public transactions;

    /// @notice Mapping from tx index => owner => confirmed
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    /// @notice Execution delay (timelock)
    uint256 public executionDelay = 1 hours;

    /// @notice Maximum number of owners
    uint256 public constant MAX_OWNERS = 50;

    // ============ Errors ============

    /// @notice Thrown when caller is not owner
    error NotOwner();

    /// @notice Thrown when transaction doesn't exist
    error TxNotFound(uint256 txIndex);

    /// @notice Thrown when transaction already executed
    error TxAlreadyExecuted(uint256 txIndex);

    /// @notice Thrown when transaction already confirmed by caller
    error TxAlreadyConfirmed(uint256 txIndex);

    /// @notice Thrown when transaction not confirmed by caller
    error TxNotConfirmed(uint256 txIndex);

    /// @notice Thrown when not enough confirmations
    error NotEnoughConfirmations(uint256 required, uint256 current);

    /// @notice Thrown when execution delay not met
    error ExecutionDelayNotMet(uint256 availableAt);

    /// @notice Thrown when transaction execution fails
    error TxExecutionFailed();

    /// @notice Thrown when owner already exists
    error OwnerExists(address owner);

    /// @notice Thrown when owner doesn't exist
    error OwnerNotFound(address owner);

    /// @notice Thrown when invalid threshold
    error InvalidThreshold();

    /// @notice Thrown when too many owners
    error TooManyOwners();

    /// @notice Thrown when not enough owners remaining
    error NotEnoughOwners();

    /// @notice Thrown when zero address provided
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier onlyWallet() {
        require(msg.sender == address(this), "Not wallet");
        _;
    }

    modifier txExists(uint256 txIndex) {
        if (txIndex >= transactions.length) revert TxNotFound(txIndex);
        _;
    }

    modifier notExecuted(uint256 txIndex) {
        if (transactions[txIndex].executed) revert TxAlreadyExecuted(txIndex);
        _;
    }

    modifier notConfirmed(uint256 txIndex) {
        if (isConfirmed[txIndex][msg.sender]) revert TxAlreadyConfirmed(txIndex);
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initializes the multi-sig wallet
     * @param _owners Array of initial owner addresses
     * @param _confirmationsRequired Number of confirmations required
     */
    constructor(address[] memory _owners, uint256 _confirmationsRequired) {
        if (_owners.length == 0) revert NotEnoughOwners();
        if (_owners.length > MAX_OWNERS) revert TooManyOwners();
        if (
            _confirmationsRequired == 0 ||
            _confirmationsRequired > _owners.length
        ) revert InvalidThreshold();

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            if (owner == address(0)) revert ZeroAddress();
            if (isOwner[owner]) revert OwnerExists(owner);

            isOwner[owner] = true;
            owners.push(owner);
        }

        confirmationsRequired = _confirmationsRequired;
    }

    // ============ External Functions ============

    /**
     * @notice Submit a new transaction
     * @param to Destination address
     * @param value ETH value to send
     * @param data Call data
     * @return txIndex The transaction index
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (uint256 txIndex) {
        if (to == address(0)) revert ZeroAddress();

        txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: to,
                value: value,
                data: data,
                executed: false,
                confirmationCount: 0,
                submittedAt: block.timestamp
            })
        );

        emit TransactionSubmitted(txIndex, msg.sender, to, value, data);

        // Auto-confirm by submitter
        _confirmTransaction(txIndex);
    }

    /**
     * @notice Confirm a pending transaction
     * @param txIndex The transaction index
     */
    function confirmTransaction(
        uint256 txIndex
    )
        external
        onlyOwner
        txExists(txIndex)
        notExecuted(txIndex)
        notConfirmed(txIndex)
    {
        _confirmTransaction(txIndex);
    }

    /**
     * @notice Revoke a confirmation
     * @param txIndex The transaction index
     */
    function revokeConfirmation(
        uint256 txIndex
    ) external onlyOwner txExists(txIndex) notExecuted(txIndex) {
        if (!isConfirmed[txIndex][msg.sender]) revert TxNotConfirmed(txIndex);

        Transaction storage transaction = transactions[txIndex];
        transaction.confirmationCount--;
        isConfirmed[txIndex][msg.sender] = false;

        emit ConfirmationRevoked(txIndex, msg.sender);
    }

    /**
     * @notice Execute a confirmed transaction
     * @param txIndex The transaction index
     */
    function executeTransaction(
        uint256 txIndex
    )
        external
        onlyOwner
        txExists(txIndex)
        notExecuted(txIndex)
        nonReentrant
    {
        Transaction storage transaction = transactions[txIndex];

        if (transaction.confirmationCount < confirmationsRequired) {
            revert NotEnoughConfirmations(
                confirmationsRequired,
                transaction.confirmationCount
            );
        }

        // Check execution delay
        uint256 availableAt = transaction.submittedAt + executionDelay;
        if (block.timestamp < availableAt) {
            revert ExecutionDelayNotMet(availableAt);
        }

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );

        if (!success) revert TxExecutionFailed();

        emit TransactionExecuted(txIndex, msg.sender);
    }

    /**
     * @notice Add a new owner (requires multi-sig)
     * @param owner New owner address
     */
    function addOwner(address owner) external onlyWallet {
        if (owner == address(0)) revert ZeroAddress();
        if (isOwner[owner]) revert OwnerExists(owner);
        if (owners.length >= MAX_OWNERS) revert TooManyOwners();

        isOwner[owner] = true;
        owners.push(owner);

        emit OwnerAdded(owner);
    }

    /**
     * @notice Remove an owner (requires multi-sig)
     * @param owner Owner to remove
     */
    function removeOwner(address owner) external onlyWallet {
        if (!isOwner[owner]) revert OwnerNotFound(owner);
        if (owners.length <= confirmationsRequired) revert NotEnoughOwners();

        isOwner[owner] = false;

        // Remove from owners array
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }

        // Adjust threshold if necessary
        if (confirmationsRequired > owners.length) {
            confirmationsRequired = owners.length;
            emit ThresholdChanged(confirmationsRequired + 1, confirmationsRequired);
        }

        emit OwnerRemoved(owner);
    }

    /**
     * @notice Replace an owner (requires multi-sig)
     * @param oldOwner Owner to replace
     * @param newOwner New owner address
     */
    function replaceOwner(
        address oldOwner,
        address newOwner
    ) external onlyWallet {
        if (!isOwner[oldOwner]) revert OwnerNotFound(oldOwner);
        if (newOwner == address(0)) revert ZeroAddress();
        if (isOwner[newOwner]) revert OwnerExists(newOwner);

        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == oldOwner) {
                owners[i] = newOwner;
                break;
            }
        }

        isOwner[oldOwner] = false;
        isOwner[newOwner] = true;

        emit OwnerRemoved(oldOwner);
        emit OwnerAdded(newOwner);
    }

    /**
     * @notice Change the confirmation threshold (requires multi-sig)
     * @param newThreshold New number of required confirmations
     */
    function changeThreshold(uint256 newThreshold) external onlyWallet {
        if (newThreshold == 0 || newThreshold > owners.length) {
            revert InvalidThreshold();
        }

        uint256 oldThreshold = confirmationsRequired;
        confirmationsRequired = newThreshold;

        emit ThresholdChanged(oldThreshold, newThreshold);
    }

    /**
     * @notice Set execution delay (requires multi-sig)
     * @param newDelay New delay in seconds
     */
    function setExecutionDelay(uint256 newDelay) external onlyWallet {
        require(newDelay <= 7 days, "Delay too long");
        executionDelay = newDelay;
    }

    // ============ View Functions ============

    /**
     * @notice Get all owners
     * @return Array of owner addresses
     */
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    /**
     * @notice Get total number of transactions
     * @return Transaction count
     */
    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    /**
     * @notice Get transaction details
     * @param txIndex Transaction index
     * @return to Destination address
     * @return value ETH value
     * @return data Call data
     * @return executed Whether executed
     * @return confirmationCount Number of confirmations
     * @return submittedAt Submission timestamp
     */
    function getTransaction(
        uint256 txIndex
    )
        external
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 confirmationCount,
            uint256 submittedAt
        )
    {
        Transaction storage transaction = transactions[txIndex];
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.confirmationCount,
            transaction.submittedAt
        );
    }

    /**
     * @notice Get confirmations for a transaction
     * @param txIndex Transaction index
     * @return Array of confirming owner addresses
     */
    function getConfirmations(
        uint256 txIndex
    ) external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < owners.length; i++) {
            if (isConfirmed[txIndex][owners[i]]) {
                count++;
            }
        }

        address[] memory confirmations = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < owners.length; i++) {
            if (isConfirmed[txIndex][owners[i]]) {
                confirmations[index] = owners[i];
                index++;
            }
        }

        return confirmations;
    }

    /**
     * @notice Check if transaction is executable
     * @param txIndex Transaction index
     * @return True if transaction can be executed
     */
    function isExecutable(uint256 txIndex) external view returns (bool) {
        if (txIndex >= transactions.length) return false;

        Transaction storage transaction = transactions[txIndex];
        if (transaction.executed) return false;
        if (transaction.confirmationCount < confirmationsRequired) return false;
        if (block.timestamp < transaction.submittedAt + executionDelay) return false;

        return true;
    }

    /**
     * @notice Get pending transactions count
     * @return Number of pending (unexecuted) transactions
     */
    function getPendingTransactionCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed) {
                count++;
            }
        }
        return count;
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal function to confirm a transaction
     * @param txIndex Transaction index
     */
    function _confirmTransaction(uint256 txIndex) internal {
        Transaction storage transaction = transactions[txIndex];
        transaction.confirmationCount++;
        isConfirmed[txIndex][msg.sender] = true;

        emit TransactionConfirmed(txIndex, msg.sender);
    }

    // ============ Receive Function ============

    /// @notice Allows contract to receive ETH
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }
}
