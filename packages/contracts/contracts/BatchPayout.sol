// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BatchPayout
 * @author Viddhana Pool
 * @notice Merkle tree-based batch payout system for efficient reward distribution
 * @dev Uses Merkle proofs to enable gas-efficient batch payouts with claim verification
 */
contract BatchPayout is AccessControl, Pausable, ReentrancyGuard {
    // ============ Constants ============

    /// @notice Role for managing merkle roots
    bytes32 public constant MERKLE_MANAGER_ROLE = keccak256("MERKLE_MANAGER_ROLE");

    // ============ Structs ============

    /// @notice Merkle root information
    struct MerkleRootInfo {
        bytes32 root;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 createdAt;
        uint256 expiresAt;
        bool isActive;
        string description;
    }

    // ============ State Variables ============

    /// @notice Counter for batch IDs
    uint256 private _batchIdCounter;

    /// @notice Mapping from batch ID to merkle root info
    mapping(uint256 => MerkleRootInfo) public merkleRoots;

    /// @notice Mapping from batch ID to user address to claimed status
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    /// @notice Mapping from batch ID to user address to claimed amount
    mapping(uint256 => mapping(address => uint256)) public claimedAmounts;

    /// @notice Treasury address
    address public treasury;

    /// @notice Default claim expiry duration (30 days)
    uint256 public defaultExpiryDuration = 30 days;

    // ============ Events ============

    /// @notice Emitted when a new merkle root is set
    event MerkleRootSet(
        uint256 indexed batchId,
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 expiresAt,
        string description
    );

    /// @notice Emitted when a payout is claimed
    event PayoutClaimed(
        uint256 indexed batchId,
        address indexed claimant,
        uint256 amount
    );

    /// @notice Emitted when a merkle root is deactivated
    event MerkleRootDeactivated(uint256 indexed batchId);

    /// @notice Emitted when unclaimed funds are recovered
    event UnclaimedFundsRecovered(
        uint256 indexed batchId,
        uint256 amount,
        address indexed to
    );

    /// @notice Emitted when default expiry duration is updated
    event DefaultExpiryDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // ============ Errors ============

    /// @notice Thrown when merkle root is invalid
    error InvalidMerkleRoot();

    /// @notice Thrown when batch ID is invalid
    error InvalidBatchId(uint256 batchId);

    /// @notice Thrown when batch is not active
    error BatchNotActive(uint256 batchId);

    /// @notice Thrown when batch has expired
    error BatchExpired(uint256 batchId);

    /// @notice Thrown when user has already claimed
    error AlreadyClaimed(uint256 batchId, address claimant);

    /// @notice Thrown when merkle proof is invalid
    error InvalidMerkleProof();

    /// @notice Thrown when claim amount is invalid
    error InvalidClaimAmount();

    /// @notice Thrown when transfer fails
    error TransferFailed();

    /// @notice Thrown when contract has insufficient balance
    error InsufficientBalance(uint256 requested, uint256 available);

    /// @notice Thrown when batch has not expired yet
    error BatchNotExpired(uint256 batchId);

    // ============ Constructor ============

    /**
     * @notice Initializes the contract with admin address
     * @param admin Address to receive admin role
     * @param _treasury Address to receive recovered funds
     */
    constructor(address admin, address _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MERKLE_MANAGER_ROLE, admin);
        treasury = _treasury;
        _batchIdCounter = 1;
    }

    // ============ External Functions ============

    /**
     * @notice Set a new merkle root for batch payouts
     * @param merkleRoot The merkle root hash
     * @param totalAmount Total amount allocated for this batch
     * @param expiryDuration Duration until claims expire (0 for default)
     * @param description Description of the batch
     * @return batchId The ID of the new batch
     */
    function setMerkleRoot(
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 expiryDuration,
        string calldata description
    )
        external
        onlyRole(MERKLE_MANAGER_ROLE)
        returns (uint256 batchId)
    {
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (totalAmount == 0) revert InvalidClaimAmount();

        if (address(this).balance < totalAmount) {
            revert InsufficientBalance(totalAmount, address(this).balance);
        }

        batchId = _batchIdCounter++;

        uint256 expiry = expiryDuration > 0 
            ? block.timestamp + expiryDuration 
            : block.timestamp + defaultExpiryDuration;

        merkleRoots[batchId] = MerkleRootInfo({
            root: merkleRoot,
            totalAmount: totalAmount,
            claimedAmount: 0,
            createdAt: block.timestamp,
            expiresAt: expiry,
            isActive: true,
            description: description
        });

        emit MerkleRootSet(batchId, merkleRoot, totalAmount, expiry, description);
    }

    /**
     * @notice Claim payout using merkle proof
     * @param batchId The batch ID to claim from
     * @param amount The amount to claim
     * @param proof The merkle proof
     */
    function claimPayout(
        uint256 batchId,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant whenNotPaused {
        MerkleRootInfo storage batch = merkleRoots[batchId];

        if (batch.root == bytes32(0)) revert InvalidBatchId(batchId);
        if (!batch.isActive) revert BatchNotActive(batchId);
        if (block.timestamp > batch.expiresAt) revert BatchExpired(batchId);
        if (hasClaimed[batchId][msg.sender]) {
            revert AlreadyClaimed(batchId, msg.sender);
        }
        if (amount == 0) revert InvalidClaimAmount();

        // Verify merkle proof
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProof.verify(proof, batch.root, leaf)) {
            revert InvalidMerkleProof();
        }

        // Mark as claimed before transfer
        hasClaimed[batchId][msg.sender] = true;
        claimedAmounts[batchId][msg.sender] = amount;
        batch.claimedAmount += amount;

        // Transfer funds
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit PayoutClaimed(batchId, msg.sender, amount);
    }

    /**
     * @notice Deactivate a merkle root batch
     * @param batchId The batch ID to deactivate
     */
    function deactivateMerkleRoot(
        uint256 batchId
    ) external onlyRole(MERKLE_MANAGER_ROLE) {
        MerkleRootInfo storage batch = merkleRoots[batchId];
        if (batch.root == bytes32(0)) revert InvalidBatchId(batchId);

        batch.isActive = false;
        emit MerkleRootDeactivated(batchId);
    }

    /**
     * @notice Recover unclaimed funds from an expired batch
     * @param batchId The batch ID to recover funds from
     */
    function recoverUnclaimedFunds(
        uint256 batchId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        MerkleRootInfo storage batch = merkleRoots[batchId];

        if (batch.root == bytes32(0)) revert InvalidBatchId(batchId);
        if (block.timestamp <= batch.expiresAt) revert BatchNotExpired(batchId);

        uint256 unclaimed = batch.totalAmount - batch.claimedAmount;
        if (unclaimed == 0) return;

        // Mark batch as fully claimed to prevent re-entry
        batch.claimedAmount = batch.totalAmount;
        batch.isActive = false;

        // Transfer to treasury
        address recipient = treasury != address(0) ? treasury : msg.sender;
        (bool success, ) = payable(recipient).call{value: unclaimed}("");
        if (!success) revert TransferFailed();

        emit UnclaimedFundsRecovered(batchId, unclaimed, recipient);
    }

    /**
     * @notice Update the default expiry duration
     * @param newDuration New default duration in seconds
     */
    function setDefaultExpiryDuration(
        uint256 newDuration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newDuration >= 1 days, "Duration too short");
        require(newDuration <= 365 days, "Duration too long");

        uint256 oldDuration = defaultExpiryDuration;
        defaultExpiryDuration = newDuration;

        emit DefaultExpiryDurationUpdated(oldDuration, newDuration);
    }

    /**
     * @notice Update the treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(
        address newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
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
    function deposit() external payable {}

    // ============ View Functions ============

    /**
     * @notice Get merkle root info for a batch
     * @param batchId The batch ID
     * @return The merkle root info
     */
    function getMerkleRootInfo(
        uint256 batchId
    ) external view returns (MerkleRootInfo memory) {
        return merkleRoots[batchId];
    }

    /**
     * @notice Check if an address has claimed from a batch
     * @param batchId The batch ID
     * @param claimant The address to check
     * @return True if the address has claimed
     */
    function hasUserClaimed(
        uint256 batchId,
        address claimant
    ) external view returns (bool) {
        return hasClaimed[batchId][claimant];
    }

    /**
     * @notice Get the claimed amount for an address in a batch
     * @param batchId The batch ID
     * @param claimant The address to check
     * @return The claimed amount
     */
    function getUserClaimedAmount(
        uint256 batchId,
        address claimant
    ) external view returns (uint256) {
        return claimedAmounts[batchId][claimant];
    }

    /**
     * @notice Get the remaining claimable amount for a batch
     * @param batchId The batch ID
     * @return The remaining amount
     */
    function getRemainingClaimable(
        uint256 batchId
    ) external view returns (uint256) {
        MerkleRootInfo storage batch = merkleRoots[batchId];
        return batch.totalAmount - batch.claimedAmount;
    }

    /**
     * @notice Check if a batch is still claimable
     * @param batchId The batch ID
     * @return True if the batch can still be claimed from
     */
    function isBatchClaimable(uint256 batchId) external view returns (bool) {
        MerkleRootInfo storage batch = merkleRoots[batchId];
        return batch.isActive && block.timestamp <= batch.expiresAt;
    }

    /**
     * @notice Verify a merkle proof without claiming
     * @param batchId The batch ID
     * @param account The account to verify
     * @param amount The amount to verify
     * @param proof The merkle proof
     * @return True if the proof is valid
     */
    function verifyProof(
        uint256 batchId,
        address account,
        uint256 amount,
        bytes32[] calldata proof
    ) external view returns (bool) {
        MerkleRootInfo storage batch = merkleRoots[batchId];
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))));
        return MerkleProof.verify(proof, batch.root, leaf);
    }

    /**
     * @notice Get the next batch ID
     * @return The next batch ID that will be assigned
     */
    function getNextBatchId() external view returns (uint256) {
        return _batchIdCounter;
    }

    // ============ Receive Function ============

    /// @notice Allows contract to receive ETH
    receive() external payable {}
}
