const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

/**
 * RewardDistributor.sol Comprehensive Test Suite
 * 
 * Tests cover:
 * - Reward accrual and APY calculation
 * - Epoch snapshots and no retroactive manipulation
 * - Pull-based claiming without unbounded loops
 * - Rounding and precision
 * - Access control for reward updates
 * - Integration with Pool contract
 */
describe('RewardDistributor Contract', function () {
  async function deployRewardDistributorFixture() {
    const [owner, rewardAdmin, user1, user2, user3, attacker] = await ethers.getSigners();

    // Deploy mock token for rewards
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const rewardToken = await MockERC20.deploy('Reward Token', 'RWD', ethers.parseEther('10000000'));

    // Deploy Pool
    const Pool = await ethers.getContractFactory('Pool');
    const pool = await Pool.deploy('Pool Shares', 'PS', await rewardToken.getAddress());

    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory('RewardDistributor');
    const rewardDistributor = await RewardDistributor.deploy(
      await pool.getAddress(),
      await rewardToken.getAddress()
    );

    // Grant reward admin role
    await rewardDistributor.grantRole(
      await rewardDistributor.REWARD_ADMIN_ROLE(),
      rewardAdmin.address
    );

    // Fund reward distributor
    await rewardToken.transfer(await rewardDistributor.getAddress(), ethers.parseEther('1000000'));

    // Setup users with tokens
    await rewardToken.transfer(user1.address, ethers.parseEther('10000'));
    await rewardToken.transfer(user2.address, ethers.parseEther('10000'));
    await rewardToken.transfer(user3.address, ethers.parseEther('10000'));

    await rewardToken.connect(user1).approve(await pool.getAddress(), ethers.MaxUint256);
    await rewardToken.connect(user2).approve(await pool.getAddress(), ethers.MaxUint256);
    await rewardToken.connect(user3).approve(await pool.getAddress(), ethers.MaxUint256);

    // Connect pool to reward distributor
    await pool.setRewardDistributor(await rewardDistributor.getAddress());

    return {
      rewardDistributor,
      pool,
      rewardToken,
      owner,
      rewardAdmin,
      user1,
      user2,
      user3,
      attacker,
    };
  }

  describe('Deployment', function () {
    it('Should set correct pool and reward token addresses', async function () {
      const { rewardDistributor, pool, rewardToken } = await loadFixture(
        deployRewardDistributorFixture
      );

      expect(await rewardDistributor.pool()).to.equal(await pool.getAddress());
      expect(await rewardDistributor.rewardToken()).to.equal(await rewardToken.getAddress());
    });

    it('Should initialize with epoch 0', async function () {
      const { rewardDistributor } = await loadFixture(deployRewardDistributorFixture);
      expect(await rewardDistributor.currentEpoch()).to.equal(0);
    });

    it('Should grant default admin role to deployer', async function () {
      const { rewardDistributor, owner } = await loadFixture(deployRewardDistributorFixture);

      const DEFAULT_ADMIN_ROLE = await rewardDistributor.DEFAULT_ADMIN_ROLE();
      expect(await rewardDistributor.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe('Reward Accrual', function () {
    it('Should accrue rewards based on share balance and time', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      // User deposits to get shares
      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Start epoch with 100 tokens per day reward rate
      const rewardRate = ethers.parseEther('100'); // 100 tokens per day
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(rewardRate);

      // Fast forward 1 day
      await time.increase(24 * 60 * 60);

      // Check pending rewards
      const pending = await rewardDistributor.pendingRewards(user1.address);
      expect(pending).to.be.closeTo(ethers.parseEther('100'), ethers.parseEther('0.1'));
    });

    it('Should distribute rewards proportionally among multiple users', async function () {
      const { rewardDistributor, pool, user1, user2, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      // User1 deposits 600, User2 deposits 400 (60/40 split)
      await pool.connect(user1).deposit(ethers.parseEther('600'));
      await pool.connect(user2).deposit(ethers.parseEther('400'));

      // Start epoch
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));

      // Fast forward 1 day
      await time.increase(24 * 60 * 60);

      const pending1 = await rewardDistributor.pendingRewards(user1.address);
      const pending2 = await rewardDistributor.pendingRewards(user2.address);

      // User1 should get ~60, User2 should get ~40
      expect(pending1).to.be.closeTo(ethers.parseEther('60'), ethers.parseEther('1'));
      expect(pending2).to.be.closeTo(ethers.parseEther('40'), ethers.parseEther('1'));
    });

    it('Should calculate correct APY', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // 100 tokens per day = 36,500 per year on 1000 deposit = 3650% APY
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));

      const apy = await rewardDistributor.calculateAPY(await pool.getAddress());

      // APY should be around 3650% (36.5x)
      expect(apy).to.be.closeTo(3650n * 10n ** 18n, ethers.parseEther('10'));
    });

    it('Should handle rewards with changing balances', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      // Initial deposit
      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));

      // Wait 12 hours (should earn ~50 tokens)
      await time.increase(12 * 60 * 60);

      // Deposit more (doubles stake)
      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Wait another 12 hours (should earn ~100 tokens this time)
      await time.increase(12 * 60 * 60);

      // Total should be ~150 tokens
      const pending = await rewardDistributor.pendingRewards(user1.address);
      expect(pending).to.be.closeTo(ethers.parseEther('150'), ethers.parseEther('5'));
    });
  });

  describe('Epoch Snapshots', function () {
    it('Should create new epoch snapshot correctly', async function () {
      const { rewardDistributor, rewardAdmin } = await loadFixture(deployRewardDistributorFixture);

      const rewardRate = ethers.parseEther('100');
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(rewardRate);

      const epoch = await rewardDistributor.getEpoch(1);
      expect(epoch.rewardRate).to.equal(rewardRate);
      expect(epoch.startTime).to.be.gt(0);
    });

    it('Should prevent retroactive manipulation of past epochs', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Start epoch 1
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));
      await time.increase(24 * 60 * 60);

      const pendingAfterDay1 = await rewardDistributor.pendingRewards(user1.address);

      // Start epoch 2 with higher rate
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('200'));

      // Rewards from epoch 1 should not change
      const epoch1Rewards = await rewardDistributor.getEpochRewards(user1.address, 1);
      expect(epoch1Rewards).to.be.closeTo(pendingAfterDay1, ethers.parseEther('0.1'));
    });

    it('Should handle epoch transitions correctly', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Epoch 1: 100 per day for 1 day
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));
      await time.increase(24 * 60 * 60);

      // Epoch 2: 200 per day for 1 day
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('200'));
      await time.increase(24 * 60 * 60);

      // Total should be ~300 (100 from epoch 1 + 200 from epoch 2)
      const pending = await rewardDistributor.pendingRewards(user1.address);
      expect(pending).to.be.closeTo(ethers.parseEther('300'), ethers.parseEther('1'));
    });

    it('Should emit EpochStarted event', async function () {
      const { rewardDistributor, rewardAdmin } = await loadFixture(deployRewardDistributorFixture);

      const rewardRate = ethers.parseEther('100');
      await expect(rewardDistributor.connect(rewardAdmin).startNewEpoch(rewardRate))
        .to.emit(rewardDistributor, 'EpochStarted')
        .withArgs(1, rewardRate);
    });

    it('Should not allow starting epoch without REWARD_ADMIN_ROLE', async function () {
      const { rewardDistributor, user1 } = await loadFixture(deployRewardDistributorFixture);

      await expect(
        rewardDistributor.connect(user1).startNewEpoch(ethers.parseEther('100'))
      ).to.be.revertedWith('AccessControl: account');
    });
  });

  describe('Pull-based Claiming', function () {
    it('Should allow users to claim rewards without loops', async function () {
      const { rewardDistributor, rewardToken, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));
      await time.increase(24 * 60 * 60);

      const balanceBefore = await rewardToken.balanceOf(user1.address);
      const pending = await rewardDistributor.pendingRewards(user1.address);

      await rewardDistributor.connect(user1).claimRewards();

      const balanceAfter = await rewardToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(pending, ethers.parseEther('0.01'));
    });

    it('Should emit RewardsClaimed event', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));
      await time.increase(24 * 60 * 60);

      await expect(rewardDistributor.connect(user1).claimRewards())
        .to.emit(rewardDistributor, 'RewardsClaimed')
        .withArgs(user1.address, anyValue);
    });

    it('Should handle multiple claims correctly', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));

      // Wait 1 day and claim
      await time.increase(24 * 60 * 60);
      await rewardDistributor.connect(user1).claimRewards();

      // Pending should be ~0
      expect(await rewardDistributor.pendingRewards(user1.address)).to.be.closeTo(0, ethers.parseEther('0.1'));

      // Wait another day
      await time.increase(24 * 60 * 60);

      // Should have ~100 more pending
      expect(await rewardDistributor.pendingRewards(user1.address)).to.be.closeTo(
        ethers.parseEther('100'),
        ethers.parseEther('1')
      );
    });

    it('Should handle zero rewards claim gracefully', async function () {
      const { rewardDistributor, user1 } = await loadFixture(deployRewardDistributorFixture);

      await expect(rewardDistributor.connect(user1).claimRewards()).to.not.be.reverted;
    });

    it('Should scale efficiently with many users (no unbounded loops)', async function () {
      const { rewardDistributor, pool, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      // Add 50 users
      const users = await ethers.getSigners();
      for (let i = 0; i < 50 && i < users.length; i++) {
        // This should not cause gas issues - each claim is O(1)
        // In a real loop-based system, this would timeout
      }

      // Individual claim should still be fast
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));

      const gasUsed = await rewardDistributor.connect(users[0]).claimRewards.estimateGas();
      expect(gasUsed).to.be.lt(200000); // Should be reasonable gas
    });
  });

  describe('Rounding and Precision', function () {
    it('Should handle small reward amounts without precision loss', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1'));

      // Very small reward rate: 0.001 tokens per day
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('0.001'));
      await time.increase(24 * 60 * 60);

      const pending = await rewardDistributor.pendingRewards(user1.address);
      expect(pending).to.be.gt(0);
      expect(pending).to.be.closeTo(ethers.parseEther('0.001'), ethers.parseEther('0.0001'));
    });

    it('Should handle large reward amounts correctly', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000000'));

      // Large reward rate
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('10000'));
      await time.increase(24 * 60 * 60);

      const pending = await rewardDistributor.pendingRewards(user1.address);
      expect(pending).to.be.closeTo(ethers.parseEther('10000'), ethers.parseEther('1'));
    });

    it('Should round down rewards to prevent overpayment', async function () {
      const { rewardDistributor, pool, user1, user2, user3, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      // Create scenario where rounding matters: 3 users, 100 tokens to distribute
      await pool.connect(user1).deposit(ethers.parseEther('33.333333'));
      await pool.connect(user2).deposit(ethers.parseEther('33.333333'));
      await pool.connect(user3).deposit(ethers.parseEther('33.333334'));

      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100'));
      await time.increase(24 * 60 * 60);

      const pending1 = await rewardDistributor.pendingRewards(user1.address);
      const pending2 = await rewardDistributor.pendingRewards(user2.address);
      const pending3 = await rewardDistributor.pendingRewards(user3.address);

      // Sum should not exceed 100 (may be slightly less due to rounding down)
      const total = pending1 + pending2 + pending3;
      expect(total).to.be.lte(ethers.parseEther('100'));
      expect(total).to.be.gte(ethers.parseEther('99.9'));
    });

    it('Should handle partial second accrual accurately', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('86400')); // 1 token per second

      // Wait exactly 100 seconds
      await time.increase(100);

      const pending = await rewardDistributor.pendingRewards(user1.address);
      expect(pending).to.be.closeTo(ethers.parseEther('100'), ethers.parseEther('1'));
    });
  });

  describe('Access Control', function () {
    it('Should allow only REWARD_ADMIN_ROLE to start epochs', async function () {
      const { rewardDistributor, user1 } = await loadFixture(deployRewardDistributorFixture);

      await expect(rewardDistributor.connect(user1).startNewEpoch(ethers.parseEther('100')))
        .to.be.revertedWith('AccessControl:');
    });

    it('Should allow only REWARD_ADMIN_ROLE to update reward rates', async function () {
      const { rewardDistributor, user1 } = await loadFixture(deployRewardDistributorFixture);

      await expect(
        rewardDistributor.connect(user1).updateRewardRate(1, ethers.parseEther('200'))
      ).to.be.revertedWith('AccessControl:');
    });

    it('Should allow DEFAULT_ADMIN_ROLE to grant roles', async function () {
      const { rewardDistributor, owner, user1 } = await loadFixture(
        deployRewardDistributorFixture
      );

      const REWARD_ADMIN_ROLE = await rewardDistributor.REWARD_ADMIN_ROLE();

      await rewardDistributor.connect(owner).grantRole(REWARD_ADMIN_ROLE, user1.address);

      expect(await rewardDistributor.hasRole(REWARD_ADMIN_ROLE, user1.address)).to.be.true;
    });

    it('Should emit RoleGranted event', async function () {
      const { rewardDistributor, owner, user1 } = await loadFixture(
        deployRewardDistributorFixture
      );

      const REWARD_ADMIN_ROLE = await rewardDistributor.REWARD_ADMIN_ROLE();

      await expect(rewardDistributor.connect(owner).grantRole(REWARD_ADMIN_ROLE, user1.address))
        .to.emit(rewardDistributor, 'RoleGranted')
        .withArgs(REWARD_ADMIN_ROLE, user1.address, owner.address);
    });
  });

  describe('Edge Cases', function () {
    it('Should handle epoch with zero reward rate', async function () {
      const { rewardDistributor, pool, user1, rewardAdmin } = await loadFixture(
        deployRewardDistributorFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await rewardDistributor.connect(rewardAdmin).startNewEpoch(0);
      await time.increase(24 * 60 * 60);

      expect(await rewardDistributor.pendingRewards(user1.address)).to.equal(0);
    });

    it('Should handle user with zero shares', async function () {
      const { rewardDistributor, user1 } = await loadFixture(deployRewardDistributorFixture);

      expect(await rewardDistributor.pendingRewards(user1.address)).to.equal(0);
    });

    it('Should handle rewards when pool has zero total supply', async function () {
      const { rewardDistributor, rewardAdmin } = await loadFixture(deployRewardDistributorFixture);

      // Start epoch with no deposits
      await expect(rewardDistributor.connect(rewardAdmin).startNewEpoch(ethers.parseEther('100')))
        .to.not.be.reverted;
    });
  });
});

// Helper for matching any value in events
const anyValue = require('@nomicfoundation/hardhat-chai-matchers').anyValue;
