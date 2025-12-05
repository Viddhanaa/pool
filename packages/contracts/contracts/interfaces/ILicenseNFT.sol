// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILicenseNFT
 * @author Viddhana Pool
 * @notice Interface for the LicenseNFT contract
 * @dev Defines the external interface for license NFT operations
 */
interface ILicenseNFT {
    // ============ Enums ============

    /// @notice License tier levels
    enum LicenseTier {
        Basic,
        Pro,
        Enterprise
    }

    // ============ Structs ============

    /// @notice License metadata structure
    struct License {
        LicenseTier tier;
        uint256 purchasedAt;
        uint256 expiresAt;
        bool isActive;
    }

    // ============ Events ============

    /// @notice Emitted when a license is purchased
    event LicensePurchased(
        uint256 indexed tokenId,
        address indexed owner,
        LicenseTier tier,
        uint256 price,
        uint256 expiresAt
    );

    /// @notice Emitted when a license is renewed
    event LicenseRenewed(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 newExpiresAt
    );

    /// @notice Emitted when a license is upgraded
    event LicenseUpgraded(
        uint256 indexed tokenId,
        address indexed owner,
        LicenseTier oldTier,
        LicenseTier newTier,
        uint256 pricePaid
    );

    /// @notice Emitted when tier pricing is updated
    event TierPricingUpdated(
        LicenseTier tier,
        uint256 oldPrice,
        uint256 newPrice
    );

    /// @notice Emitted when tier duration is updated
    event TierDurationUpdated(
        LicenseTier tier,
        uint256 oldDuration,
        uint256 newDuration
    );

    /// @notice Emitted when pool fee is updated
    event PoolFeeUpdated(
        LicenseTier tier,
        uint256 oldFee,
        uint256 newFee
    );

    // ============ External Functions ============

    /**
     * @notice Purchase a new license
     * @param tier The license tier to purchase
     * @return tokenId The ID of the minted license NFT
     */
    function purchaseLicense(LicenseTier tier) external payable returns (uint256 tokenId);

    /**
     * @notice Renew an existing license
     * @param tokenId The license token ID to renew
     */
    function renewLicense(uint256 tokenId) external payable;

    /**
     * @notice Upgrade a license to a higher tier
     * @param tokenId The license token ID to upgrade
     * @param newTier The new tier to upgrade to
     */
    function upgradeLicense(uint256 tokenId, LicenseTier newTier) external payable;

    /**
     * @notice Check if an address has an active license
     * @param owner The address to check
     * @return hasLicense True if the address has an active license
     * @return tier The license tier (only valid if hasLicense is true)
     */
    function hasActiveLicense(address owner) external view returns (bool hasLicense, LicenseTier tier);

    /**
     * @notice Get the pool fee for a license tier
     * @param tier The license tier
     * @return fee The pool fee percentage (in basis points)
     */
    function getPoolFee(LicenseTier tier) external view returns (uint256 fee);

    /**
     * @notice Get license details for a token
     * @param tokenId The license token ID
     * @return The license details
     */
    function getLicense(uint256 tokenId) external view returns (License memory);

    /**
     * @notice Get the price for a license tier
     * @param tier The license tier
     * @return price The price in wei
     */
    function getTierPrice(LicenseTier tier) external view returns (uint256 price);

    /**
     * @notice Get the duration for a license tier
     * @param tier The license tier
     * @return duration The duration in seconds
     */
    function getTierDuration(LicenseTier tier) external view returns (uint256 duration);
}
