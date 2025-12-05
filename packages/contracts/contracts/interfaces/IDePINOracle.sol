// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDePINOracle
 * @author Viddhana Pool
 * @notice Interface for the DePIN Oracle contract
 * @dev Defines the external interface for IoT verification operations
 */
interface IDePINOracle {
    // ============ Enums ============

    /// @notice Verification status enum
    enum VerificationStatus {
        Pending,
        Verified,
        Failed,
        Disputed
    }

    // ============ Structs ============

    /// @notice Rig registration structure
    struct Rig {
        bytes32 rigId;
        address owner;
        string hardwareType;
        uint256 registeredAt;
        bool isActive;
        uint256 verificationScore;
        uint256 totalEnergyReported;
        uint256 lastVerificationTime;
    }

    /// @notice Verification request structure
    struct VerificationRequest {
        uint256 requestId;
        bytes32 rigId;
        VerificationStatus status;
        uint256 requestedAt;
        uint256 completedAt;
        bytes32 dataHash;
    }

    /// @notice Energy consumption report structure
    struct EnergyReport {
        bytes32 rigId;
        uint256 energyConsumed; // in watt-hours
        uint256 timestamp;
        bytes32 proofHash;
        bool verified;
    }

    // ============ Events ============

    /// @notice Emitted when a rig is registered
    event RigRegistered(
        bytes32 indexed rigId,
        address indexed owner,
        string hardwareType
    );

    /// @notice Emitted when a rig is deactivated
    event RigDeactivated(bytes32 indexed rigId, address indexed owner);

    /// @notice Emitted when a verification is requested
    event VerificationRequested(
        uint256 indexed requestId,
        bytes32 indexed rigId,
        address indexed requester
    );

    /// @notice Emitted when verification is completed
    event VerificationCompleted(
        uint256 indexed requestId,
        bytes32 indexed rigId,
        VerificationStatus status,
        uint256 score
    );

    /// @notice Emitted when energy consumption is reported
    event EnergyReported(
        bytes32 indexed rigId,
        uint256 energyConsumed,
        uint256 timestamp,
        bytes32 proofHash
    );

    /// @notice Emitted when Chainlink oracle responds
    event OracleResponseReceived(
        bytes32 indexed requestId,
        bytes32 indexed rigId,
        bool success
    );

    /// @notice Emitted when verification score is updated
    event VerificationScoreUpdated(
        bytes32 indexed rigId,
        uint256 oldScore,
        uint256 newScore
    );

    // ============ External Functions ============

    /**
     * @notice Register a new mining rig
     * @param rigId Unique identifier for the rig
     * @param hardwareType Type of mining hardware
     */
    function registerRig(bytes32 rigId, string calldata hardwareType) external payable;

    /**
     * @notice Deactivate a registered rig
     * @param rigId The rig ID to deactivate
     */
    function deactivateRig(bytes32 rigId) external;

    /**
     * @notice Request verification for a rig
     * @param rigId The rig ID to verify
     * @param dataHash Hash of the verification data
     * @return requestId The verification request ID
     */
    function requestVerification(
        bytes32 rigId,
        bytes32 dataHash
    ) external returns (uint256 requestId);

    /**
     * @notice Report energy consumption for a rig
     * @param rigId The rig ID
     * @param energyConsumed Energy consumed in watt-hours
     * @param proofHash Hash of the energy proof
     */
    function reportEnergyConsumption(
        bytes32 rigId,
        uint256 energyConsumed,
        bytes32 proofHash
    ) external;

    /**
     * @notice Get rig details
     * @param rigId The rig ID
     * @return The rig details
     */
    function getRig(bytes32 rigId) external view returns (Rig memory);

    /**
     * @notice Get verification request details
     * @param requestId The request ID
     * @return The verification request details
     */
    function getVerificationRequest(
        uint256 requestId
    ) external view returns (VerificationRequest memory);

    /**
     * @notice Get the verification score for a rig
     * @param rigId The rig ID
     * @return score The current verification score
     */
    function getVerificationScore(bytes32 rigId) external view returns (uint256 score);

    /**
     * @notice Check if a rig is verified and active
     * @param rigId The rig ID
     * @return True if the rig is verified and active
     */
    function isRigVerified(bytes32 rigId) external view returns (bool);
}
