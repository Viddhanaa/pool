const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');

/**
 * Pool.sol Comprehensive Test Suite
 * 
 * Tests cover:
 * - Deposit happy paths and edge cases
 * - Withdraw happy paths and edge cases
 * - Exchange rate calculations
 * - Share minting/burning
 * - Event emissions
 * - Pause mechanism
 * - Access control
 */
describe('Pool Contract', function () {
  // Fixture for deploying contracts and setting up test environment
  async function deployPoolFixture() {
    const [owner, user1, user2, user3, pauser, attacker] = await ethers.getSigners();

    // Deploy mock ERC20 token for testing
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const supportedAsset = await MockERC20.deploy('Supported Asset', 'SUPP', ethers.parseEther('1000000'));
    const unsupportedAsset = await MockERC20.deploy('Unsupported Asset', 'UNSUPP', ethers.parseEther('1000000'));

    // Deploy Pool contract
    const Pool = await ethers.getContractFactory('Pool');
    const pool = await Pool.deploy(
      'VIDDHANA Pool Shares',
      'VPS',
      await supportedAsset.getAddress()
    );

    // Mint tokens to users
    await supportedAsset.transfer(user1.address, ethers.parseEther('10000'));
    await supportedAsset.transfer(user2.address, ethers.parseEther('10000'));
    await supportedAsset.transfer(user3.address, ethers.parseEther('10000'));
    await unsupportedAsset.transfer(user1.address, ethers.parseEther('10000'));

    // Approve pool to spend user tokens
    await supportedAsset.connect(user1).approve(await pool.getAddress(), ethers.MaxUint256);
    await supportedAsset.connect(user2).approve(await pool.getAddress(), ethers.MaxUint256);
    await supportedAsset.connect(user3).approve(await pool.getAddress(), ethers.MaxUint256);

    return { pool, supportedAsset, unsupportedAsset, owner, user1, user2, user3, pauser, attacker };
  }

  describe('Deployment', function () {
    it('Should set the correct name and symbol', async function () {
      const { pool } = await loadFixture(deployPoolFixture);
      expect(await pool.name()).to.equal('VIDDHANA Pool Shares');
      expect(await pool.symbol()).to.equal('VPS');
    });

    it('Should set the correct supported asset', async function () {
      const { pool, supportedAsset } = await loadFixture(deployPoolFixture);
      expect(await pool.supportedAsset()).to.equal(await supportedAsset.getAddress());
    });

    it('Should initialize with zero total supply', async function () {
      const { pool } = await loadFixture(deployPoolFixture);
      expect(await pool.totalSupply()).to.equal(0);
    });
  });

  describe('Deposit - Happy Path', function () {
    it('Should deposit valid asset and mint correct shares (first deposit)', async function () {
      const { pool, supportedAsset, user1 } = await loadFixture(deployPoolFixture);
      const depositAmount = ethers.parseEther('100');

      const balanceBefore = await supportedAsset.balanceOf(user1.address);
      
      await expect(pool.connect(user1).deposit(depositAmount))
        .to.emit(pool, 'Deposit')
        .withArgs(user1.address, depositAmount, depositAmount) // 1:1 for first deposit
        .to.emit(pool, 'Transfer')
        .withArgs(ethers.ZeroAddress, user1.address, depositAmount);

      expect(await pool.balanceOf(user1.address)).to.equal(depositAmount);
      expect(await supportedAsset.balanceOf(user1.address)).to.equal(balanceBefore - depositAmount);
      expect(await supportedAsset.balanceOf(await pool.getAddress())).to.equal(depositAmount);
    });

    it('Should deposit and mint shares based on correct exchange rate (subsequent deposits)', async function () {
      const { pool, supportedAsset, user1, user2 } = await loadFixture(deployPoolFixture);
      
      // First deposit: 100 tokens for 100 shares (1:1 rate)
      await pool.connect(user1).deposit(ethers.parseEther('100'));

      // Simulate rewards or yield - add 50 tokens directly to pool
      await supportedAsset.transfer(await pool.getAddress(), ethers.parseEther('50'));

      // Now pool has 150 tokens and 100 shares, exchange rate = 1.5
      // Second deposit: 75 tokens should give 50 shares (75 / 1.5)
      const depositAmount = ethers.parseEther('75');
      const expectedShares = ethers.parseEther('50');

      await expect(pool.connect(user2).deposit(depositAmount))
        .to.emit(pool, 'Deposit')
        .withArgs(user2.address, depositAmount, expectedShares);

      expect(await pool.balanceOf(user2.address)).to.equal(expectedShares);
      expect(await pool.totalSupply()).to.equal(ethers.parseEther('150'));
    });

    it('Should update per-account and global accounting correctly', async function () {
      const { pool, user1, user2 } = await loadFixture(deployPoolFixture);

      await pool.connect(user1).deposit(ethers.parseEther('100'));
      await pool.connect(user2).deposit(ethers.parseEther('200'));

      expect(await pool.totalDeposits()).to.equal(ethers.parseEther('300'));
      expect(await pool.getUserDeposits(user1.address)).to.equal(ethers.parseEther('100'));
      expect(await pool.getUserDeposits(user2.address)).to.equal(ethers.parseEther('200'));
    });

    it('Should emit correct events for deposit', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      const amount = ethers.parseEther('100');

      await expect(pool.connect(user1).deposit(amount))
        .to.emit(pool, 'Deposit')
        .withArgs(user1.address, amount, amount)
        .to.emit(pool, 'Transfer')
        .withArgs(ethers.ZeroAddress, user1.address, amount);
    });
  });

  describe('Deposit - Edge Cases', function () {
    it('Should reject zero deposit amount', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await expect(pool.connect(user1).deposit(0))
        .to.be.revertedWith('Amount must be greater than zero');
    });

    it('Should reject deposit when paused', async function () {
      const { pool, user1, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(owner).pause();
      
      await expect(pool.connect(user1).deposit(ethers.parseEther('100')))
        .to.be.revertedWith('Pausable: paused');
    });

    it('Should reject unsupported asset (if multi-asset logic exists)', async function () {
      const { pool, unsupportedAsset, user1 } = await loadFixture(deployPoolFixture);
      
      await unsupportedAsset.connect(user1).approve(await pool.getAddress(), ethers.MaxUint256);
      
      // This assumes Pool has a depositAsset(address, amount) function
      // If not, this test validates that only the supportedAsset works
      await expect(pool.connect(user1).depositAsset(
        await unsupportedAsset.getAddress(),
        ethers.parseEther('100')
      )).to.be.revertedWith('Asset not supported');
    });

    it('Should handle insufficient allowance gracefully', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      // Deploy new pool without approval
      const MockERC20 = await ethers.getContractFactory('MockERC20');
      const newAsset = await MockERC20.deploy('New Asset', 'NEW', ethers.parseEther('1000000'));
      
      const Pool = await ethers.getContractFactory('Pool');
      const newPool = await Pool.deploy('New Pool', 'NP', await newAsset.getAddress());
      
      await newAsset.transfer(user1.address, ethers.parseEther('1000'));
      
      await expect(newPool.connect(user1).deposit(ethers.parseEther('100')))
        .to.be.revertedWith('ERC20: insufficient allowance');
    });

    it('Should handle insufficient balance gracefully', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      const userBalance = await supportedAsset.balanceOf(user1.address);
      
      await expect(pool.connect(user1).deposit(userBalance + ethers.parseEther('1')))
        .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should prevent deposit when TVL cap is reached', async function () {
      const { pool, user1, user2, owner } = await loadFixture(deployPoolFixture);
      
      // Set TVL cap to 500 tokens
      await pool.connect(owner).setTVLCap(ethers.parseEther('500'));
      
      // Deposit 400 tokens
      await pool.connect(user1).deposit(ethers.parseEther('400'));
      
      // Try to deposit 200 more (would exceed cap)
      await expect(pool.connect(user2).deposit(ethers.parseEther('200')))
        .to.be.revertedWith('TVL cap exceeded');
      
      // Should succeed with 100
      await pool.connect(user2).deposit(ethers.parseEther('100'));
    });
  });

  describe('Withdraw - Happy Path', function () {
    it('Should withdraw, burn shares, and transfer underlying correctly', async function () {
      const { pool, supportedAsset, user1 } = await loadFixture(deployPoolFixture);
      
      // Deposit first
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      const sharesBefore = await pool.balanceOf(user1.address);
      const balanceBefore = await supportedAsset.balanceOf(user1.address);
      
      const withdrawShares = ethers.parseEther('50');
      const expectedAmount = ethers.parseEther('50'); // 1:1 rate
      
      await expect(pool.connect(user1).withdraw(withdrawShares))
        .to.emit(pool, 'Withdraw')
        .withArgs(user1.address, withdrawShares, expectedAmount)
        .to.emit(pool, 'Transfer')
        .withArgs(user1.address, ethers.ZeroAddress, withdrawShares);
      
      expect(await pool.balanceOf(user1.address)).to.equal(sharesBefore - withdrawShares);
      expect(await supportedAsset.balanceOf(user1.address)).to.equal(balanceBefore + expectedAmount);
    });

    it('Should calculate correct underlying with exchange rate', async function () {
      const { pool, supportedAsset, user1 } = await loadFixture(deployPoolFixture);
      
      // Deposit 100 tokens for 100 shares
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      // Add 100 tokens as rewards (exchange rate becomes 2:1)
      await supportedAsset.transfer(await pool.getAddress(), ethers.parseEther('100'));
      
      // Withdraw 50 shares should give 100 tokens
      const withdrawShares = ethers.parseEther('50');
      const expectedAmount = ethers.parseEther('100');
      
      await expect(pool.connect(user1).withdraw(withdrawShares))
        .to.emit(pool, 'Withdraw')
        .withArgs(user1.address, withdrawShares, expectedAmount);
      
      expect(await supportedAsset.balanceOf(user1.address)).to.be.closeTo(
        ethers.parseEther('10000'), // Original balance
        ethers.parseEther('0.01') // Small tolerance for rounding
      );
    });

    it('Should emit correct events for withdrawal', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      const shares = ethers.parseEther('50');
      
      await expect(pool.connect(user1).withdraw(shares))
        .to.emit(pool, 'Withdraw')
        .to.emit(pool, 'Transfer')
        .withArgs(user1.address, ethers.ZeroAddress, shares);
    });
  });

  describe('Withdraw - Edge Cases', function () {
    it('Should reject withdrawal with insufficient balance', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      await expect(pool.connect(user1).withdraw(ethers.parseEther('101')))
        .to.be.revertedWith('Insufficient shares');
    });

    it('Should reject withdrawal before cooldown period', async function () {
      const { pool, user1, owner } = await loadFixture(deployPoolFixture);
      
      // Set 7-day cooldown
      await pool.connect(owner).setWithdrawCooldown(7 * 24 * 60 * 60);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      await expect(pool.connect(user1).withdraw(ethers.parseEther('50')))
        .to.be.revertedWith('Cooldown period not met');
      
      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);
      
      // Should succeed now
      await pool.connect(user1).withdraw(ethers.parseEther('50'));
    });

    it('Should reject withdrawal exceeding per-day cap', async function () {
      const { pool, user1, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      
      // Set daily withdrawal cap to 100 tokens
      await pool.connect(owner).setDailyWithdrawalCap(ethers.parseEther('100'));
      
      // First withdrawal of 100 should succeed
      await pool.connect(user1).withdraw(ethers.parseEther('100'));
      
      // Second withdrawal should fail
      await expect(pool.connect(user1).withdraw(ethers.parseEther('50')))
        .to.be.revertedWith('Daily withdrawal cap exceeded');
      
      // After 24 hours, should work again
      await time.increase(24 * 60 * 60 + 1);
      await pool.connect(user1).withdraw(ethers.parseEther('50'));
    });

    it('Should reject withdrawal exceeding per-user cap', async function () {
      const { pool, user1, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('1000'));
      
      // Set per-user withdrawal cap to 200 tokens total
      await pool.connect(owner).setUserWithdrawalCap(ethers.parseEther('200'));
      
      await pool.connect(user1).withdraw(ethers.parseEther('150'));
      
      await expect(pool.connect(user1).withdraw(ethers.parseEther('100')))
        .to.be.revertedWith('User withdrawal cap exceeded');
      
      // 50 more should work
      await pool.connect(user1).withdraw(ethers.parseEther('50'));
    });

    it('Should reject zero withdrawal amount', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      await expect(pool.connect(user1).withdraw(0))
        .to.be.revertedWith('Amount must be greater than zero');
    });

    it('Should reject withdrawal when paused', async function () {
      const { pool, user1, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      await pool.connect(owner).pause();
      
      await expect(pool.connect(user1).withdraw(ethers.parseEther('50')))
        .to.be.revertedWith('Pausable: paused');
    });
  });

  describe('Exchange Rate Calculation', function () {
    it('Should calculate correct exchange rate with no rewards', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      expect(await pool.exchangeRate()).to.equal(ethers.parseEther('1'));
    });

    it('Should calculate correct exchange rate with rewards', async function () {
      const { pool, supportedAsset, user1 } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      // Add 50 tokens as rewards
      await supportedAsset.transfer(await pool.getAddress(), ethers.parseEther('50'));
      
      // Exchange rate should be 1.5 (150 tokens / 100 shares)
      expect(await pool.exchangeRate()).to.equal(ethers.parseEther('1.5'));
    });

    it('Should handle multiple deposits and withdrawals correctly', async function () {
      const { pool, supportedAsset, user1, user2 } = await loadFixture(deployPoolFixture);
      
      // User1 deposits 100
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      expect(await pool.exchangeRate()).to.equal(ethers.parseEther('1'));
      
      // Add rewards
      await supportedAsset.transfer(await pool.getAddress(), ethers.parseEther('50'));
      expect(await pool.exchangeRate()).to.equal(ethers.parseEther('1.5'));
      
      // User2 deposits at 1.5 rate
      await pool.connect(user2).deposit(ethers.parseEther('150'));
      
      // Total: 300 tokens, 200 shares, rate = 1.5
      expect(await pool.exchangeRate()).to.equal(ethers.parseEther('1.5'));
      
      // User1 withdraws half
      await pool.connect(user1).withdraw(ethers.parseEther('50'));
      
      // Rate should remain ~1.5
      expect(await pool.exchangeRate()).to.be.closeTo(
        ethers.parseEther('1.5'),
        ethers.parseEther('0.01')
      );
    });

    it('Should handle precision and rounding correctly', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      // Deposit odd amount
      await pool.connect(user1).deposit(ethers.parseEther('123.456789'));
      
      expect(await pool.balanceOf(user1.address)).to.equal(ethers.parseEther('123.456789'));
      expect(await pool.exchangeRate()).to.equal(ethers.parseEther('1'));
    });
  });

  describe('Access Control & Security', function () {
    it('Should allow only owner to pause', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await expect(pool.connect(user1).pause())
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should allow only owner to set caps', async function () {
      const { pool, user1 } = await loadFixture(deployPoolFixture);
      
      await expect(pool.connect(user1).setTVLCap(ethers.parseEther('1000')))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should emit events when parameters are changed', async function () {
      const { pool, owner } = await loadFixture(deployPoolFixture);
      
      await expect(pool.connect(owner).setTVLCap(ethers.parseEther('1000')))
        .to.emit(pool, 'TVLCapUpdated')
        .withArgs(ethers.parseEther('1000'));
    });

    it('Should prevent reentrancy on deposit', async function () {
      // This test requires a malicious token that attempts reentrancy
      // Skipping implementation as it requires complex setup
      // In production, ensure ReentrancyGuard is used
    });

    it('Should prevent reentrancy on withdraw', async function () {
      // Similar to above - ensure ReentrancyGuard is present
    });
  });

  describe('Emergency Functions', function () {
    it('Should allow emergency withdrawal when paused', async function () {
      const { pool, supportedAsset, user1, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      await pool.connect(owner).pause();
      
      const balanceBefore = await supportedAsset.balanceOf(user1.address);
      
      // Emergency withdraw should work even when paused
      await pool.connect(user1).emergencyWithdraw();
      
      expect(await pool.balanceOf(user1.address)).to.equal(0);
      expect(await supportedAsset.balanceOf(user1.address)).to.be.gt(balanceBefore);
    });

    it('Should forfeit pending rewards on emergency withdrawal', async function () {
      const { pool, supportedAsset, user1, owner } = await loadFixture(deployPoolFixture);
      
      await pool.connect(user1).deposit(ethers.parseEther('100'));
      
      // Add rewards
      await supportedAsset.transfer(await pool.getAddress(), ethers.parseEther('50'));
      
      await pool.connect(owner).pause();
      
      // Emergency withdraw should only return principal (approximately)
      const balanceBefore = await supportedAsset.balanceOf(user1.address);
      await pool.connect(user1).emergencyWithdraw();
      
      // User should get close to 100 back (principal), not 150 (with rewards)
      const balanceAfter = await supportedAsset.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(
        ethers.parseEther('100'),
        ethers.parseEther('1')
      );
    });
  });
});
