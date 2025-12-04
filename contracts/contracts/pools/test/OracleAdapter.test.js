const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

/**
 * OracleAdapter.sol Comprehensive Test Suite
 * 
 * Tests cover:
 * - Stale data detection and rejection
 * - Bad/out-of-range prices
 * - Decimal normalization
 * - Freshness checks
 * - Fallback oracle logic
 * - Circuit breaker integration
 */
describe('OracleAdapter Contract', function () {
  async function deployOracleAdapterFixture() {
    const [owner, operator, user1, attacker] = await ethers.getSigners();

    // Deploy mock Chainlink oracle
    const MockChainlinkOracle = await ethers.getContractFactory('MockChainlinkOracle');
    const chainlinkOracle = await MockChainlinkOracle.deploy(8); // 8 decimals like ETH/USD

    // Deploy fallback oracle
    const fallbackOracle = await MockChainlinkOracle.deploy(8);

    // Deploy OracleAdapter
    const OracleAdapter = await ethers.getContractFactory('OracleAdapter');
    const oracleAdapter = await OracleAdapter.deploy(
      await chainlinkOracle.getAddress(),
      await fallbackOracle.getAddress(),
      3600, // 1 hour staleness threshold
      ethers.parseUnits('1', 8), // Min price: $1
      ethers.parseUnits('1000000', 8) // Max price: $1M
    );

    return {
      oracleAdapter,
      chainlinkOracle,
      fallbackOracle,
      owner,
      operator,
      user1,
      attacker,
    };
  }

  describe('Deployment', function () {
    it('Should set correct oracle addresses', async function () {
      const { oracleAdapter, chainlinkOracle, fallbackOracle } = await loadFixture(
        deployOracleAdapterFixture
      );

      expect(await oracleAdapter.primaryOracle()).to.equal(await chainlinkOracle.getAddress());
      expect(await oracleAdapter.fallbackOracle()).to.equal(await fallbackOracle.getAddress());
    });

    it('Should set correct staleness threshold', async function () {
      const { oracleAdapter } = await loadFixture(deployOracleAdapterFixture);
      expect(await oracleAdapter.stalenessThreshold()).to.equal(3600);
    });

    it('Should set correct price bounds', async function () {
      const { oracleAdapter } = await loadFixture(deployOracleAdapterFixture);

      const bounds = await oracleAdapter.getPriceBounds();
      expect(bounds.minPrice).to.equal(ethers.parseUnits('1', 8));
      expect(bounds.maxPrice).to.equal(ethers.parseUnits('1000000', 8));
    });
  });

  describe('Stale Data Detection', function () {
    it('Should accept fresh data from primary oracle', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      await chainlinkOracle.setLatestRoundData(
        1, // roundId
        ethers.parseUnits('2000', 8), // price: $2000
        currentTime,
        currentTime,
        1
      );

      const price = await oracleAdapter.getLatestPrice();
      expect(price).to.equal(ethers.parseUnits('2000', 8));
    });

    it('Should reject stale data from primary oracle', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      // Set data from 2 hours ago (exceeds 1 hour threshold)
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Stale price data');
    });

    it('Should fall back to secondary oracle when primary is stale', async function () {
      const { oracleAdapter, chainlinkOracle, fallbackOracle } = await loadFixture(
        deployOracleAdapterFixture
      );

      const currentTime = await time.latest();

      // Primary oracle is stale
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      // Fallback oracle is fresh
      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1950', 8),
        currentTime,
        currentTime,
        1
      );

      const price = await oracleAdapter.getLatestPrice();
      expect(price).to.equal(ethers.parseUnits('1950', 8));
    });

    it('Should revert when both oracles are stale', async function () {
      const { oracleAdapter, chainlinkOracle, fallbackOracle } = await loadFixture(
        deployOracleAdapterFixture
      );

      const currentTime = await time.latest();

      // Both stale
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1950', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('All oracles stale');
    });

    it('Should emit OracleFallback event when using fallback', async function () {
      const { oracleAdapter, chainlinkOracle, fallbackOracle } = await loadFixture(
        deployOracleAdapterFixture
      );

      const currentTime = await time.latest();

      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1950', 8),
        currentTime,
        currentTime,
        1
      );

      await expect(oracleAdapter.getLatestPrice())
        .to.emit(oracleAdapter, 'OracleFallback')
        .withArgs(await fallbackOracle.getAddress(), ethers.parseUnits('1950', 8));
    });
  });

  describe('Bad/Out-of-Range Prices', function () {
    it('Should reject price below minimum', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      // Set price to $0.50 (below $1 minimum)
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('0.5', 8),
        currentTime,
        currentTime,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Price below minimum');
    });

    it('Should reject price above maximum', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      // Set price to $2M (above $1M maximum)
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000000', 8),
        currentTime,
        currentTime,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Price above maximum');
    });

    it('Should reject zero price', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      await chainlinkOracle.setLatestRoundData(1, 0, currentTime, currentTime, 1);

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Invalid price');
    });

    it('Should reject negative price', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      // Chainlink uses int256, so negative is possible
      await chainlinkOracle.setLatestRoundData(
        1,
        -ethers.parseUnits('100', 8),
        currentTime,
        currentTime,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Invalid price');
    });

    it('Should accept price within valid range', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      const validPrices = [
        ethers.parseUnits('1', 8), // Minimum
        ethers.parseUnits('1000', 8), // Middle
        ethers.parseUnits('1000000', 8), // Maximum
      ];

      for (const price of validPrices) {
        await chainlinkOracle.setLatestRoundData(1, price, currentTime, currentTime, 1);
        const fetchedPrice = await oracleAdapter.getLatestPrice();
        expect(fetchedPrice).to.equal(price);
      }
    });

    it('Should emit PriceOutOfBounds event', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      const invalidPrice = ethers.parseUnits('0.1', 8);

      await chainlinkOracle.setLatestRoundData(1, invalidPrice, currentTime, currentTime, 1);

      await expect(oracleAdapter.getLatestPrice())
        .to.emit(oracleAdapter, 'PriceOutOfBounds')
        .withArgs(invalidPrice, ethers.parseUnits('1', 8), ethers.parseUnits('1000000', 8));
    });
  });

  describe('Decimal Normalization', function () {
    it('Should normalize 8-decimal oracle to 18 decimals', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      // Oracle returns $2000 with 8 decimals
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime,
        currentTime,
        1
      );

      const normalizedPrice = await oracleAdapter.getLatestPriceNormalized();
      // Should return $2000 with 18 decimals
      expect(normalizedPrice).to.equal(ethers.parseUnits('2000', 18));
    });

    it('Should handle 18-decimal oracle (no normalization needed)', async function () {
      const [owner] = await ethers.getSigners();

      const MockChainlinkOracle = await ethers.getContractFactory('MockChainlinkOracle');
      const oracle18 = await MockChainlinkOracle.deploy(18);

      const OracleAdapter = await ethers.getContractFactory('OracleAdapter');
      const adapter = await OracleAdapter.deploy(
        await oracle18.getAddress(),
        ethers.ZeroAddress, // No fallback
        3600,
        ethers.parseUnits('1', 18),
        ethers.parseUnits('1000000', 18)
      );

      const currentTime = await time.latest();
      await oracle18.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 18),
        currentTime,
        currentTime,
        1
      );

      const price = await adapter.getLatestPriceNormalized();
      expect(price).to.equal(ethers.parseUnits('2000', 18));
    });

    it('Should handle 6-decimal oracle (USDC-like)', async function () {
      const [owner] = await ethers.getSigners();

      const MockChainlinkOracle = await ethers.getContractFactory('MockChainlinkOracle');
      const oracle6 = await MockChainlinkOracle.deploy(6);

      const OracleAdapter = await ethers.getContractFactory('OracleAdapter');
      const adapter = await OracleAdapter.deploy(
        await oracle6.getAddress(),
        ethers.ZeroAddress,
        3600,
        ethers.parseUnits('0.9', 6), // USDC typical range
        ethers.parseUnits('1.1', 6)
      );

      const currentTime = await time.latest();
      await oracle6.setLatestRoundData(
        1,
        ethers.parseUnits('1', 6),
        currentTime,
        currentTime,
        1
      );

      const normalizedPrice = await adapter.getLatestPriceNormalized();
      expect(normalizedPrice).to.equal(ethers.parseUnits('1', 18));
    });

    it('Should maintain precision during normalization', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      // Set precise price: $1234.56789012
      await chainlinkOracle.setLatestRoundData(
        1,
        123456789012n, // 8 decimals
        currentTime,
        currentTime,
        1
      );

      const normalized = await oracleAdapter.getLatestPriceNormalized();
      // Should be 1234.56789012 * 10^18
      expect(normalized).to.equal(123456789012n * 10n ** 10n);
    });
  });

  describe('Freshness Checks', function () {
    it('Should check updatedAt timestamp', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 1800, // 30 minutes ago
        currentTime - 1800,
        1
      );

      // Should succeed (within 1 hour threshold)
      await expect(oracleAdapter.getLatestPrice()).to.not.be.reverted;
    });

    it('Should reject if updatedAt is zero', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        0, // Invalid timestamp
        0,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Invalid timestamp');
    });

    it('Should reject if roundId is incomplete', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      await chainlinkOracle.setLatestRoundData(
        0, // Invalid round
        ethers.parseUnits('2000', 8),
        currentTime,
        currentTime,
        0
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Incomplete round');
    });

    it('Should allow custom staleness threshold', async function () {
      const [owner] = await ethers.getSigners();

      const MockChainlinkOracle = await ethers.getContractFactory('MockChainlinkOracle');
      const oracle = await MockChainlinkOracle.deploy(8);

      const OracleAdapter = await ethers.getContractFactory('OracleAdapter');
      const adapter = await OracleAdapter.deploy(
        await oracle.getAddress(),
        ethers.ZeroAddress,
        300, // 5 minute threshold
        ethers.parseUnits('1', 8),
        ethers.parseUnits('1000000', 8)
      );

      const currentTime = await time.latest();

      // 4 minutes old - should work
      await oracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 240,
        currentTime - 240,
        1
      );

      await expect(adapter.getLatestPrice()).to.not.be.reverted;

      // 6 minutes old - should fail
      await oracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 360,
        currentTime - 360,
        1
      );

      await expect(adapter.getLatestPrice()).to.be.revertedWith('Stale price data');
    });
  });

  describe('Admin Functions', function () {
    it('Should allow owner to update price bounds', async function () {
      const { oracleAdapter, owner } = await loadFixture(deployOracleAdapterFixture);

      await oracleAdapter
        .connect(owner)
        .updatePriceBounds(ethers.parseUnits('10', 8), ethers.parseUnits('500000', 8));

      const bounds = await oracleAdapter.getPriceBounds();
      expect(bounds.minPrice).to.equal(ethers.parseUnits('10', 8));
      expect(bounds.maxPrice).to.equal(ethers.parseUnits('500000', 8));
    });

    it('Should reject invalid bounds (min >= max)', async function () {
      const { oracleAdapter, owner } = await loadFixture(deployOracleAdapterFixture);

      await expect(
        oracleAdapter
          .connect(owner)
          .updatePriceBounds(ethers.parseUnits('1000', 8), ethers.parseUnits('100', 8))
      ).to.be.revertedWith('Invalid bounds');
    });

    it('Should allow owner to update staleness threshold', async function () {
      const { oracleAdapter, owner } = await loadFixture(deployOracleAdapterFixture);

      await oracleAdapter.connect(owner).updateStalenessThreshold(7200); // 2 hours

      expect(await oracleAdapter.stalenessThreshold()).to.equal(7200);
    });

    it('Should allow owner to update fallback oracle', async function () {
      const { oracleAdapter, owner } = await loadFixture(deployOracleAdapterFixture);

      const MockChainlinkOracle = await ethers.getContractFactory('MockChainlinkOracle');
      const newFallback = await MockChainlinkOracle.deploy(8);

      await oracleAdapter.connect(owner).updateFallbackOracle(await newFallback.getAddress());

      expect(await oracleAdapter.fallbackOracle()).to.equal(await newFallback.getAddress());
    });

    it('Should emit events on configuration changes', async function () {
      const { oracleAdapter, owner } = await loadFixture(deployOracleAdapterFixture);

      await expect(
        oracleAdapter
          .connect(owner)
          .updatePriceBounds(ethers.parseUnits('10', 8), ethers.parseUnits('500000', 8))
      )
        .to.emit(oracleAdapter, 'PriceBoundsUpdated')
        .withArgs(ethers.parseUnits('10', 8), ethers.parseUnits('500000', 8));
    });

    it('Should prevent non-owner from updating config', async function () {
      const { oracleAdapter, user1 } = await loadFixture(deployOracleAdapterFixture);

      await expect(
        oracleAdapter
          .connect(user1)
          .updatePriceBounds(ethers.parseUnits('10', 8), ethers.parseUnits('500000', 8))
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Circuit Breaker Integration', function () {
    it('Should trigger circuit breaker on repeated stale data', async function () {
      const { oracleAdapter, chainlinkOracle, fallbackOracle } = await loadFixture(
        deployOracleAdapterFixture
      );

      const currentTime = await time.latest();

      // Both oracles stale
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1950', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      // Multiple failures should increment failure count
      for (let i = 0; i < 3; i++) {
        await expect(oracleAdapter.getLatestPrice()).to.be.reverted;
      }

      expect(await oracleAdapter.consecutiveFailures()).to.equal(3);
    });

    it('Should reset failure count on successful price fetch', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();

      // Cause a failure
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.reverted;
      expect(await oracleAdapter.consecutiveFailures()).to.equal(1);

      // Fix the data
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime,
        currentTime,
        1
      );

      await oracleAdapter.getLatestPrice();
      expect(await oracleAdapter.consecutiveFailures()).to.equal(0);
    });

    it('Should activate emergency mode after threshold failures', async function () {
      const { oracleAdapter, chainlinkOracle, fallbackOracle, owner } = await loadFixture(
        deployOracleAdapterFixture
      );

      // Set emergency threshold to 5 failures
      await oracleAdapter.connect(owner).setEmergencyThreshold(5);

      const currentTime = await time.latest();
      await chainlinkOracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1950', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        await expect(oracleAdapter.getLatestPrice()).to.be.reverted;
      }

      expect(await oracleAdapter.emergencyMode()).to.be.true;
    });
  });

  describe('Edge Cases', function () {
    it('Should handle oracle returning max int256', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      const currentTime = await time.latest();
      const maxInt256 = 2n ** 255n - 1n;

      await chainlinkOracle.setLatestRoundData(1, maxInt256, currentTime, currentTime, 1);

      // Should reject as out of bounds
      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Price above maximum');
    });

    it('Should handle oracle call reverting', async function () {
      const { oracleAdapter, chainlinkOracle } = await loadFixture(deployOracleAdapterFixture);

      // Make oracle revert
      await chainlinkOracle.setShouldRevert(true);

      await expect(oracleAdapter.getLatestPrice()).to.be.reverted;
    });

    it('Should handle missing fallback oracle gracefully', async function () {
      const [owner] = await ethers.getSigners();

      const MockChainlinkOracle = await ethers.getContractFactory('MockChainlinkOracle');
      const oracle = await MockChainlinkOracle.deploy(8);

      const OracleAdapter = await ethers.getContractFactory('OracleAdapter');
      const adapter = await OracleAdapter.deploy(
        await oracle.getAddress(),
        ethers.ZeroAddress, // No fallback
        3600,
        ethers.parseUnits('1', 8),
        ethers.parseUnits('1000000', 8)
      );

      const currentTime = await time.latest();
      await oracle.setLatestRoundData(
        1,
        ethers.parseUnits('2000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      // Should fail without trying fallback
      await expect(adapter.getLatestPrice()).to.be.revertedWith('Stale price data');
    });
  });
});
