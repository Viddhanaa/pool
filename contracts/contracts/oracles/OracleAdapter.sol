// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title OracleAdapter
 * @notice Chainlink-compatible oracle wrapper with staleness checks and price bounds
 * @dev Normalizes price feeds with decimal conversion and safety checks
 * 
 * V1: Optional/Future Use
 * - BTCD pricing may not need oracle initially (can use fixed $1 or skip oracle)
 * - Contract ready for V2 integration when USD pricing needed
 * - Useful for APY calculations and multi-asset support in V2
 * 
 * V2 Expansion Points:
 * - Integrate BTCD/USD price feed for accurate APY calculations
 * - Add multi-asset oracles (ETH/USD, USDC/USD)
 * - Use for dynamic TVL caps and risk calculations
 * - Real-time USD-denominated pool value reporting
 * 
 * Key Invariants:
 * - Prices must be within configured min/max bounds
 * - Data must not be stale (updatedAt within staleness threshold)
 * - Negative prices are rejected
 * - Decimals are normalized to a consistent base (e.g., 18)
 * 
 * Security Assumptions:
 * - Chainlink oracles are trusted but may fail or return stale data
 * - Circuit breaker will pause operations on oracle failure
 * - Price bounds prevent extreme manipulation or oracle errors
 */
interface IChainlinkAggregator {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}

contract OracleAdapter is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Oracle feed configuration
    struct OracleConfig {
        IChainlinkAggregator aggregator;  // Chainlink aggregator address
        uint256 stalenessThreshold;       // Max age of data in seconds
        uint256 minPrice;                 // Minimum acceptable price (scaled by oracle decimals)
        uint256 maxPrice;                 // Maximum acceptable price (scaled by oracle decimals)
        uint8 decimals;                   // Oracle decimals
        bool active;                      // Whether oracle is active
    }

    /// @notice Asset to oracle config mapping
    mapping(address => OracleConfig) public oracles;

    /// @notice Target decimals for price normalization (typically 18)
    uint8 public constant TARGET_DECIMALS = 18;

    // Events
    event OracleConfigured(
        address indexed asset,
        address indexed aggregator,
        uint256 stalenessThreshold,
        uint256 minPrice,
        uint256 maxPrice
    );
    event OracleDeactivated(address indexed asset);
    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);

    /**
     * @notice Constructor
     * @param _admin Admin address
     */
    constructor(address _admin) {
        require(_admin != address(0), "OracleAdapter: invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    // ============ Oracle Configuration ============

    /**
     * @notice Configure oracle for an asset
     * @param asset Asset address
     * @param aggregator Chainlink aggregator address
     * @param stalenessThreshold Maximum age of data in seconds (e.g., 3600 for 1 hour)
     * @param minPrice Minimum acceptable price (in oracle decimals)
     * @param maxPrice Maximum acceptable price (in oracle decimals)
     */
    function configureOracle(
        address asset,
        address aggregator,
        uint256 stalenessThreshold,
        uint256 minPrice,
        uint256 maxPrice
    ) external onlyRole(ADMIN_ROLE) {
        require(asset != address(0), "OracleAdapter: invalid asset");
        require(aggregator != address(0), "OracleAdapter: invalid aggregator");
        require(stalenessThreshold > 0, "OracleAdapter: invalid staleness");
        require(maxPrice > minPrice, "OracleAdapter: invalid price bounds");

        IChainlinkAggregator agg = IChainlinkAggregator(aggregator);
        uint8 decimals = agg.decimals();

        oracles[asset] = OracleConfig({
            aggregator: agg,
            stalenessThreshold: stalenessThreshold,
            minPrice: minPrice,
            maxPrice: maxPrice,
            decimals: decimals,
            active: true
        });

        emit OracleConfigured(asset, aggregator, stalenessThreshold, minPrice, maxPrice);
    }

    /**
     * @notice Deactivate oracle for an asset
     * @param asset Asset address
     */
    function deactivateOracle(address asset) external onlyRole(ADMIN_ROLE) {
        oracles[asset].active = false;
        emit OracleDeactivated(asset);
    }

    // ============ Price Fetching ============

    /**
     * @notice Get latest price for an asset with all safety checks
     * @param asset Asset address
     * @return price Normalized price (scaled to TARGET_DECIMALS)
     * @return updatedAt Timestamp of price update
     * 
     * Reverts if:
     * - Oracle not configured or inactive
     * - Data is stale
     * - Price is negative
     * - Price is outside min/max bounds
     */
    function getLatestPrice(address asset)
        external
        view
        returns (uint256 price, uint256 updatedAt)
    {
        OracleConfig memory config = oracles[asset];
        require(config.active, "OracleAdapter: oracle not active");

        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 timestamp,
            uint80 answeredInRound
        ) = config.aggregator.latestRoundData();

        // Validate round data
        require(answeredInRound >= roundId, "OracleAdapter: stale round");
        require(timestamp > 0, "OracleAdapter: invalid timestamp");
        require(answer > 0, "OracleAdapter: negative price");

        // Check staleness
        require(
            block.timestamp - timestamp <= config.stalenessThreshold,
            "OracleAdapter: stale data"
        );

        uint256 rawPrice = uint256(answer);

        // Check price bounds
        require(
            rawPrice >= config.minPrice && rawPrice <= config.maxPrice,
            "OracleAdapter: price out of bounds"
        );

        // Normalize decimals to TARGET_DECIMALS
        price = _normalizeDecimals(rawPrice, config.decimals, TARGET_DECIMALS);
        updatedAt = timestamp;

        return (price, updatedAt);
    }

    /**
     * @notice Get latest price without reverting on errors
     * @dev Returns (0, 0, false) if any check fails
     * @param asset Asset address
     * @return price Normalized price (0 if error)
     * @return updatedAt Timestamp (0 if error)
     * @return success Whether price fetch succeeded
     */
    function tryGetLatestPrice(address asset)
        external
        view
        returns (
            uint256 price,
            uint256 updatedAt,
            bool success
        )
    {
        OracleConfig memory config = oracles[asset];
        
        if (!config.active) {
            return (0, 0, false);
        }

        try config.aggregator.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 timestamp,
            uint80 answeredInRound
        ) {
            // Validate data
            if (answeredInRound < roundId) return (0, 0, false);
            if (timestamp == 0) return (0, 0, false);
            if (answer <= 0) return (0, 0, false);
            if (block.timestamp - timestamp > config.stalenessThreshold) return (0, 0, false);

            uint256 rawPrice = uint256(answer);
            if (rawPrice < config.minPrice || rawPrice > config.maxPrice) {
                return (0, 0, false);
            }

            price = _normalizeDecimals(rawPrice, config.decimals, TARGET_DECIMALS);
            return (price, timestamp, true);
        } catch {
            return (0, 0, false);
        }
    }

    /**
     * @notice Check if oracle data is stale
     * @param asset Asset address
     * @return isStale Whether data is stale
     */
    function isStale(address asset) external view returns (bool) {
        OracleConfig memory config = oracles[asset];
        
        if (!config.active) {
            return true;
        }

        try config.aggregator.latestRoundData() returns (
            uint80,
            int256,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            return block.timestamp - updatedAt > config.stalenessThreshold;
        } catch {
            return true;
        }
    }

    /**
     * @notice Get oracle configuration for an asset
     * @param asset Asset address
     * @return aggregator Aggregator address
     * @return stalenessThreshold Staleness threshold in seconds
     * @return minPrice Minimum price bound
     * @return maxPrice Maximum price bound
     * @return decimals Oracle decimals
     * @return active Whether oracle is active
     */
    function getOracleConfig(address asset)
        external
        view
        returns (
            address aggregator,
            uint256 stalenessThreshold,
            uint256 minPrice,
            uint256 maxPrice,
            uint8 decimals,
            bool active
        )
    {
        OracleConfig memory config = oracles[asset];
        return (
            address(config.aggregator),
            config.stalenessThreshold,
            config.minPrice,
            config.maxPrice,
            config.decimals,
            config.active
        );
    }

    // ============ Internal Helpers ============

    /**
     * @notice Normalize price from one decimal base to another
     * @dev Handles both up-scaling and down-scaling
     * @param price Original price
     * @param fromDecimals Source decimals
     * @param toDecimals Target decimals
     * @return normalized Normalized price
     */
    function _normalizeDecimals(
        uint256 price,
        uint8 fromDecimals,
        uint8 toDecimals
    ) internal pure returns (uint256 normalized) {
        if (fromDecimals == toDecimals) {
            return price;
        }

        if (fromDecimals < toDecimals) {
            // Scale up
            return price * (10 ** (toDecimals - fromDecimals));
        } else {
            // Scale down
            return price / (10 ** (fromDecimals - toDecimals));
        }
    }
}
