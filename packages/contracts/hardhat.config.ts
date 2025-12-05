import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const ATLAS_TESTNET_RPC = process.env.ATLAS_TESTNET_RPC || "https://testnet-rpc.atlaschain.io";
const ATLAS_MAINNET_RPC = process.env.ATLAS_MAINNET_RPC || "https://rpc.atlaschain.io";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    atlasTestnet: {
      url: ATLAS_TESTNET_RPC,
      chainId: 622463, // Atlas L3 testnet chain ID
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
    atlasMainnet: {
      url: ATLAS_MAINNET_RPC,
      chainId: 622461, // Atlas L3 mainnet chain ID
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      atlasTestnet: 0,
      atlasMainnet: 0,
    },
    admin: {
      default: 1,
      atlasTestnet: 1,
      atlasMainnet: 1,
    },
    operator: {
      default: 2,
      atlasTestnet: 2,
      atlasMainnet: 2,
    },
    treasury: {
      default: 3,
      atlasTestnet: 3,
      atlasMainnet: 3,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: "gas-report.txt",
    noColors: true,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "atlasTestnet",
        chainId: 622463,
        urls: {
          apiURL: "https://testnet-explorer.atlaschain.io/api",
          browserURL: "https://testnet-explorer.atlaschain.io",
        },
      },
      {
        network: "atlasMainnet",
        chainId: 622461,
        urls: {
          apiURL: "https://explorer.atlaschain.io/api",
          browserURL: "https://explorer.atlaschain.io",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
