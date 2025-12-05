import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { PayoutManager } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("PayoutManager", function () {
  let payoutManager: PayoutManager;
  let admin: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let circuitBreaker: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let recipient1: HardhatEthersSigner;
  let recipient2: HardhatEthersSigner;
  let recipient3: HardhatEthersSigner;

  const DAILY_LIMIT = ethers.parseEther("10");
  const MIN_THRESHOLD = ethers.parseEther("0.01");
  const FEE_PERCENT = 100; // 1%

  beforeEach(async function () {
    [admin, operator, circuitBreaker, treasury, recipient1, recipient2, recipient3] =
      await ethers.getSigners();

    const PayoutManager = await ethers.getContractFactory("PayoutManager");
    payoutManager = (await upgrades.deployProxy(
      PayoutManager,
      [admin.address, treasury.address, DAILY_LIMIT, MIN_THRESHOLD, FEE_PERCENT],
      { kind: "uups", initializer: "initialize" }
    )) as unknown as PayoutManager;

    // Grant roles
    const OPERATOR_ROLE = await payoutManager.OPERATOR_ROLE();
    const CIRCUIT_BREAKER_ROLE = await payoutManager.CIRCUIT_BREAKER_ROLE();

    await payoutManager.grantRole(OPERATOR_ROLE, operator.address);
    await payoutManager.grantRole(CIRCUIT_BREAKER_ROLE, circuitBreaker.address);

    // Fund the contract
    await admin.sendTransaction({
      to: await payoutManager.getAddress(),
      value: ethers.parseEther("20"),
    });
  });

  describe("Initialization", function () {
    it("should set correct initial values", async function () {
      expect(await payoutManager.dailyPayoutLimit()).to.equal(DAILY_LIMIT);
      expect(await payoutManager.minPayoutThreshold()).to.equal(MIN_THRESHOLD);
      expect(await payoutManager.feePercent()).to.equal(FEE_PERCENT);
      expect(await payoutManager.treasury()).to.equal(treasury.address);
    });

    it("should grant admin role to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await payoutManager.DEFAULT_ADMIN_ROLE();
      expect(await payoutManager.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should not allow re-initialization", async function () {
      await expect(
        payoutManager.initialize(
          admin.address,
          treasury.address,
          DAILY_LIMIT,
          MIN_THRESHOLD,
          FEE_PERCENT
        )
      ).to.be.revertedWithCustomError(payoutManager, "InvalidInitialization");
    });
  });

  describe("Queue Payout", function () {
    it("should queue a valid payout", async function () {
      const amount = ethers.parseEther("1");
      const referenceId = ethers.encodeBytes32String("ref-001");

      await expect(
        payoutManager.connect(operator).queuePayout(recipient1.address, amount, referenceId)
      )
        .to.emit(payoutManager, "PayoutQueued")
        .withArgs(1, recipient1.address, amount, referenceId);

      const payout = await payoutManager.getPayout(1);
      expect(payout.recipient).to.equal(recipient1.address);
      expect(payout.amount).to.equal(amount);
      expect(payout.status).to.equal(0); // Pending
    });

    it("should reject payout below minimum threshold", async function () {
      const amount = ethers.parseEther("0.001");
      const referenceId = ethers.encodeBytes32String("ref-002");

      await expect(
        payoutManager.connect(operator).queuePayout(recipient1.address, amount, referenceId)
      )
        .to.be.revertedWithCustomError(payoutManager, "BelowMinimumThreshold")
        .withArgs(amount, MIN_THRESHOLD);
    });

    it("should reject payout to zero address", async function () {
      const amount = ethers.parseEther("1");
      const referenceId = ethers.encodeBytes32String("ref-003");

      await expect(
        payoutManager.connect(operator).queuePayout(ethers.ZeroAddress, amount, referenceId)
      ).to.be.revertedWithCustomError(payoutManager, "InvalidRecipient");
    });

    it("should reject payout with zero amount", async function () {
      const referenceId = ethers.encodeBytes32String("ref-004");

      await expect(
        payoutManager.connect(operator).queuePayout(recipient1.address, 0, referenceId)
      ).to.be.revertedWithCustomError(payoutManager, "InvalidAmount");
    });

    it("should reject queue from non-operator", async function () {
      const amount = ethers.parseEther("1");
      const referenceId = ethers.encodeBytes32String("ref-005");

      await expect(
        payoutManager.connect(recipient1).queuePayout(recipient1.address, amount, referenceId)
      ).to.be.revertedWithCustomError(payoutManager, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Process Payout", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("1");
      const referenceId = ethers.encodeBytes32String("ref-001");
      await payoutManager.connect(operator).queuePayout(recipient1.address, amount, referenceId);
    });

    it("should process a queued payout", async function () {
      const balanceBefore = await ethers.provider.getBalance(recipient1.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await expect(payoutManager.connect(operator).processPayout(1))
        .to.emit(payoutManager, "PayoutProcessed")
        .withArgs(1, recipient1.address, ethers.parseEther("1"));

      const balanceAfter = await ethers.provider.getBalance(recipient1.address);
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      // Recipient should receive 99% (1% fee)
      const expectedAmount = ethers.parseEther("0.99");
      expect(balanceAfter - balanceBefore).to.equal(expectedAmount);

      // Treasury should receive 1%
      const expectedFee = ethers.parseEther("0.01");
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);

      const payout = await payoutManager.getPayout(1);
      expect(payout.status).to.equal(2); // Completed
    });

    it("should update daily payout total", async function () {
      await payoutManager.connect(operator).processPayout(1);

      const dailyTotal = await payoutManager.getDailyPayoutTotal();
      expect(dailyTotal).to.equal(ethers.parseEther("1"));
    });

    it("should reject processing non-existent payout", async function () {
      await expect(payoutManager.connect(operator).processPayout(999))
        .to.be.revertedWithCustomError(payoutManager, "PayoutNotFound")
        .withArgs(999);
    });

    it("should reject processing already processed payout", async function () {
      await payoutManager.connect(operator).processPayout(1);

      await expect(payoutManager.connect(operator).processPayout(1))
        .to.be.revertedWithCustomError(payoutManager, "PayoutAlreadyProcessed")
        .withArgs(1);
    });

    it("should reject when daily limit exceeded", async function () {
      // Queue payouts that exceed daily limit
      for (let i = 0; i < 10; i++) {
        await payoutManager
          .connect(operator)
          .queuePayout(
            recipient1.address,
            ethers.parseEther("1"),
            ethers.encodeBytes32String(`ref-${i}`)
          );
      }

      // Process first 10 payouts (reaches limit)
      for (let i = 1; i <= 10; i++) {
        await payoutManager.connect(operator).processPayout(i);
      }

      // 11th should fail
      await payoutManager
        .connect(operator)
        .queuePayout(
          recipient1.address,
          ethers.parseEther("1"),
          ethers.encodeBytes32String("ref-excess")
        );

      await expect(payoutManager.connect(operator).processPayout(11))
        .to.be.revertedWithCustomError(payoutManager, "DailyLimitExceeded");
    });
  });

  describe("Batch Payout", function () {
    beforeEach(async function () {
      // Queue multiple payouts
      for (let i = 0; i < 5; i++) {
        await payoutManager
          .connect(operator)
          .queuePayout(
            [recipient1, recipient2, recipient3][i % 3].address,
            ethers.parseEther("0.5"),
            ethers.encodeBytes32String(`batch-ref-${i}`)
          );
      }
    });

    it("should process multiple payouts in batch", async function () {
      const payoutIds = [1, 2, 3, 4, 5];

      await expect(payoutManager.connect(operator).processBatchPayout(payoutIds))
        .to.emit(payoutManager, "BatchPayoutProcessed");

      for (const id of payoutIds) {
        const payout = await payoutManager.getPayout(id);
        expect(payout.status).to.equal(2); // Completed
      }
    });

    it("should reject batch size exceeding maximum", async function () {
      const payoutIds = Array.from({ length: 101 }, (_, i) => i + 1);

      await expect(payoutManager.connect(operator).processBatchPayout(payoutIds))
        .to.be.revertedWithCustomError(payoutManager, "BatchSizeTooLarge")
        .withArgs(101, 100);
    });
  });

  describe("Circuit Breaker", function () {
    it("should trigger circuit breaker", async function () {
      const reason = "Emergency stop";

      await expect(payoutManager.connect(circuitBreaker).triggerCircuitBreaker(reason))
        .to.emit(payoutManager, "CircuitBreakerTriggered")
        .withArgs(circuitBreaker.address, reason);

      expect(await payoutManager.isCircuitBreakerActive()).to.be.true;
    });

    it("should prevent payouts when circuit breaker is active", async function () {
      await payoutManager.connect(circuitBreaker).triggerCircuitBreaker("Test");

      await expect(
        payoutManager
          .connect(operator)
          .queuePayout(
            recipient1.address,
            ethers.parseEther("1"),
            ethers.encodeBytes32String("ref")
          )
      ).to.be.revertedWithCustomError(payoutManager, "CircuitBreakerActive");
    });

    it("should reset circuit breaker", async function () {
      await payoutManager.connect(circuitBreaker).triggerCircuitBreaker("Test");
      
      await expect(payoutManager.connect(admin).resetCircuitBreaker())
        .to.emit(payoutManager, "CircuitBreakerReset")
        .withArgs(admin.address);

      expect(await payoutManager.isCircuitBreakerActive()).to.be.false;
    });

    it("should only allow admin to reset circuit breaker", async function () {
      await payoutManager.connect(circuitBreaker).triggerCircuitBreaker("Test");

      await expect(payoutManager.connect(operator).resetCircuitBreaker())
        .to.be.revertedWithCustomError(payoutManager, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Admin Functions", function () {
    it("should update daily payout limit", async function () {
      const newLimit = ethers.parseEther("50");

      await expect(payoutManager.connect(admin).setDailyPayoutLimit(newLimit))
        .to.emit(payoutManager, "DailyLimitUpdated")
        .withArgs(DAILY_LIMIT, newLimit);

      expect(await payoutManager.dailyPayoutLimit()).to.equal(newLimit);
    });

    it("should update minimum payout threshold", async function () {
      const newThreshold = ethers.parseEther("0.05");

      await expect(payoutManager.connect(admin).setMinPayoutThreshold(newThreshold))
        .to.emit(payoutManager, "MinPayoutThresholdUpdated")
        .withArgs(MIN_THRESHOLD, newThreshold);

      expect(await payoutManager.minPayoutThreshold()).to.equal(newThreshold);
    });

    it("should pause and unpause contract", async function () {
      await payoutManager.connect(admin).pause();
      expect(await payoutManager.paused()).to.be.true;

      await expect(
        payoutManager
          .connect(operator)
          .queuePayout(
            recipient1.address,
            ethers.parseEther("1"),
            ethers.encodeBytes32String("ref")
          )
      ).to.be.revertedWithCustomError(payoutManager, "EnforcedPause");

      await payoutManager.connect(admin).unpause();
      expect(await payoutManager.paused()).to.be.false;
    });
  });

  describe("Upgrade", function () {
    it("should allow upgrader to upgrade contract", async function () {
      const PayoutManagerV2 = await ethers.getContractFactory("PayoutManager");
      const upgraded = await upgrades.upgradeProxy(
        await payoutManager.getAddress(),
        PayoutManagerV2
      );

      expect(await upgraded.getAddress()).to.equal(await payoutManager.getAddress());
    });

    it("should prevent non-upgrader from upgrading", async function () {
      const PayoutManagerV2 = await ethers.getContractFactory("PayoutManager", operator);

      await expect(
        upgrades.upgradeProxy(await payoutManager.getAddress(), PayoutManagerV2)
      ).to.be.revertedWithCustomError(payoutManager, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Daily Limit Reset", function () {
    it("should reset daily limit after 24 hours", async function () {
      // Queue and process payouts to reach limit
      for (let i = 0; i < 10; i++) {
        await payoutManager
          .connect(operator)
          .queuePayout(
            recipient1.address,
            ethers.parseEther("1"),
            ethers.encodeBytes32String(`ref-${i}`)
          );
        await payoutManager.connect(operator).processPayout(i + 1);
      }

      // Advance time by 24 hours
      await time.increase(86400);

      // Queue another payout - should work now
      await payoutManager
        .connect(operator)
        .queuePayout(
          recipient1.address,
          ethers.parseEther("1"),
          ethers.encodeBytes32String("new-day")
        );

      await expect(payoutManager.connect(operator).processPayout(11))
        .to.emit(payoutManager, "PayoutProcessed");
    });
  });

  describe("Cancel Payout", function () {
    it("should cancel a pending payout", async function () {
      await payoutManager
        .connect(operator)
        .queuePayout(
          recipient1.address,
          ethers.parseEther("1"),
          ethers.encodeBytes32String("ref")
        );

      await payoutManager.connect(operator).cancelPayout(1);

      const payout = await payoutManager.getPayout(1);
      expect(payout.status).to.equal(4); // Cancelled
    });
  });

  describe("Emergency Withdraw", function () {
    it("should allow admin to emergency withdraw", async function () {
      const contractBalance = await ethers.provider.getBalance(await payoutManager.getAddress());
      const adminBalanceBefore = await ethers.provider.getBalance(admin.address);

      const tx = await payoutManager.connect(admin).emergencyWithdraw(admin.address);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const adminBalanceAfter = await ethers.provider.getBalance(admin.address);
      expect(adminBalanceAfter).to.equal(adminBalanceBefore + contractBalance - gasUsed);
    });
  });
});
