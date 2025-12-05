// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IDePINOracle.sol";

/**
 * @title DePINOracle
 * @author Viddhana Pool
 * @notice Oracle contract for DePIN (Decentralized Physical Infrastructure Network) verification
 * @dev Integrates with Chainlink for off-chain data verification of mining rigs
 */
contract DePINOracle is
    AccessControl,
    Pausable,
    ReentrancyGuard,
    IDePINOracle
{
    // ============ Constants ============

    /// @notice Role for oracle operators
    bytes32 public constant ORACLE_OPERATOR_ROLE = keccak256("ORACLE_OPERATOR_ROLE");

    /// @notice Role for rig verifiers
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    /// @notice Maximum verification score
    uint256 public constant MAX_VERIFICATION_SCORE = 100;

    /// @notice Minimum score to be considered verified
    uint256 public constant MIN_VERIFIED_SCORE = 70;

    // ============ State Variables ============

    /// @notice Counter for verification request IDs
    uint256 private _requestIdCounter;

    /// @notice Mapping from rig ID to rig data
    mapping(bytes32 => Rig) private _rigs;

    /// @notice Mapping from request ID to verification request
    mapping(uint256 => VerificationRequest) private _verificationRequests;

    /// @notice Mapping from rig ID to array of energy reports
    mapping(bytes32 => EnergyReport[]) private _energyReports;

    /// @notice Chainlink oracle address (for future integration)
    address public chainlinkOracle;

    /// @notice Chainlink job ID for verification
    bytes32 public chainlinkJobId;

    /// @notice Chainlink LINK fee
    uint256 public chainlinkFee;

    /// @notice Verification cooldown period
    uint256 public verificationCooldown = 1 hours;

    /// @notice Maximum energy reports to store per rig
    uint256 public maxEnergyReports = 100;

    /// @notice Registration fee
    uint256 public registrationFee = 0.001 ether;

    /// @notice Treasury address
    address public treasury;

    // ============ Events ============

    /// @notice Emitted when chainlink configuration is updated
    event ChainlinkConfigUpdated(
        address oracle,
        bytes32 jobId,
        uint256 fee
    );

    /// @notice Emitted when registration fee is updated
    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee);

    // ============ Errors ============

    /// @notice Thrown when rig already exists
    error RigAlreadyExists(bytes32 rigId);

    /// @notice Thrown when rig does not exist
    error RigNotFound(bytes32 rigId);

    /// @notice Thrown when rig is not active
    error RigNotActive(bytes32 rigId);

    /// @notice Thrown when caller is not rig owner
    error NotRigOwner(bytes32 rigId);

    /// @notice Thrown when verification is on cooldown
    error VerificationOnCooldown(bytes32 rigId, uint256 availableAt);

    /// @notice Thrown when request does not exist
    error RequestNotFound(uint256 requestId);

    /// @notice Thrown when payment is insufficient
    error InsufficientPayment(uint256 required, uint256 provided);

    /// @notice Thrown when transfer fails
    error TransferFailed();

    /// @notice Thrown when hardware type is empty
    error InvalidHardwareType();

    /// @notice Thrown when energy value is zero
    error InvalidEnergyValue();

    // ============ Constructor ============

    /**
     * @notice Initializes the DePINOracle contract
     * @param admin Address to receive admin role
     * @param _treasury Address to receive fees
     */
    constructor(address admin, address _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_OPERATOR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);

        treasury = _treasury;
        _requestIdCounter = 1;
    }

    // ============ External Functions ============

    /**
     * @notice Register a new mining rig
     * @param rigId Unique identifier for the rig
     * @param hardwareType Type of mining hardware
     */
    function registerRig(
        bytes32 rigId,
        string calldata hardwareType
    ) external payable override whenNotPaused {
        if (_rigs[rigId].registeredAt != 0) revert RigAlreadyExists(rigId);
        if (bytes(hardwareType).length == 0) revert InvalidHardwareType();
        if (msg.value < registrationFee) {
            revert InsufficientPayment(registrationFee, msg.value);
        }

        _rigs[rigId] = Rig({
            rigId: rigId,
            owner: msg.sender,
            hardwareType: hardwareType,
            registeredAt: block.timestamp,
            isActive: true,
            verificationScore: 0,
            totalEnergyReported: 0,
            lastVerificationTime: 0
        });

        // Transfer registration fee to treasury
        if (treasury != address(0) && registrationFee > 0) {
            (bool success, ) = payable(treasury).call{value: registrationFee}("");
            if (!success) revert TransferFailed();
        }

        // Refund excess payment
        if (msg.value > registrationFee) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - registrationFee}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit RigRegistered(rigId, msg.sender, hardwareType);
    }

    /**
     * @notice Deactivate a registered rig
     * @param rigId The rig ID to deactivate
     */
    function deactivateRig(bytes32 rigId) external override {
        Rig storage rig = _rigs[rigId];
        if (rig.registeredAt == 0) revert RigNotFound(rigId);
        if (rig.owner != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotRigOwner(rigId);
        }

        rig.isActive = false;
        emit RigDeactivated(rigId, rig.owner);
    }

    /**
     * @notice Request verification for a rig
     * @param rigId The rig ID to verify
     * @param dataHash Hash of the verification data
     * @return requestId The verification request ID
     */
    function requestVerification(
        bytes32 rigId,
        bytes32 dataHash
    ) external override whenNotPaused returns (uint256 requestId) {
        Rig storage rig = _rigs[rigId];
        if (rig.registeredAt == 0) revert RigNotFound(rigId);
        if (!rig.isActive) revert RigNotActive(rigId);
        if (rig.owner != msg.sender) revert NotRigOwner(rigId);

        // Check cooldown
        if (rig.lastVerificationTime + verificationCooldown > block.timestamp) {
            revert VerificationOnCooldown(
                rigId,
                rig.lastVerificationTime + verificationCooldown
            );
        }

        requestId = _requestIdCounter++;

        _verificationRequests[requestId] = VerificationRequest({
            requestId: requestId,
            rigId: rigId,
            status: VerificationStatus.Pending,
            requestedAt: block.timestamp,
            completedAt: 0,
            dataHash: dataHash
        });

        emit VerificationRequested(requestId, rigId, msg.sender);

        // In production, this would trigger a Chainlink oracle request
        // For now, we'll use manual verification through the VERIFIER_ROLE
    }

    /**
     * @notice Complete verification (called by oracle or verifier)
     * @param requestId The request ID
     * @param status The verification status
     * @param score The verification score (0-100)
     */
    function fulfillVerification(
        uint256 requestId,
        VerificationStatus status,
        uint256 score
    ) external onlyRole(VERIFIER_ROLE) {
        VerificationRequest storage request = _verificationRequests[requestId];
        if (request.requestId == 0) revert RequestNotFound(requestId);
        require(request.status == VerificationStatus.Pending, "Already processed");
        require(score <= MAX_VERIFICATION_SCORE, "Invalid score");

        request.status = status;
        request.completedAt = block.timestamp;

        Rig storage rig = _rigs[request.rigId];
        uint256 oldScore = rig.verificationScore;
        rig.verificationScore = score;
        rig.lastVerificationTime = block.timestamp;

        emit VerificationCompleted(requestId, request.rigId, status, score);
        emit VerificationScoreUpdated(request.rigId, oldScore, score);
        emit OracleResponseReceived(
            bytes32(requestId),
            request.rigId,
            status == VerificationStatus.Verified
        );
    }

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
    ) external override whenNotPaused {
        Rig storage rig = _rigs[rigId];
        if (rig.registeredAt == 0) revert RigNotFound(rigId);
        if (!rig.isActive) revert RigNotActive(rigId);
        if (rig.owner != msg.sender) revert NotRigOwner(rigId);
        if (energyConsumed == 0) revert InvalidEnergyValue();

        EnergyReport memory report = EnergyReport({
            rigId: rigId,
            energyConsumed: energyConsumed,
            timestamp: block.timestamp,
            proofHash: proofHash,
            verified: false
        });

        // Manage report storage (ring buffer behavior)
        if (_energyReports[rigId].length >= maxEnergyReports) {
            // Remove oldest report (shift array)
            for (uint256 i = 0; i < _energyReports[rigId].length - 1; i++) {
                _energyReports[rigId][i] = _energyReports[rigId][i + 1];
            }
            _energyReports[rigId].pop();
        }

        _energyReports[rigId].push(report);
        rig.totalEnergyReported += energyConsumed;

        emit EnergyReported(rigId, energyConsumed, block.timestamp, proofHash);
    }

    /**
     * @notice Verify an energy report
     * @param rigId The rig ID
     * @param reportIndex The index of the report to verify
     */
    function verifyEnergyReport(
        bytes32 rigId,
        uint256 reportIndex
    ) external onlyRole(VERIFIER_ROLE) {
        require(reportIndex < _energyReports[rigId].length, "Invalid index");
        _energyReports[rigId][reportIndex].verified = true;
    }

    /**
     * @notice Reactivate a deactivated rig
     * @param rigId The rig ID to reactivate
     */
    function reactivateRig(bytes32 rigId) external {
        Rig storage rig = _rigs[rigId];
        if (rig.registeredAt == 0) revert RigNotFound(rigId);
        if (rig.owner != msg.sender) revert NotRigOwner(rigId);

        rig.isActive = true;
    }

    /**
     * @notice Transfer rig ownership
     * @param rigId The rig ID
     * @param newOwner The new owner address
     */
    function transferRigOwnership(bytes32 rigId, address newOwner) external {
        Rig storage rig = _rigs[rigId];
        if (rig.registeredAt == 0) revert RigNotFound(rigId);
        if (rig.owner != msg.sender) revert NotRigOwner(rigId);
        require(newOwner != address(0), "Invalid new owner");

        rig.owner = newOwner;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set Chainlink configuration
     * @param oracle Chainlink oracle address
     * @param jobId Chainlink job ID
     * @param fee LINK fee for requests
     */
    function setChainlinkConfig(
        address oracle,
        bytes32 jobId,
        uint256 fee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        chainlinkOracle = oracle;
        chainlinkJobId = jobId;
        chainlinkFee = fee;
        emit ChainlinkConfigUpdated(oracle, jobId, fee);
    }

    /**
     * @notice Set verification cooldown period
     * @param cooldown New cooldown in seconds
     */
    function setVerificationCooldown(
        uint256 cooldown
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(cooldown >= 5 minutes, "Cooldown too short");
        verificationCooldown = cooldown;
    }

    /**
     * @notice Set maximum energy reports per rig
     * @param maxReports New maximum
     */
    function setMaxEnergyReports(
        uint256 maxReports
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxReports >= 10, "Max too low");
        maxEnergyReports = maxReports;
    }

    /**
     * @notice Set registration fee
     * @param newFee New fee in wei
     */
    function setRegistrationFee(
        uint256 newFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldFee = registrationFee;
        registrationFee = newFee;
        emit RegistrationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Set treasury address
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

    // ============ View Functions ============

    /**
     * @notice Get rig details
     * @param rigId The rig ID
     * @return The rig details
     */
    function getRig(
        bytes32 rigId
    ) external view override returns (Rig memory) {
        return _rigs[rigId];
    }

    /**
     * @notice Get verification request details
     * @param requestId The request ID
     * @return The verification request details
     */
    function getVerificationRequest(
        uint256 requestId
    ) external view override returns (VerificationRequest memory) {
        return _verificationRequests[requestId];
    }

    /**
     * @notice Get the verification score for a rig
     * @param rigId The rig ID
     * @return score The current verification score
     */
    function getVerificationScore(
        bytes32 rigId
    ) external view override returns (uint256 score) {
        return _rigs[rigId].verificationScore;
    }

    /**
     * @notice Check if a rig is verified and active
     * @param rigId The rig ID
     * @return True if the rig is verified and active
     */
    function isRigVerified(bytes32 rigId) external view override returns (bool) {
        Rig storage rig = _rigs[rigId];
        return rig.isActive && rig.verificationScore >= MIN_VERIFIED_SCORE;
    }

    /**
     * @notice Get energy reports for a rig
     * @param rigId The rig ID
     * @return Array of energy reports
     */
    function getEnergyReports(
        bytes32 rigId
    ) external view returns (EnergyReport[] memory) {
        return _energyReports[rigId];
    }

    /**
     * @notice Get total energy reported by a rig
     * @param rigId The rig ID
     * @return Total energy in watt-hours
     */
    function getTotalEnergyReported(
        bytes32 rigId
    ) external view returns (uint256) {
        return _rigs[rigId].totalEnergyReported;
    }

    /**
     * @notice Get the number of rigs owned by an address
     * @param owner The owner address
     * @param rigIds Array of rig IDs to check
     * @return count Number of owned rigs
     */
    function getRigCountByOwner(
        address owner,
        bytes32[] calldata rigIds
    ) external view returns (uint256 count) {
        for (uint256 i = 0; i < rigIds.length; i++) {
            if (_rigs[rigIds[i]].owner == owner) {
                count++;
            }
        }
    }

    /**
     * @notice Check if rig exists
     * @param rigId The rig ID
     * @return True if rig exists
     */
    function rigExists(bytes32 rigId) external view returns (bool) {
        return _rigs[rigId].registeredAt != 0;
    }

    /**
     * @notice Get the next request ID
     * @return The next request ID that will be assigned
     */
    function getNextRequestId() external view returns (uint256) {
        return _requestIdCounter;
    }
}
