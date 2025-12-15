import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { LicenseNFT } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("LicenseNFT", function () {
  let licenseNFT: LicenseNFT;
  let admin: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let manager: HardhatEthersSigner;

  // License tiers
  const LicenseTier = {
    Basic: 0,
    Pro: 1,
    Enterprise: 2,
  };

  // Default prices
  const BASIC_PRICE = ethers.parseEther("0.01");
  const PRO_PRICE = ethers.parseEther("0.05");
  const ENTERPRISE_PRICE = ethers.parseEther("0.2");

  // Default durations
  const BASIC_DURATION = 30 * 24 * 60 * 60; // 30 days
  const PRO_DURATION = 90 * 24 * 60 * 60; // 90 days
  const ENTERPRISE_DURATION = 365 * 24 * 60 * 60; // 365 days

  beforeEach(async function () {
    [admin, treasury, user1, user2, manager] = await ethers.getSigners();

    const LicenseNFT = await ethers.getContractFactory("LicenseNFT");
    licenseNFT = await LicenseNFT.deploy(admin.address, treasury.address);
    await licenseNFT.waitForDeployment();

    // Grant manager role
    const LICENSE_MANAGER_ROLE = await licenseNFT.LICENSE_MANAGER_ROLE();
    await licenseNFT.grantRole(LICENSE_MANAGER_ROLE, manager.address);
  });

  describe("Initialization", function () {
    it("should set correct initial tier prices", async function () {
      expect(await licenseNFT.getTierPrice(LicenseTier.Basic)).to.equal(BASIC_PRICE);
      expect(await licenseNFT.getTierPrice(LicenseTier.Pro)).to.equal(PRO_PRICE);
      expect(await licenseNFT.getTierPrice(LicenseTier.Enterprise)).to.equal(ENTERPRISE_PRICE);
    });

    it("should set correct initial tier durations", async function () {
      expect(await licenseNFT.getTierDuration(LicenseTier.Basic)).to.equal(BASIC_DURATION);
      expect(await licenseNFT.getTierDuration(LicenseTier.Pro)).to.equal(PRO_DURATION);
      expect(await licenseNFT.getTierDuration(LicenseTier.Enterprise)).to.equal(ENTERPRISE_DURATION);
    });

    it("should set correct initial pool fees", async function () {
      expect(await licenseNFT.getPoolFee(LicenseTier.Basic)).to.equal(300); // 3%
      expect(await licenseNFT.getPoolFee(LicenseTier.Pro)).to.equal(200); // 2%
      expect(await licenseNFT.getPoolFee(LicenseTier.Enterprise)).to.equal(100); // 1%
    });

    it("should set correct name and symbol", async function () {
      expect(await licenseNFT.name()).to.equal("Viddhana License");
      expect(await licenseNFT.symbol()).to.equal("VLICENSE");
    });
  });

  describe("Purchase License", function () {
    it("should purchase a Basic license", async function () {
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await expect(
        licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE })
      )
        .to.emit(licenseNFT, "LicensePurchased")
        .withArgs(1, user1.address, LicenseTier.Basic, BASIC_PRICE, anyValue);

      expect(await licenseNFT.ownerOf(1)).to.equal(user1.address);
      expect(await licenseNFT.balanceOf(user1.address)).to.equal(1);

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(BASIC_PRICE);

      const license = await licenseNFT.getLicense(1);
      expect(license.tier).to.equal(LicenseTier.Basic);
      expect(license.isActive).to.be.true;
    });

    it("should purchase a Pro license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Pro, { value: PRO_PRICE });

      const license = await licenseNFT.getLicense(1);
      expect(license.tier).to.equal(LicenseTier.Pro);
    });

    it("should purchase an Enterprise license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Enterprise, { value: ENTERPRISE_PRICE });

      const license = await licenseNFT.getLicense(1);
      expect(license.tier).to.equal(LicenseTier.Enterprise);
    });

    it("should reject insufficient payment", async function () {
      const insufficientAmount = ethers.parseEther("0.005");

      await expect(
        licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: insufficientAmount })
      )
        .to.be.revertedWithCustomError(licenseNFT, "InsufficientPayment")
        .withArgs(BASIC_PRICE, insufficientAmount);
    });

    it("should refund excess payment", async function () {
      const excessAmount = ethers.parseEther("0.05");
      const balanceBefore = await ethers.provider.getBalance(user1.address);

      const tx = await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: excessAmount });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const expectedBalance = balanceBefore - BASIC_PRICE - gasUsed;
      expect(balanceAfter).to.equal(expectedBalance);
    });

    it("should reject purchase when user already has active license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });

      await expect(
        licenseNFT.connect(user1).purchaseLicense(LicenseTier.Pro, { value: PRO_PRICE })
      )
        .to.be.revertedWithCustomError(licenseNFT, "LicenseStillActive")
        .withArgs(1);
    });

    it("should allow purchase after license expires", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });

      // Advance time past expiry
      await time.increase(BASIC_DURATION + 1);

      await expect(
        licenseNFT.connect(user1).purchaseLicense(LicenseTier.Pro, { value: PRO_PRICE })
      ).to.emit(licenseNFT, "LicensePurchased");
    });
  });

  describe("Renew License", function () {
    beforeEach(async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });
    });

    it("should renew an active license", async function () {
      const licenseBefore = await licenseNFT.getLicense(1);
      const originalExpiry = licenseBefore.expiresAt;

      await expect(
        licenseNFT.connect(user1).renewLicense(1, { value: BASIC_PRICE })
      ).to.emit(licenseNFT, "LicenseRenewed");

      const licenseAfter = await licenseNFT.getLicense(1);
      expect(licenseAfter.expiresAt).to.equal(originalExpiry + BigInt(BASIC_DURATION));
    });

    it("should renew an expired license within grace period", async function () {
      // Advance time to just past expiry
      await time.increase(BASIC_DURATION + 1);

      await expect(
        licenseNFT.connect(user1).renewLicense(1, { value: BASIC_PRICE })
      ).to.emit(licenseNFT, "LicenseRenewed");
    });

    it("should reject renewal past grace period", async function () {
      // Advance time past grace period (7 days after expiry)
      await time.increase(BASIC_DURATION + 8 * 24 * 60 * 60);

      await expect(
        licenseNFT.connect(user1).renewLicense(1, { value: BASIC_PRICE })
      ).to.be.revertedWithCustomError(licenseNFT, "PastRenewalGracePeriod");
    });

    it("should reject renewal from non-owner", async function () {
      await expect(
        licenseNFT.connect(user2).renewLicense(1, { value: BASIC_PRICE })
      ).to.be.revertedWithCustomError(licenseNFT, "NotTokenOwner");
    });
  });

  describe("Upgrade License", function () {
    beforeEach(async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });
    });

    it("should upgrade from Basic to Pro", async function () {
      const upgradeCost = PRO_PRICE; // Simplified for test

      await expect(
        licenseNFT.connect(user1).upgradeLicense(1, LicenseTier.Pro, { value: upgradeCost })
      )
        .to.emit(licenseNFT, "LicenseUpgraded")
        .withArgs(1, user1.address, LicenseTier.Basic, LicenseTier.Pro, anyValue);

      const license = await licenseNFT.getLicense(1);
      expect(license.tier).to.equal(LicenseTier.Pro);
    });

    it("should upgrade from Basic to Enterprise", async function () {
      await licenseNFT.connect(user1).upgradeLicense(1, LicenseTier.Enterprise, { value: ENTERPRISE_PRICE });

      const license = await licenseNFT.getLicense(1);
      expect(license.tier).to.equal(LicenseTier.Enterprise);
    });

    it("should reject downgrade", async function () {
      await licenseNFT.connect(user1).upgradeLicense(1, LicenseTier.Pro, { value: PRO_PRICE });

      await expect(
        licenseNFT.connect(user1).upgradeLicense(1, LicenseTier.Basic, { value: BASIC_PRICE })
      ).to.be.revertedWithCustomError(licenseNFT, "CannotDowngradeTier");
    });

    it("should reject upgrade to same tier", async function () {
      await expect(
        licenseNFT.connect(user1).upgradeLicense(1, LicenseTier.Basic, { value: BASIC_PRICE })
      ).to.be.revertedWithCustomError(licenseNFT, "SameTier");
    });

    it("should reject upgrade of expired license", async function () {
      await time.increase(BASIC_DURATION + 1);

      await expect(
        licenseNFT.connect(user1).upgradeLicense(1, LicenseTier.Pro, { value: PRO_PRICE })
      ).to.be.revertedWithCustomError(licenseNFT, "LicenseExpired");
    });
  });

  describe("Has Active License", function () {
    it("should return true for active license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Pro, { value: PRO_PRICE });

      const [hasLicense, tier] = await licenseNFT.hasActiveLicense(user1.address);
      expect(hasLicense).to.be.true;
      expect(tier).to.equal(LicenseTier.Pro);
    });

    it("should return false for expired license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });

      await time.increase(BASIC_DURATION + 1);

      const [hasLicense] = await licenseNFT.hasActiveLicense(user1.address);
      expect(hasLicense).to.be.false;
    });

    it("should return false for address without license", async function () {
      const [hasLicense] = await licenseNFT.hasActiveLicense(user2.address);
      expect(hasLicense).to.be.false;
    });
  });

  describe("Pool Fee", function () {
    it("should return correct pool fee for each tier", async function () {
      expect(await licenseNFT.getPoolFee(LicenseTier.Basic)).to.equal(300);
      expect(await licenseNFT.getPoolFee(LicenseTier.Pro)).to.equal(200);
      expect(await licenseNFT.getPoolFee(LicenseTier.Enterprise)).to.equal(100);
    });
  });

  describe("Admin Functions", function () {
    it("should update tier price", async function () {
      const newPrice = ethers.parseEther("0.02");

      await expect(
        licenseNFT.connect(manager).setTierPrice(LicenseTier.Basic, newPrice)
      )
        .to.emit(licenseNFT, "TierPricingUpdated")
        .withArgs(LicenseTier.Basic, BASIC_PRICE, newPrice);

      expect(await licenseNFT.getTierPrice(LicenseTier.Basic)).to.equal(newPrice);
    });

    it("should update tier duration", async function () {
      const newDuration = 60 * 24 * 60 * 60; // 60 days

      await expect(
        licenseNFT.connect(manager).setTierDuration(LicenseTier.Basic, newDuration)
      )
        .to.emit(licenseNFT, "TierDurationUpdated")
        .withArgs(LicenseTier.Basic, BASIC_DURATION, newDuration);

      expect(await licenseNFT.getTierDuration(LicenseTier.Basic)).to.equal(newDuration);
    });

    it("should update tier pool fee", async function () {
      const newFee = 150; // 1.5%

      await expect(licenseNFT.connect(manager).setTierPoolFee(LicenseTier.Basic, newFee))
        .to.emit(licenseNFT, "PoolFeeUpdated")
        .withArgs(LicenseTier.Basic, 300, newFee);

      expect(await licenseNFT.getPoolFee(LicenseTier.Basic)).to.equal(newFee);
    });

    it("should reject pool fee above 10%", async function () {
      await expect(
        licenseNFT.connect(manager).setTierPoolFee(LicenseTier.Basic, 1001)
      ).to.be.revertedWith("Fee too high");
    });

    it("should pause and unpause", async function () {
      await licenseNFT.connect(admin).pause();
      expect(await licenseNFT.paused()).to.be.true;

      await expect(
        licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE })
      ).to.be.revertedWithCustomError(licenseNFT, "EnforcedPause");

      await licenseNFT.connect(admin).unpause();
      expect(await licenseNFT.paused()).to.be.false;
    });
  });

  describe("Admin Mint", function () {
    it("should allow admin to mint license directly", async function () {
      const duration = 180 * 24 * 60 * 60; // 180 days

      await expect(
        licenseNFT.connect(admin).adminMint(user1.address, LicenseTier.Enterprise, duration)
      ).to.emit(licenseNFT, "LicensePurchased");

      expect(await licenseNFT.ownerOf(1)).to.equal(user1.address);

      const license = await licenseNFT.getLicense(1);
      expect(license.tier).to.equal(LicenseTier.Enterprise);
    });

    it("should reject admin mint from non-admin", async function () {
      await expect(
        licenseNFT.connect(user1).adminMint(user1.address, LicenseTier.Basic, 30 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(licenseNFT, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Transfer", function () {
    beforeEach(async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Pro, { value: PRO_PRICE });
    });

    it("should transfer license and update active license mapping", async function () {
      await licenseNFT.connect(user1).transferFrom(user1.address, user2.address, 1);

      expect(await licenseNFT.ownerOf(1)).to.equal(user2.address);
      expect(await licenseNFT.activeLicenseOf(user1.address)).to.equal(0);
      expect(await licenseNFT.activeLicenseOf(user2.address)).to.equal(1);
    });
  });

  describe("Remaining Time", function () {
    it("should return correct remaining time", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });

      // Check immediately after purchase
      const remaining = await licenseNFT.getRemainingTime(1);
      expect(remaining).to.be.closeTo(BigInt(BASIC_DURATION), BigInt(5));

      // Advance time
      await time.increase(10 * 24 * 60 * 60); // 10 days

      const remainingAfter = await licenseNFT.getRemainingTime(1);
      expect(remainingAfter).to.be.closeTo(BigInt(20 * 24 * 60 * 60), BigInt(5));
    });

    it("should return 0 for expired license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });

      await time.increase(BASIC_DURATION + 1);

      expect(await licenseNFT.getRemainingTime(1)).to.equal(0);
    });
  });

  describe("Is License Active", function () {
    it("should return true for active license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });

      expect(await licenseNFT.isLicenseActive(1)).to.be.true;
    });

    it("should return false for expired license", async function () {
      await licenseNFT.connect(user1).purchaseLicense(LicenseTier.Basic, { value: BASIC_PRICE });

      await time.increase(BASIC_DURATION + 1);

      expect(await licenseNFT.isLicenseActive(1)).to.be.false;
    });

    it("should return false for non-existent token", async function () {
      expect(await licenseNFT.isLicenseActive(999)).to.be.false;
    });
  });
});
