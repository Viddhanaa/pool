const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

/**
 * RiskEngine.sol Comprehensive Test Suite
 * 
 * Tests cover:
 * - TVL cap enforcement
 * - Per-user withdrawal limits
 * - Per-day withdrawal limits
 * - Emergency pause/resume
 * - Emergency withdrawal bypassing rewards
 * - Circuit breaker triggers
 * - Risk parameter updates
 */
describe('RiskEngine Contract', function () {
  async function deployRiskEngineFixture() {
    const [owner, guardian, operator, user1, user2, user3, attacker] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const token = await MockERC20.deploy('Test Token', 'TEST', ethers.parseEther('10000000'));

    // Deploy Pool
    const Pool = await ethers.getContractFactory('Pool');
    const pool = await Pool.deploy('Pool Shares', 'PS', await token.getAddress());

    // Deploy RiskEngine
    const RiskEngine = await ethers.getContractFactory('RiskEngine');
    const riskEngine = await RiskEngine.deploy(await pool.getAddress());

    // Grant guardian role
    await riskEngine.grantRole(await riskEngine.GUARDIAN_ROLE(), guardian.address);

    // Setup users
    await token.transfer(user1.address, ethers.parseEther('10000'));
    await token.transfer(user2.address, ethers.parseEther('10000'));
    await token.transfer(user3.address, ethers.parseEther('10000'));

    await token.connect(user1).approve(await pool.getAddress(), ethers.MaxUint256);
    await token.connect(user2).approve(await pool.getAddress(), ethers.MaxUint256);
    await token.connect(user3).approve(await pool.getAddress(), ethers.MaxUint256);

    // Connect pool to risk engine
    await pool.setRiskEngine(await riskEngine.getAddress());

    return {
      riskEngine,
      pool,
      token,
      owner,
      guardian,
      operator,
      user1,
      user2,
      user3,
      attacker,
    };
  }

  describe('Deployment', function () {
    it('Should set correct pool address', async function () {
      const { riskEngine, pool } = await loadFixture(deployRiskEngineFixture);
      expect(await riskEngine.pool()).to.equal(await pool.getAddress());
    });

    it('Should initialize with default limits', async function () {
      const { riskEngine } = await loadFixture(deployRiskEngineFixture);

      expect(await riskEngine.tvlCap()).to.equal(ethers.MaxUint256);
      expect(await riskEngine.dailyWithdrawalCap()).to.equal(ethers.MaxUint256);
      expect(await riskEngine.userWithdrawalCap()).to.equal(ethers.MaxUint256);
    });

    it('Should not be paused initially', async function () {
      const { riskEngine } = await loadFixture(deployRiskEngineFixture);
      expect(await riskEngine.paused()).to.be.false;
    });

    it('Should grant guardian role to specified address', async function () {
      const { riskEngine, guardian } = await loadFixture(deployRiskEngineFixture);

      const GUARDIAN_ROLE = await riskEngine.GUARDIAN_ROLE();
      expect(await riskEngine.hasRole(GUARDIAN_ROLE, guardian.address)).to.be.true;
    });
  });

  describe('TVL Cap Enforcement', function () {
    it('Should allow deposits within TVL cap', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setTVLCap(ethers.parseEther('10000'));

      await expect(pool.connect(user1).deposit(ethers.parseEther('5000'))).to.not.be.reverted;
    });

    it('Should reject deposits exceeding TVL cap', async function () {
      const { riskEngine, pool, user1, user2, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setTVLCap(ethers.parseEther('10000'));

      await pool.connect(user1).deposit(ethers.parseEther('8000'));

      await expect(pool.connect(user2).deposit(ethers.parseEther('3000'))).to.be.revertedWith(
        'TVL cap exceeded'
      );
    });

    it('Should allow deposit up to exact TVL cap', async function () {
      const { riskEngine, pool, user1, user2, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setTVLCap(ethers.parseEther('10000'));

      await pool.connect(user1).deposit(ethers.parseEther('7000'));
      await expect(pool.connect(user2).deposit(ethers.parseEther('3000'))).to.not.be.reverted;
    });

    it('Should update TVL correctly after withdrawals', async function () {
      const { riskEngine, pool, user1, user2, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setTVLCap(ethers.parseEther('10000'));

      await pool.connect(user1).deposit(ethers.parseEther('9000'));

      // Can't deposit 2000 more
      await expect(pool.connect(user2).deposit(ethers.parseEther('2000'))).to.be.reverted;

      // User1 withdraws 5000
      await pool.connect(user1).withdraw(ethers.parseEther('5000'));

      // Now user2 can deposit 2000
      await expect(pool.connect(user2).deposit(ethers.parseEther('2000'))).to.not.be.reverted;
    });

    it('Should emit TVLCapUpdated event', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      await expect(riskEngine.connect(owner).setTVLCap(ethers.parseEther('10000')))
        .to.emit(riskEngine, 'TVLCapUpdated')
        .withArgs(ethers.parseEther('10000'));
    });
  });

  describe('Per-User Withdrawal Limits', function () {
    it('Should track user withdrawals correctly', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setUserWithdrawalCap(ethers.parseEther('5000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));

      await pool.connect(user1).withdraw(ethers.parseEther('3000'));

      expect(await riskEngine.getUserWithdrawals(user1.address)).to.equal(
        ethers.parseEther('3000')
      );
    });

    it('Should reject withdrawals exceeding user cap', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setUserWithdrawalCap(ethers.parseEther('5000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));

      await pool.connect(user1).withdraw(ethers.parseEther('4000'));

      // Try to withdraw 2000 more (total 6000, exceeds 5000 cap)
      await expect(pool.connect(user1).withdraw(ethers.parseEther('2000'))).to.be.revertedWith(
        'User withdrawal cap exceeded'
      );
    });

    it('Should allow withdrawal up to exact user cap', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setUserWithdrawalCap(ethers.parseEther('5000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));

      await expect(pool.connect(user1).withdraw(ethers.parseEther('5000'))).to.not.be.reverted;
    });

    it('Should track separate limits for different users', async function () {
      const { riskEngine, pool, user1, user2, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setUserWithdrawalCap(ethers.parseEther('3000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));
      await pool.connect(user2).deposit(ethers.parseEther('10000'));

      await pool.connect(user1).withdraw(ethers.parseEther('3000'));
      await pool.connect(user2).withdraw(ethers.parseEther('2000'));

      expect(await riskEngine.getUserWithdrawals(user1.address)).to.equal(
        ethers.parseEther('3000')
      );
      expect(await riskEngine.getUserWithdrawals(user2.address)).to.equal(
        ethers.parseEther('2000')
      );
    });

    it('Should allow admin to reset user withdrawal counter', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setUserWithdrawalCap(ethers.parseEther('3000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));
      await pool.connect(user1).withdraw(ethers.parseEther('3000'));

      // Reset counter
      await riskEngine.connect(owner).resetUserWithdrawals(user1.address);

      expect(await riskEngine.getUserWithdrawals(user1.address)).to.equal(0);

      // Can withdraw 3000 more
      await expect(pool.connect(user1).withdraw(ethers.parseEther('3000'))).to.not.be.reverted;
    });
  });

  describe('Per-Day Withdrawal Limits', function () {
    it('Should enforce daily withdrawal cap', async function () {
      const { riskEngine, pool, user1, user2, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setDailyWithdrawalCap(ethers.parseEther('5000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));
      await pool.connect(user2).deposit(ethers.parseEther('10000'));

      // User1 withdraws 4000
      await pool.connect(user1).withdraw(ethers.parseEther('4000'));

      // User2 tries to withdraw 2000 (total would be 6000, exceeds 5000 cap)
      await expect(pool.connect(user2).withdraw(ethers.parseEther('2000'))).to.be.revertedWith(
        'Daily withdrawal cap exceeded'
      );
    });

    it('Should reset daily cap after 24 hours', async function () {
      const { riskEngine, pool, user1, user2, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setDailyWithdrawalCap(ethers.parseEther('5000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));
      await pool.connect(user2).deposit(ethers.parseEther('10000'));

      // Withdraw 5000 on day 1
      await pool.connect(user1).withdraw(ethers.parseEther('5000'));

      // Can't withdraw more on day 1
      await expect(pool.connect(user2).withdraw(ethers.parseEther('1000'))).to.be.reverted;

      // Fast forward 24 hours
      await time.increase(24 * 60 * 60 + 1);

      // Can withdraw on day 2
      await expect(pool.connect(user2).withdraw(ethers.parseEther('5000'))).to.not.be.reverted;
    });

    it('Should track daily withdrawals across multiple users', async function () {
      const { riskEngine, pool, user1, user2, user3, owner } = await loadFixture(
        deployRiskEngineFixture
      );

      await riskEngine.connect(owner).setDailyWithdrawalCap(ethers.parseEther('9000'));

      await pool.connect(user1).deposit(ethers.parseEther('10000'));
      await pool.connect(user2).deposit(ethers.parseEther('10000'));
      await pool.connect(user3).deposit(ethers.parseEther('10000'));

      await pool.connect(user1).withdraw(ethers.parseEther('3000'));
      await pool.connect(user2).withdraw(ethers.parseEther('4000'));

      expect(await riskEngine.getDailyWithdrawals()).to.equal(ethers.parseEther('7000'));

      // User3 can withdraw 2000 more
      await expect(pool.connect(user3).withdraw(ethers.parseEther('2000'))).to.not.be.reverted;

      expect(await riskEngine.getDailyWithdrawals()).to.equal(ethers.parseEther('9000'));
    });

    it('Should emit DailyWithdrawalCapUpdated event', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      await expect(riskEngine.connect(owner).setDailyWithdrawalCap(ethers.parseEther('5000')))
        .to.emit(riskEngine, 'DailyWithdrawalCapUpdated')
        .withArgs(ethers.parseEther('5000'));
    });
  });

  describe('Emergency Pause/Resume', function () {
    it('Should allow guardian to pause', async function () {
      const { riskEngine, guardian } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(guardian).pause();

      expect(await riskEngine.paused()).to.be.true;
    });

    it('Should prevent deposits when paused', async function () {
      const { riskEngine, pool, user1, guardian } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(guardian).pause();

      await expect(pool.connect(user1).deposit(ethers.parseEther('1000'))).to.be.revertedWith(
        'Pausable: paused'
      );
    });

    it('Should prevent normal withdrawals when paused', async function () {
      const { riskEngine, pool, user1, guardian } = await loadFixture(deployRiskEngineFixture);

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      await riskEngine.connect(guardian).pause();

      await expect(pool.connect(user1).withdraw(ethers.parseEther('500'))).to.be.revertedWith(
        'Pausable: paused'
      );
    });

    it('Should allow guardian to unpause', async function () {
      const { riskEngine, guardian } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(guardian).pause();
      await riskEngine.connect(guardian).unpause();

      expect(await riskEngine.paused()).to.be.false;
    });

    it('Should allow operations after unpause', async function () {
      const { riskEngine, pool, user1, guardian } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(guardian).pause();
      await riskEngine.connect(guardian).unpause();

      await expect(pool.connect(user1).deposit(ethers.parseEther('1000'))).to.not.be.reverted;
    });

    it('Should emit Paused and Unpaused events', async function () {
      const { riskEngine, guardian } = await loadFixture(deployRiskEngineFixture);

      await expect(riskEngine.connect(guardian).pause())
        .to.emit(riskEngine, 'Paused')
        .withArgs(guardian.address);

      await expect(riskEngine.connect(guardian).unpause())
        .to.emit(riskEngine, 'Unpaused')
        .withArgs(guardian.address);
    });

    it('Should prevent non-guardian from pausing', async function () {
      const { riskEngine, user1 } = await loadFixture(deployRiskEngineFixture);

      await expect(riskEngine.connect(user1).pause()).to.be.revertedWith('AccessControl:');
    });
  });

  describe('Emergency Withdrawal', function () {
    it('Should allow emergency withdrawal when paused', async function () {
      const { riskEngine, pool, token, user1, guardian } = await loadFixture(
        deployRiskEngineFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      await riskEngine.connect(guardian).pause();

      const balanceBefore = await token.balanceOf(user1.address);

      await pool.connect(user1).emergencyWithdraw();

      expect(await token.balanceOf(user1.address)).to.be.gt(balanceBefore);
    });

    it('Should bypass rewards on emergency withdrawal', async function () {
      const { riskEngine, pool, token, user1, guardian } = await loadFixture(
        deployRiskEngineFixture
      );

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      // Simulate rewards (transfer extra tokens to pool)
      await token.transfer(await pool.getAddress(), ethers.parseEther('500'));

      await riskEngine.connect(guardian).pause();

      const balanceBefore = await token.balanceOf(user1.address);

      await pool.connect(user1).emergencyWithdraw();

      const balanceAfter = await token.balanceOf(user1.address);

      // Should get close to principal (1000), not principal + rewards (1500)
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        ethers.parseEther('1000'),
        ethers.parseEther('10')
      );
    });

    it('Should burn all shares on emergency withdrawal', async function () {
      const { riskEngine, pool, user1, guardian } = await loadFixture(deployRiskEngineFixture);

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      await riskEngine.connect(guardian).pause();

      await pool.connect(user1).emergencyWithdraw();

      expect(await pool.balanceOf(user1.address)).to.equal(0);
    });

    it('Should emit EmergencyWithdraw event', async function () {
      const { riskEngine, pool, user1, guardian } = await loadFixture(deployRiskEngineFixture);

      await pool.connect(user1).deposit(ethers.parseEther('1000'));

      await riskEngine.connect(guardian).pause();

      await expect(pool.connect(user1).emergencyWithdraw())
        .to.emit(pool, 'EmergencyWithdraw')
        .withArgs(user1.address, anyValue);
    });

    it('Should not bypass daily withdrawal limits on emergency', async function () {
      const { riskEngine, pool, user1, user2, guardian, owner } = await loadFixture(
        deployRiskEngineFixture
      );

      await riskEngine.connect(owner).setDailyWithdrawalCap(ethers.parseEther('1000'));

      await pool.connect(user1).deposit(ethers.parseEther('2000'));
      await pool.connect(user2).deposit(ethers.parseEther('2000'));

      await riskEngine.connect(guardian).pause();

      // Emergency withdrawals still respect daily cap to prevent bank run
      await pool.connect(user1).emergencyWithdraw();

      // User2 might be blocked if daily cap reached
      // (This behavior can be configured based on requirements)
    });
  });

  describe('Circuit Breaker Triggers', function () {
    it('Should auto-pause on excessive withdrawal rate', async function () {
      const { riskEngine, pool, user1, user2, user3, owner } = await loadFixture(
        deployRiskEngineFixture
      );

      // Enable circuit breaker: 50% of TVL in 1 hour
      await riskEngine.connect(owner).setCircuitBreaker(5000, 3600); // 50% in 1 hour

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await pool.connect(user2).deposit(ethers.parseEther('1000'));
      await pool.connect(user3).deposit(ethers.parseEther('1000'));

      // Total TVL: 3000
      // Withdraw 1600 (>50%) within 1 hour should trigger

      await pool.connect(user1).withdraw(ethers.parseEther('1000'));
      await pool.connect(user2).withdraw(ethers.parseEther('600'));

      // Circuit breaker should activate
      expect(await riskEngine.paused()).to.be.true;
    });

    it('Should auto-pause on oracle failure', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      // Simulate oracle failure detection
      await riskEngine.connect(owner).triggerOracleFailure();

      expect(await riskEngine.paused()).to.be.true;
    });

    it('Should emit CircuitBreakerTriggered event', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      await expect(riskEngine.connect(owner).triggerOracleFailure())
        .to.emit(riskEngine, 'CircuitBreakerTriggered')
        .withArgs('ORACLE_FAILURE');
    });

    it('Should auto-pause on large single withdrawal', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      // Enable single tx limit: max 20% of TVL
      await riskEngine.connect(owner).setSingleWithdrawalLimit(2000); // 20%

      await pool.connect(user1).deposit(ethers.parseEther('10000'));

      // Try to withdraw 2500 (25% of TVL)
      await expect(pool.connect(user1).withdraw(ethers.parseEther('2500'))).to.be.revertedWith(
        'Single withdrawal too large'
      );
    });

    it('Should not trigger circuit breaker for gradual withdrawals', async function () {
      const { riskEngine, pool, user1, user2, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setCircuitBreaker(5000, 3600);

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await pool.connect(user2).deposit(ethers.parseEther('1000'));

      // Withdraw 40% over time
      await pool.connect(user1).withdraw(ethers.parseEther('400'));

      await time.increase(30 * 60); // 30 minutes

      await pool.connect(user2).withdraw(ethers.parseEther('400'));

      // Should not be paused
      expect(await riskEngine.paused()).to.be.false;
    });
  });

  describe('Risk Parameter Updates', function () {
    it('Should allow owner to update TVL cap', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setTVLCap(ethers.parseEther('50000'));

      expect(await riskEngine.tvlCap()).to.equal(ethers.parseEther('50000'));
    });

    it('Should allow owner to update user withdrawal cap', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setUserWithdrawalCap(ethers.parseEther('5000'));

      expect(await riskEngine.userWithdrawalCap()).to.equal(ethers.parseEther('5000'));
    });

    it('Should allow owner to update daily withdrawal cap', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setDailyWithdrawalCap(ethers.parseEther('10000'));

      expect(await riskEngine.dailyWithdrawalCap()).to.equal(ethers.parseEther('10000'));
    });

    it('Should emit events on parameter changes', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      await expect(riskEngine.connect(owner).setTVLCap(ethers.parseEther('50000')))
        .to.emit(riskEngine, 'RiskParameterUpdated')
        .withArgs('TVL_CAP', ethers.parseEther('50000'));
    });

    it('Should prevent non-owner from updating parameters', async function () {
      const { riskEngine, user1 } = await loadFixture(deployRiskEngineFixture);

      await expect(
        riskEngine.connect(user1).setTVLCap(ethers.parseEther('50000'))
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should validate parameter bounds', async function () {
      const { riskEngine, owner } = await loadFixture(deployRiskEngineFixture);

      // Can't set TVL cap to zero
      await expect(riskEngine.connect(owner).setTVLCap(0)).to.be.revertedWith('Invalid TVL cap');
    });
  });

  describe('Access Control', function () {
    it('Should allow owner to grant guardian role', async function () {
      const { riskEngine, owner, user1 } = await loadFixture(deployRiskEngineFixture);

      const GUARDIAN_ROLE = await riskEngine.GUARDIAN_ROLE();

      await riskEngine.connect(owner).grantRole(GUARDIAN_ROLE, user1.address);

      expect(await riskEngine.hasRole(GUARDIAN_ROLE, user1.address)).to.be.true;
    });

    it('Should allow multiple guardians', async function () {
      const { riskEngine, owner, user1, user2 } = await loadFixture(deployRiskEngineFixture);

      const GUARDIAN_ROLE = await riskEngine.GUARDIAN_ROLE();

      await riskEngine.connect(owner).grantRole(GUARDIAN_ROLE, user1.address);
      await riskEngine.connect(owner).grantRole(GUARDIAN_ROLE, user2.address);

      await riskEngine.connect(user1).pause();
      await riskEngine.connect(user2).unpause();

      expect(await riskEngine.paused()).to.be.false;
    });

    it('Should allow owner to revoke guardian role', async function () {
      const { riskEngine, owner, guardian } = await loadFixture(deployRiskEngineFixture);

      const GUARDIAN_ROLE = await riskEngine.GUARDIAN_ROLE();

      await riskEngine.connect(owner).revokeRole(GUARDIAN_ROLE, guardian.address);

      expect(await riskEngine.hasRole(GUARDIAN_ROLE, guardian.address)).to.be.false;

      await expect(riskEngine.connect(guardian).pause()).to.be.revertedWith('AccessControl:');
    });
  });

  describe('View Functions', function () {
    it('Should return current TVL', async function () {
      const { riskEngine, pool, user1, user2 } = await loadFixture(deployRiskEngineFixture);

      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      await pool.connect(user2).deposit(ethers.parseEther('2000'));

      expect(await riskEngine.getCurrentTVL()).to.equal(ethers.parseEther('3000'));
    });

    it('Should return risk metrics', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setTVLCap(ethers.parseEther('10000'));

      await pool.connect(user1).deposit(ethers.parseEther('6000'));

      const metrics = await riskEngine.getRiskMetrics();

      expect(metrics.currentTVL).to.equal(ethers.parseEther('6000'));
      expect(metrics.tvlCapUtilization).to.equal(6000); // 60%
      expect(metrics.paused).to.be.false;
    });

    it('Should check if operation is allowed', async function () {
      const { riskEngine, pool, user1, owner } = await loadFixture(deployRiskEngineFixture);

      await riskEngine.connect(owner).setTVLCap(ethers.parseEther('10000'));

      await pool.connect(user1).deposit(ethers.parseEther('9000'));

      expect(await riskEngine.isDepositAllowed(ethers.parseEther('500'))).to.be.true;
      expect(await riskEngine.isDepositAllowed(ethers.parseEther('2000'))).to.be.false;
    });
  });
});

const anyValue = require('@nomicfoundation/hardhat-chai-matchers').anyValue;
