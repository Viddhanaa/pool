import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";

interface DeployedContracts {
  payoutManager: Contract;
  batchPayout: Contract;
  licenseNFT: Contract;
  dePINOracle: Contract;
  multiSigWallet: Contract;
}

async function main(): Promise<DeployedContracts> {
  const [deployer, admin, operator, treasury] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Configuration
  const config = {
    // PayoutManager config
    dailyPayoutLimit: ethers.parseEther("100"), // 100 ETH daily limit
    minPayoutThreshold: ethers.parseEther("0.01"), // 0.01 ETH minimum
    feePercent: 100, // 1% fee

    // MultiSig config
    multiSigOwners: [deployer.address, admin?.address || deployer.address],
    confirmationsRequired: 1,
  };

  console.log("\n--- Deploying Contracts ---\n");

  // 1. Deploy MultiSigWallet
  console.log("1. Deploying MultiSigWallet...");
  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const multiSigWallet = await MultiSigWallet.deploy(
    config.multiSigOwners,
    config.confirmationsRequired
  );
  await multiSigWallet.waitForDeployment();
  const multiSigAddress = await multiSigWallet.getAddress();
  console.log("   MultiSigWallet deployed to:", multiSigAddress);

  // Use MultiSig as treasury for other contracts
  const treasuryAddress = treasury?.address || multiSigAddress;

  // 2. Deploy PayoutManager (Upgradeable)
  console.log("2. Deploying PayoutManager (UUPS Proxy)...");
  const PayoutManager = await ethers.getContractFactory("PayoutManager");
  const payoutManager = await upgrades.deployProxy(
    PayoutManager,
    [
      deployer.address, // admin
      treasuryAddress, // treasury
      config.dailyPayoutLimit,
      config.minPayoutThreshold,
      config.feePercent,
    ],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await payoutManager.waitForDeployment();
  const payoutManagerAddress = await payoutManager.getAddress();
  console.log("   PayoutManager Proxy deployed to:", payoutManagerAddress);

  // Get implementation address
  const payoutManagerImpl = await upgrades.erc1967.getImplementationAddress(payoutManagerAddress);
  console.log("   PayoutManager Implementation:", payoutManagerImpl);

  // 3. Deploy BatchPayout
  console.log("3. Deploying BatchPayout...");
  const BatchPayout = await ethers.getContractFactory("BatchPayout");
  const batchPayout = await BatchPayout.deploy(deployer.address, treasuryAddress);
  await batchPayout.waitForDeployment();
  const batchPayoutAddress = await batchPayout.getAddress();
  console.log("   BatchPayout deployed to:", batchPayoutAddress);

  // 4. Deploy LicenseNFT
  console.log("4. Deploying LicenseNFT...");
  const LicenseNFT = await ethers.getContractFactory("LicenseNFT");
  const licenseNFT = await LicenseNFT.deploy(deployer.address, treasuryAddress);
  await licenseNFT.waitForDeployment();
  const licenseNFTAddress = await licenseNFT.getAddress();
  console.log("   LicenseNFT deployed to:", licenseNFTAddress);

  // 5. Deploy DePINOracle
  console.log("5. Deploying DePINOracle...");
  const DePINOracle = await ethers.getContractFactory("DePINOracle");
  const dePINOracle = await DePINOracle.deploy(deployer.address, treasuryAddress);
  await dePINOracle.waitForDeployment();
  const dePINOracleAddress = await dePINOracle.getAddress();
  console.log("   DePINOracle deployed to:", dePINOracleAddress);

  console.log("\n--- Setting Up Roles ---\n");

  // Grant operator role if operator address exists
  if (operator) {
    console.log("Granting OPERATOR_ROLE to:", operator.address);
    const OPERATOR_ROLE = await payoutManager.OPERATOR_ROLE();
    await payoutManager.grantRole(OPERATOR_ROLE, operator.address);
  }

  console.log("\n--- Deployment Complete ---\n");
  console.log("Contract Addresses:");
  console.log("===================");
  console.log(`MultiSigWallet:    ${multiSigAddress}`);
  console.log(`PayoutManager:     ${payoutManagerAddress}`);
  console.log(`  Implementation:  ${payoutManagerImpl}`);
  console.log(`BatchPayout:       ${batchPayoutAddress}`);
  console.log(`LicenseNFT:        ${licenseNFTAddress}`);
  console.log(`DePINOracle:       ${dePINOracleAddress}`);

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MultiSigWallet: multiSigAddress,
      PayoutManager: {
        proxy: payoutManagerAddress,
        implementation: payoutManagerImpl,
      },
      BatchPayout: batchPayoutAddress,
      LicenseNFT: licenseNFTAddress,
      DePINOracle: dePINOracleAddress,
    },
    configuration: config,
  };

  console.log("\n--- Deployment Info ---\n");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  return {
    payoutManager: payoutManager as unknown as Contract,
    batchPayout: batchPayout as unknown as Contract,
    licenseNFT: licenseNFT as unknown as Contract,
    dePINOracle: dePINOracle as unknown as Contract,
    multiSigWallet: multiSigWallet as unknown as Contract,
  };
}

// Verify contracts on block explorer
async function verify(address: string, args: unknown[] = []) {
  console.log(`Verifying ${address}...`);
  try {
    const { run } = await import("hardhat");
    await run("verify:verify", {
      address,
      constructorArguments: args,
    });
    console.log(`Verified ${address}`);
  } catch (error) {
    console.log(`Verification failed: ${error}`);
  }
}

// Export for testing
export { main, verify };

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
