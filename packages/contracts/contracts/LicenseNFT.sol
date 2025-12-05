// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ILicenseNFT.sol";

/**
 * @title LicenseNFT
 * @author Viddhana Pool
 * @notice ERC721 NFT-based licensing system for mining pool access
 * @dev Implements tiered licensing with purchasing, renewal, and upgrade functionality
 */
contract LicenseNFT is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    ILicenseNFT
{
    // ============ Constants ============

    /// @notice Role for managing license parameters
    bytes32 public constant LICENSE_MANAGER_ROLE = keccak256("LICENSE_MANAGER_ROLE");

    /// @notice Basis points denominator (100% = 10000)
    uint256 public constant BASIS_POINTS = 10000;

    // ============ State Variables ============

    /// @notice Counter for token IDs
    uint256 private _tokenIdCounter;

    /// @notice Mapping from token ID to license data
    mapping(uint256 => License) private _licenses;

    /// @notice Mapping from tier to price in wei
    mapping(LicenseTier => uint256) public tierPrices;

    /// @notice Mapping from tier to duration in seconds
    mapping(LicenseTier => uint256) public tierDurations;

    /// @notice Mapping from tier to pool fee in basis points
    mapping(LicenseTier => uint256) public tierPoolFees;

    /// @notice Mapping from owner to their active license token ID (0 if none)
    mapping(address => uint256) public activeLicenseOf;

    /// @notice Treasury address for receiving payments
    address public treasury;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Grace period for license renewal after expiry
    uint256 public renewalGracePeriod = 7 days;

    // ============ Events ============

    /// @notice Emitted when base URI is updated
    event BaseURIUpdated(string oldURI, string newURI);

    /// @notice Emitted when renewal grace period is updated
    event RenewalGracePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);

    // ============ Errors ============

    /// @notice Thrown when payment is insufficient
    error InsufficientPayment(uint256 required, uint256 provided);

    /// @notice Thrown when license is expired
    error LicenseExpired(uint256 tokenId);

    /// @notice Thrown when license is still active (can't purchase new)
    error LicenseStillActive(uint256 tokenId);

    /// @notice Thrown when trying to downgrade tier
    error CannotDowngradeTier(LicenseTier current, LicenseTier requested);

    /// @notice Thrown when caller doesn't own the token
    error NotTokenOwner(uint256 tokenId);

    /// @notice Thrown when license is past renewal grace period
    error PastRenewalGracePeriod(uint256 tokenId);

    /// @notice Thrown when transfer fails
    error TransferFailed();

    /// @notice Thrown when tier is invalid
    error InvalidTier();

    /// @notice Thrown when upgrading to same tier
    error SameTier();

    // ============ Constructor ============

    /**
     * @notice Initializes the LicenseNFT contract
     * @param admin Address to receive admin role
     * @param _treasury Address to receive payments
     */
    constructor(
        address admin,
        address _treasury
    ) ERC721("Viddhana License", "VLICENSE") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LICENSE_MANAGER_ROLE, admin);

        treasury = _treasury;
        _tokenIdCounter = 1;

        // Set default tier prices (in wei)
        tierPrices[LicenseTier.Basic] = 0.01 ether;
        tierPrices[LicenseTier.Pro] = 0.05 ether;
        tierPrices[LicenseTier.Enterprise] = 0.2 ether;

        // Set default tier durations
        tierDurations[LicenseTier.Basic] = 30 days;
        tierDurations[LicenseTier.Pro] = 90 days;
        tierDurations[LicenseTier.Enterprise] = 365 days;

        // Set default pool fees (in basis points)
        // Lower fee = better deal for user
        tierPoolFees[LicenseTier.Basic] = 300; // 3%
        tierPoolFees[LicenseTier.Pro] = 200; // 2%
        tierPoolFees[LicenseTier.Enterprise] = 100; // 1%
    }

    // ============ External Functions ============

    /**
     * @notice Purchase a new license
     * @param tier The license tier to purchase
     * @return tokenId The ID of the minted license NFT
     */
    function purchaseLicense(
        LicenseTier tier
    )
        external
        payable
        override
        nonReentrant
        whenNotPaused
        returns (uint256 tokenId)
    {
        uint256 existingLicense = activeLicenseOf[msg.sender];
        if (existingLicense != 0) {
            License storage existing = _licenses[existingLicense];
            if (existing.expiresAt > block.timestamp) {
                revert LicenseStillActive(existingLicense);
            }
        }

        uint256 price = tierPrices[tier];
        if (msg.value < price) {
            revert InsufficientPayment(price, msg.value);
        }

        tokenId = _tokenIdCounter++;

        _safeMint(msg.sender, tokenId);

        uint256 expiresAt = block.timestamp + tierDurations[tier];

        _licenses[tokenId] = License({
            tier: tier,
            purchasedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });

        activeLicenseOf[msg.sender] = tokenId;

        // Transfer payment to treasury
        _transferToTreasury(price);

        // Refund excess payment
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit LicensePurchased(tokenId, msg.sender, tier, price, expiresAt);
    }

    /**
     * @notice Renew an existing license
     * @param tokenId The license token ID to renew
     */
    function renewLicense(
        uint256 tokenId
    ) external payable override nonReentrant whenNotPaused {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);

        License storage license = _licenses[tokenId];

        // Check if past grace period
        if (block.timestamp > license.expiresAt + renewalGracePeriod) {
            revert PastRenewalGracePeriod(tokenId);
        }

        uint256 price = tierPrices[license.tier];
        if (msg.value < price) {
            revert InsufficientPayment(price, msg.value);
        }

        // Extend from current expiry or now, whichever is later
        uint256 baseTime = license.expiresAt > block.timestamp
            ? license.expiresAt
            : block.timestamp;

        uint256 newExpiresAt = baseTime + tierDurations[license.tier];
        license.expiresAt = newExpiresAt;
        license.isActive = true;

        // Transfer payment to treasury
        _transferToTreasury(price);

        // Refund excess payment
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit LicenseRenewed(tokenId, msg.sender, newExpiresAt);
    }

    /**
     * @notice Upgrade a license to a higher tier
     * @param tokenId The license token ID to upgrade
     * @param newTier The new tier to upgrade to
     */
    function upgradeLicense(
        uint256 tokenId,
        LicenseTier newTier
    ) external payable override nonReentrant whenNotPaused {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);

        License storage license = _licenses[tokenId];

        if (license.expiresAt < block.timestamp) {
            revert LicenseExpired(tokenId);
        }

        if (newTier == license.tier) revert SameTier();
        if (uint8(newTier) <= uint8(license.tier)) {
            revert CannotDowngradeTier(license.tier, newTier);
        }

        // Calculate prorated price
        uint256 remainingTime = license.expiresAt - block.timestamp;
        uint256 remainingValue = (tierPrices[license.tier] * remainingTime) / tierDurations[license.tier];
        uint256 newTierCost = tierPrices[newTier];

        uint256 upgradeCost = newTierCost > remainingValue ? newTierCost - remainingValue : 0;

        if (msg.value < upgradeCost) {
            revert InsufficientPayment(upgradeCost, msg.value);
        }

        LicenseTier oldTier = license.tier;
        license.tier = newTier;

        // Extend expiry based on new tier duration
        license.expiresAt = block.timestamp + tierDurations[newTier];

        // Transfer payment to treasury
        if (upgradeCost > 0) {
            _transferToTreasury(upgradeCost);
        }

        // Refund excess payment
        if (msg.value > upgradeCost) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - upgradeCost}("");
            if (!refundSuccess) revert TransferFailed();
        }

        emit LicenseUpgraded(tokenId, msg.sender, oldTier, newTier, upgradeCost);
    }

    /**
     * @notice Check if an address has an active license
     * @param owner The address to check
     * @return hasLicense True if the address has an active license
     * @return tier The license tier (only valid if hasLicense is true)
     */
    function hasActiveLicense(
        address owner
    ) external view override returns (bool hasLicense, LicenseTier tier) {
        uint256 tokenId = activeLicenseOf[owner];
        if (tokenId == 0) {
            return (false, LicenseTier.Basic);
        }

        License storage license = _licenses[tokenId];
        if (license.expiresAt < block.timestamp) {
            return (false, LicenseTier.Basic);
        }

        return (true, license.tier);
    }

    /**
     * @notice Get the pool fee for a license tier
     * @param tier The license tier
     * @return fee The pool fee percentage (in basis points)
     */
    function getPoolFee(
        LicenseTier tier
    ) external view override returns (uint256 fee) {
        return tierPoolFees[tier];
    }

    /**
     * @notice Get license details for a token
     * @param tokenId The license token ID
     * @return The license details
     */
    function getLicense(
        uint256 tokenId
    ) external view override returns (License memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _licenses[tokenId];
    }

    /**
     * @notice Get the price for a license tier
     * @param tier The license tier
     * @return price The price in wei
     */
    function getTierPrice(
        LicenseTier tier
    ) external view override returns (uint256 price) {
        return tierPrices[tier];
    }

    /**
     * @notice Get the duration for a license tier
     * @param tier The license tier
     * @return duration The duration in seconds
     */
    function getTierDuration(
        LicenseTier tier
    ) external view override returns (uint256 duration) {
        return tierDurations[tier];
    }

    /**
     * @notice Check if a license is currently active
     * @param tokenId The license token ID
     * @return True if the license is active
     */
    function isLicenseActive(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) return false;
        return _licenses[tokenId].expiresAt >= block.timestamp;
    }

    /**
     * @notice Get remaining time on a license
     * @param tokenId The license token ID
     * @return Remaining time in seconds (0 if expired)
     */
    function getRemainingTime(uint256 tokenId) external view returns (uint256) {
        if (_ownerOf(tokenId) == address(0)) return 0;
        License storage license = _licenses[tokenId];
        if (license.expiresAt < block.timestamp) return 0;
        return license.expiresAt - block.timestamp;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the price for a tier
     * @param tier The tier to update
     * @param newPrice The new price in wei
     */
    function setTierPrice(
        LicenseTier tier,
        uint256 newPrice
    ) external onlyRole(LICENSE_MANAGER_ROLE) {
        uint256 oldPrice = tierPrices[tier];
        tierPrices[tier] = newPrice;
        emit TierPricingUpdated(tier, oldPrice, newPrice);
    }

    /**
     * @notice Update the duration for a tier
     * @param tier The tier to update
     * @param newDuration The new duration in seconds
     */
    function setTierDuration(
        LicenseTier tier,
        uint256 newDuration
    ) external onlyRole(LICENSE_MANAGER_ROLE) {
        require(newDuration >= 1 days, "Duration too short");
        uint256 oldDuration = tierDurations[tier];
        tierDurations[tier] = newDuration;
        emit TierDurationUpdated(tier, oldDuration, newDuration);
    }

    /**
     * @notice Update the pool fee for a tier
     * @param tier The tier to update
     * @param newFee The new fee in basis points
     */
    function setTierPoolFee(
        LicenseTier tier,
        uint256 newFee
    ) external onlyRole(LICENSE_MANAGER_ROLE) {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        uint256 oldFee = tierPoolFees[tier];
        tierPoolFees[tier] = newFee;
        emit PoolFeeUpdated(tier, oldFee, newFee);
    }

    /**
     * @notice Update the treasury address
     * @param newTreasury The new treasury address
     */
    function setTreasury(
        address newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    /**
     * @notice Update the base token URI
     * @param baseURI The new base URI
     */
    function setBaseURI(
        string calldata baseURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory oldURI = _baseTokenURI;
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(oldURI, baseURI);
    }

    /**
     * @notice Update the renewal grace period
     * @param newPeriod The new grace period in seconds
     */
    function setRenewalGracePeriod(
        uint256 newPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPeriod <= 30 days, "Period too long");
        uint256 oldPeriod = renewalGracePeriod;
        renewalGracePeriod = newPeriod;
        emit RenewalGracePeriodUpdated(oldPeriod, newPeriod);
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
     * @notice Mint a license directly (admin only, for airdrops/promotions)
     * @param to Recipient address
     * @param tier License tier
     * @param duration Custom duration in seconds
     * @return tokenId The minted token ID
     */
    function adminMint(
        address to,
        LicenseTier tier,
        uint256 duration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 tokenId) {
        require(to != address(0), "Invalid recipient");
        require(duration > 0, "Invalid duration");

        tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);

        uint256 expiresAt = block.timestamp + duration;

        _licenses[tokenId] = License({
            tier: tier,
            purchasedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });

        // Only set as active license if user doesn't have one
        if (activeLicenseOf[to] == 0) {
            activeLicenseOf[to] = tokenId;
        }

        emit LicensePurchased(tokenId, to, tier, 0, expiresAt);
    }

    // ============ Internal Functions ============

    /**
     * @notice Transfer funds to treasury
     * @param amount Amount to transfer
     */
    function _transferToTreasury(uint256 amount) internal {
        if (treasury != address(0) && amount > 0) {
            (bool success, ) = payable(treasury).call{value: amount}("");
            if (!success) revert TransferFailed();
        }
    }

    /**
     * @notice Override _baseURI for token metadata
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Update active license on transfer
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);

        // Remove from previous owner's active license
        if (from != address(0) && activeLicenseOf[from] == tokenId) {
            activeLicenseOf[from] = 0;
        }

        // Set as new owner's active license if they don't have one
        if (to != address(0) && activeLicenseOf[to] == 0) {
            activeLicenseOf[to] = tokenId;
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Override _increaseBalance for ERC721Enumerable
     */
    function _increaseBalance(
        address account,
        uint128 amount
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, amount);
    }

    /**
     * @notice Override tokenURI for ERC721URIStorage
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Override supportsInterface for multiple inheritance
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
