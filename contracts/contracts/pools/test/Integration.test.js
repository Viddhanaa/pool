const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

/**
 * Integration Tests for Pool System
 * 
 * Tests cover:
 * - Reentrancy attempts on deposit, withdraw, claim
 * - Adversarial price moves via oracle
 * - Delayed oracle updates triggering circuit breaker
 * - Full deposit -> reward -> withdraw flow
 * - Multi-user scenarios with competition
 * - Emergency scenarios
 * - Upgrade paths
 */
describe('Pool System Integration Tests', function () {
  async function deployFullSystemFixture() {
    const [owner, guardian, rewardAdmin, user1, user2, user3, attacker] =
      await ethers.getSigners();

    // Deploy base token
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const baseToken = await MockERC20.deploy('Base Token', 'BASE', ethers.parseEther('10000000'));
    const rewardToken = await MockERC20.deploy(
      'Reward Token',
      'RWD',
      ethers.parseEther('10000000')
    );

    // Deploy oracle system
    const MockChainlinkOracle = await ethers.getContractFactory('MockChainlinkOracle');
    const primaryOracle = await MockChainlinkOracle.deploy(8);
    const fallbackOracle = await MockChainlinkOracle.deploy(8);

    const OracleAdapter = await ethers.getContractFactory('OracleAdapter');
    const oracleAdapter = await OracleAdapter.deploy(
      await primaryOracle.getAddress(),
      await fallbackOracle.getAddress(),
      3600,
      ethers.parseUnits('100', 8),
      ethers.parseUnits('10000', 8)
    );

    // Set initial oracle price
    const currentTime = await time.latest();
    await primaryOracle.setLatestRoundData(
      1,
      ethers.parseUnits('1000', 8),
      currentTime,
      currentTime,
      1
    );

    // Deploy Pool
    const Pool = await ethers.getContractFactory('Pool');
    const pool = await Pool.deploy('Pool Shares', 'PS', await baseToken.getAddress());

    // Deploy RiskEngine
    const RiskEngine = await ethers.getContractFactory('RiskEngine');
    const riskEngine = await RiskEngine.deploy(await pool.getAddress());

    await riskEngine.grantRole(await riskEngine.GUARDIAN_ROLE(), guardian.address);

    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory('RewardDistributor');
    const rewardDistributor = await RewardDistributor.deploy(
      await pool.getAddress(),
      await rewardToken.getAddress()
    );

    await rewardDistributor.grantRole(
      await rewardDistributor.REWARD_ADMIN_ROLE(),
      rewardAdmin.address
    );

    // Wire everything together
    await pool.setRiskEngine(await riskEngine.getAddress());
    await pool.setRewardDistributor(await rewardDistributor.getAddress());
    await pool.setOracleAdapter(await oracleAdapter.getAddress());

    // Fund reward distributor
    await rewardToken.transfer(await rewardDistributor.getAddress(), ethers.parseEther('1000000'));

    // Setup users
    const users = [user1, user2, user3];
    for (const user of users) {
      await baseToken.transfer(user.address, ethers.parseEther('10000'));
      await baseToken.connect(user).approve(await pool.getAddress(), ethers.MaxUint256);
    }

    return {
      pool,
      riskEngine,
      rewardDistributor,
      oracleAdapter,
      baseToken,
      rewardToken,
      primaryOracle,
      fallbackOracle,
      owner,
      guardian,
      rewardAdmin,
      user1,
      user2,
      user3,
      attacker,
    };
  }

  describe('Reentrancy Protection', function () {
    it('Should prevent reentrancy on deposit', async function () {
      const { pool, user1 } = await loadFixture(deployFullSystemFixture);

      // Deploy malicious token that attempts reentrancy
      const MaliciousToken = await ethers.getContractFactory('MaliciousReentrantToken');
      const maliciousToken = await MaliciousToken.deploy(await pool.getAddress(), 'deposit');

      const Pool = await ethers.getContractFactory('Pool');
      const maliciousPool = await Pool.deploy(
        'Malicious Pool',
        'MP',
        await maliciousToken.getAddress()
      );

      await maliciousToken.mint(user1.address, ethers.parseEther('1000'));
      await maliciousToken.connect(user1).approve(await maliciousPool.getAddress(), ethers.MaxUint256);

      // Attempt reentrancy attack
      await expect(maliciousPool.connect(user1).deposit(ethers.parseEther('100'))).to.be.revertedWith(
        'ReentrancyGuard: reentrant call'
      );
    });

    it('Should prevent reentrancy on withdraw', async function () {
      const { pool, baseToken, user1 } = await loadFixture(deployFullSystemFixture);

      // Deploy malicious contract that attempts reentrancy on receive
      const MaliciousReceiver = await ethers.getContractFactory('MaliciousReceiver');
      const maliciousReceiver = await MaliciousReceiver.deploy(await pool.getAddress());

      // Send tokens to malicious contract
      await baseToken.transfer(await maliciousReceiver.getAddress(), ethers.parseEther('1000'));

      // Make deposit from malicious contract
      await baseToken.connect(user1).approve(await pool.getAddress(), ethers.MaxUint256);
      await pool.connect(user1).deposit(ethers.parseEther('100'));

      // Transfer shares to malicious contract
      await pool.connect(user1).transfer(await maliciousReceiver.getAddress(), ethers.parseEther('50'));

      // Attempt reentrancy attack via withdraw
      await expect(maliciousReceiver.attackWithdraw(ethers.parseEther('50'))).to.be.revertedWith(
        'ReentrancyGuard: reentrant call'
      );
    });

    it('Should prevent reentrancy on reward claim', async function () {
      const { pool, rewardDistributor, rewardAdmin, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));

      await time.increase(24 * 60 * 60);

      // Deploy malicious receiver
      const MaliciousRewardReceiver = await ethers.getContractFactory('MaliciousRewardReceiver');
      const maliciousReceiver = await MaliciousRewardReceiver.deploy(
        await rewardDistributor.getAddress()
      );

      // This should be protected by ReentrancyGuard
      await expect(maliciousReceiver.attackClaim()).to.be.revertedWith(
        'ReentrancyGuard: reentrant call'
      );
    });

    it('Should allow legitimate nested calls with proper guards', async function () {
      const { pool, user1, user2 } = await loadFixture(deployFullSystemFixture);

      // User1 deposits
      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // User1 can transfer and then user2 can deposit (non-reentrant nested calls)
      await pool.connect(user1).transfer(user2.address, ethers.parseEther('100'));
      await pool.connect(user2).deposit(ethers.parseEther('500'));

      expect(await pool.balanceOf(user1.address)).to.equal(ethers.parseEther('900'));
      expect(await pool.balanceOf(user2.address)).to.equal(ethers.parseEther('600'));
    });
  });

  describe('Adversarial Oracle Price Moves', function () {
    it('Should handle sudden price drop', async function () {
      const { pool, oracleAdapter, primaryOracle, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Price starts at $1000
      let currentTime = await time.latest();
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime,
        currentTime,
        1
      );

      // Sudden 50% drop
      currentTime = await time.latest();
      await primaryOracle.setLatestRoundData(
        2,
        ethers.parseUnits('500', 8),
        currentTime,
        currentTime,
        2
      );

      const price = await oracleAdapter.getLatestPrice();
      expect(price).to.equal(ethers.parseUnits('500', 8));

      // Pool operations should still work
      await expect(pool.connect(user1).withdraw(ethers.parseEther('100'))).to.not.be.reverted;
    });

    it('Should reject price below minimum threshold', async function () {
      const { oracleAdapter, primaryOracle } = await loadFixture(deployFullSystemFixture);

      // Price drops below minimum ($100)
      const currentTime = await time.latest();
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('50', 8),
        currentTime,
        currentTime,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.revertedWith('Price below minimum');
    });

    it('Should trigger circuit breaker on extreme volatility', async function () {
      const { pool, riskEngine, oracleAdapter, primaryOracle, owner, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      // Enable volatility circuit breaker
      await riskEngine.connect(owner).setVolatilityThreshold(2000); // 20% threshold

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      let currentTime = await time.latest();
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime,
        currentTime,
        1
      );

      // Price jumps 30% in one update
      await time.increase(60);
      currentTime = await time.latest();
      await primaryOracle.setLatestRoundData(
        2,
        ethers.parseUnits('1300', 8),
        currentTime,
        currentTime,
        2
      );

      // Circuit breaker should trigger
      await oracleAdapter.checkVolatility();

      expect(await riskEngine.paused()).to.be.true;
    });

    it('Should fall back to secondary oracle on manipulation', async function () {
      const { oracleAdapter, primaryOracle, fallbackOracle } = await loadFixture(
        deployFullSystemFixture
      );

      let currentTime = await time.latest();

      // Primary oracle returns suspicious price (above max)
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('20000', 8),
        currentTime,
        currentTime,
        1
      );

      // Fallback has reasonable price
      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime,
        currentTime,
        1
      );

      const price = await oracleAdapter.getLatestPrice();
      expect(price).to.equal(ethers.parseUnits('1000', 8));
    });

    it('Should handle oracle price recovery', async function () {
      const { oracleAdapter, primaryOracle, riskEngine, guardian } = await loadFixture(
        deployFullSystemFixture
      );

      let currentTime = await time.latest();

      // Bad price triggers pause
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('50', 8),
        currentTime,
        currentTime,
        1
      );

      await expect(oracleAdapter.getLatestPrice()).to.be.reverted;

      // Price recovers
      currentTime = await time.latest();
      await primaryOracle.setLatestRoundData(
        2,
        ethers.parseUnits('1000', 8),
        currentTime,
        currentTime,
        2
      );

      // Guardian can unpause after verification
      await riskEngine.connect(guardian).unpause();

      const price = await oracleAdapter.getLatestPrice();
      expect(price).to.equal(ethers.parseUnits('1000', 8));
    });
  });

  describe('Delayed Oracle Updates & Circuit Breaker', function () {
    it('Should trigger circuit breaker when oracle is stale', async function () {
      const { oracleAdapter, primaryOracle, fallbackOracle, riskEngine } = await loadFixture(
        deployFullSystemFixture
      );

      const currentTime = await time.latest();

      // Both oracles become stale (>1 hour old)
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      // Multiple failed price fetches should trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(oracleAdapter.getLatestPrice()).to.be.reverted;
      }

      // Circuit breaker activates
      expect(await riskEngine.paused()).to.be.true;
    });

    it('Should prevent deposits during oracle outage', async function () {
      const { pool, oracleAdapter, primaryOracle, fallbackOracle, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      const currentTime = await time.latest();

      // Oracles go stale
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      // Deposits should fail or pause
      await expect(pool.connect(user1).deposit(ethers.parseEther('1000'))).to.be.reverted;
    });

    it('Should allow emergency withdrawal during oracle outage', async function () {
      const { pool, primaryOracle, fallbackOracle, riskEngine, guardian, user1 } =
        await loadFixture(deployFullSystemFixture);

      // User deposits while oracle is healthy
      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      const currentTime = await time.latest();

      // Oracle becomes stale
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await fallbackOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      // Guardian pauses due to oracle failure
      await riskEngine.connect(guardian).pause();

      // Emergency withdrawal should work
      await expect(pool.connect(user1).emergencyWithdraw()).to.not.be.reverted;
    });

    it('Should resume operations after oracle recovers', async function () {
      const { pool, oracleAdapter, primaryOracle, riskEngine, guardian, user1 } =
        await loadFixture(deployFullSystemFixture);

      let currentTime = await time.latest();

      // Oracle becomes stale
      await primaryOracle.setLatestRoundData(
        1,
        ethers.parseUnits('1000', 8),
        currentTime - 7200,
        currentTime - 7200,
        1
      );

      await riskEngine.connect(guardian).pause();

      // Oracle recovers
      currentTime = await time.latest();
      await primaryOracle.setLatestRoundData(
        2,
        ethers.parseUnits('1000', 8),
        currentTime,
        currentTime,
        2
      );

      // Verify oracle is working
      await oracleAdapter.getLatestPrice();

      // Guardian unpauses
      await riskEngine.connect(guardian).unpause();

      // Operations should resume
      await expect(pool.connect(user1).deposit(ethers.parseEther('500'))).to.not.be.reverted;
    });
  });

  describe('Full User Journey', function () {
    it('Should handle complete deposit -> earn -> claim -> withdraw flow', async function () {
      const {
        pool,
        rewardDistributor,
        rewardToken,
        baseToken,
        rewardAdmin,
        user1,
      } = await loadFixture(deployFullSystemFixture);

      const initialBalance = await baseToken.balanceOf(user1.address);

      // 1. Deposit
      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      expect(await pool.balanceOf(user1.address)).to.equal(ethers.parseEther('1000'));

      // 2. Start earning rewards
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));

      // 3. Wait 1 day
      await time.increase(24 * 60 * 60);

      // 4. Check and claim rewards
      const pending = await rewardDistributor.pendingRewards(user1.address);
      expect(pending).to.be.closeTo(ethers.parseEther('100'), ethers.parseEther('1'));

      const rewardBalanceBefore = await rewardToken.balanceOf(user1.address);
      await rewardDistributor.connect(user1).claimRewards();
      const rewardBalanceAfter = await rewardToken.balanceOf(user1.address);

      expect(rewardBalanceAfter - rewardBalanceBefore).to.be.closeTo(
        ethers.parseEther('100'),
        ethers.parseEther('1')
      );

      // 5. Withdraw partial
      await pool.connect(user1).withdraw(ethers.parseEther('500'));
      expect(await pool.balanceOf(user1.address)).to.equal(ethers.parseEther('500'));

      // 6. Wait another day and earn more rewards
      await time.increase(24 * 60 * 60);

      // 7. Withdraw remaining + claim final rewards
      await rewardDistributor.connect(user1).claimRewards();
      await pool.connect(user1).withdraw(ethers.parseEther('500'));

      // User should have recovered most of initial deposit (minus any fees)
      const finalBalance = await baseToken.balanceOf(user1.address);
      expect(finalBalance).to.be.closeTo(initialBalance, ethers.parseEther('10'));
    });

    it('Should handle multiple users competing for rewards', async function () {
      const { pool, rewardDistributor, rewardAdmin, user1, user2, user3 } = await loadFixture(
        deployFullSystemFixture
      );

      // Users deposit different amounts
      await pool.connect(user1).deposit(ethers.parseEther('1000')); // 50%
      await pool.connect(user2).deposit(ethers.parseEther('600')); // 30%
      await pool.connect(user3).deposit(ethers.parseEther('400')); // 20%

      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('200'));

      await time.increase(24 * 60 * 60);

      // Check reward distribution
      const pending1 = await rewardDistributor.pendingRewards(user1.address);
      const pending2 = await rewardDistributor.pendingRewards(user2.address);
      const pending3 = await rewardDistributor.pendingRewards(user3.address);

      expect(pending1).to.be.closeTo(ethers.parseEther('100'), ethers.parseEther('2')); // 50%
      expect(pending2).to.be.closeTo(ethers.parseEther('60'), ethers.parseEther('2')); // 30%
      expect(pending3).to.be.closeTo(ethers.parseEther('40'), ethers.parseEther('2')); // 20%
    });

    it('Should maintain correct exchange rate with yield', async function () {
      const { pool, baseToken, user1, user2 } = await loadFixture(deployFullSystemFixture);

      // User1 deposits
      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Simulate yield (extra tokens sent to pool)
      await baseToken.transfer(await pool.getAddress(), ethers.parseEther('500'));

      // Exchange rate should be 1.5 (1500 tokens / 1000 shares)
      const rate = await pool.exchangeRate();
      expect(rate).to.be.closeTo(ethers.parseEther('1.5'), ethers.parseEther('0.01'));

      // User2 deposits at new rate
      await pool.connect(user2).deposit(ethers.parseEther('1500'));

      // User2 should get 1000 shares (1500 / 1.5)
      expect(await pool.balanceOf(user2.address)).to.be.closeTo(
        ethers.parseEther('1000'),
        ethers.parseEther('1')
      );

      // User1 withdraws and should get more than deposited
      const balanceBefore = await baseToken.balanceOf(user1.address);
      await pool.connect(user1).withdraw(ethers.parseEther('1000'));
      const balanceAfter = await baseToken.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.be.closeTo(
        ethers.parseEther('1500'),
        ethers.parseEther('10')
      );
    });
  });

  describe('Emergency Scenarios', function () {
    it('Should handle mass withdrawal attempt (bank run)', async function () {
      const { pool, riskEngine, owner, user1, user2, user3 } = await loadFixture(
        deployFullSystemFixture
      );

      // Set daily withdrawal cap
      await riskEngine.connect(owner).setDailyWithdrawalCap(ethers.parseEther('2000'));

      // Users deposit
      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await pool.connect(user2).deposit(ethers.parseEther('1000'));
      await pool.connect(user3).deposit(ethers.parseEther('1000'));

      // All try to withdraw at once
      await pool.connect(user1).withdraw(ethers.parseEther('1000'));
      await pool.connect(user2).withdraw(ethers.parseEther('1000'));

      // User3 is blocked by daily cap
      await expect(pool.connect(user3).withdraw(ethers.parseEther('1000'))).to.be.revertedWith(
        'Daily withdrawal cap exceeded'
      );

      // After 24 hours, user3 can withdraw
      await time.increase(24 * 60 * 60 + 1);
      await expect(pool.connect(user3).withdraw(ethers.parseEther('1000'))).to.not.be.reverted;
    });

    it('Should handle complete system pause and recovery', async function () {
      const { pool, riskEngine, rewardDistributor, guardian, user1 } = await loadFixture(
        deployFullSystemFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Emergency pause
      await riskEngine.connect(guardian).pause();

      // All operations blocked
      await expect(pool.connect(user1).deposit(ethers.parseEther('100'))).to.be.reverted;
      await expect(pool.connect(user1).withdraw(ethers.parseEther('100'))).to.be.reverted;
      await expect(rewardDistributor.connect(user1).claimRewards()).to.be.reverted;

      // Emergency withdrawal works
      await expect(pool.connect(user1).emergencyWithdraw()).to.not.be.reverted;

      // System recovery
      await riskEngine.connect(guardian).unpause();

      // Operations resume
      await expect(pool.connect(user1).deposit(ethers.parseEther('100'))).to.not.be.reverted;
    });
  });

  describe('Gas Optimization & Scalability', function () {
    it('Should handle many users efficiently', async function () {
      const { pool } = await loadFixture(deployFullSystemFixture);

      const signers = await ethers.getSigners();
      const numUsers = Math.min(20, signers.length);

      // Multiple users deposit
      for (let i = 0; i < numUsers; i++) {
        const tx = await pool.connect(signers[i]).deposit(ethers.parseEther('100'));
        const receipt = await tx.wait();
        
        // Gas should be reasonable and consistent
        expect(receipt.gasUsed).to.be.lt(500000);
      }
    });

    it('Should maintain performance with many epochs', async function () {
      const { rewardDistributor, rewardAdmin } = await loadFixture(deployFullSystemFixture);

      // Create many epochs
      for (let i = 0; i < 10; i++) {
        await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));
        await time.increase(24 * 60 * 60);
      }

      // Claiming should still be efficient (O(1) not O(n))
      const tx = await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));
      const receipt = await tx.wait();
      
      expect(receipt.gasUsed).to.be.lt(300000);
    });
  });
});

const anyValue = require('@nomicfoundation/hardhat-chai-matchers').anyValue;
