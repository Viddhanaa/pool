/**
 * Blockchain chain configuration for the Viddhana mining pool
 */

/**
 * Chain definition compatible with viem/wagmi
 */
export interface ChainDefinition {
  id: number;
  name: string;
  network: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: {
      http: string[];
      webSocket?: string[];
    };
    public: {
      http: string[];
      webSocket?: string[];
    };
  };
  blockExplorers: {
    default: {
      name: string;
      url: string;
    };
  };
  contracts?: {
    multicall3?: {
      address: string;
      blockCreated: number;
    };
  };
  testnet: boolean;
}

/**
 * Atlas Chain L3 - Custom L3 chain for Viddhana mining pool
 *
 * This is the primary chain where the mining pool operates.
 * It's an L3 rollup built on Arbitrum for low-cost, fast transactions.
 */
export const atlasChainL3: ChainDefinition = {
  id: 421614, // Arbitrum Sepolia for development, will change for production
  name: "Atlas L3",
  network: "atlas-l3",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.atlas-l3.io"],
      webSocket: ["wss://ws.atlas-l3.io"],
    },
    public: {
      http: ["https://rpc.atlas-l3.io"],
      webSocket: ["wss://ws.atlas-l3.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Atlas Explorer",
      url: "https://explorer.atlas-l3.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 1,
    },
  },
  testnet: true, // Set to false for production
};

/**
 * Arbitrum Sepolia testnet configuration
 */
export const arbitrumSepolia: ChainDefinition = {
  id: 421614,
  name: "Arbitrum Sepolia",
  network: "arbitrum-sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
    public: {
      http: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://sepolia.arbiscan.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 81930,
    },
  },
  testnet: true,
};

/**
 * Arbitrum One mainnet configuration
 */
export const arbitrumOne: ChainDefinition = {
  id: 42161,
  name: "Arbitrum One",
  network: "arbitrum",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://arb1.arbitrum.io/rpc"],
    },
    public: {
      http: ["https://arb1.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://arbiscan.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 7654707,
    },
  },
  testnet: false,
};

// =============================================================================
// Contract Addresses
// =============================================================================

/**
 * Contract addresses per chain
 */
export interface ContractAddresses {
  /** Main pool contract */
  pool: string;
  /** License NFT contract */
  license: string;
  /** Payout distribution contract */
  payouts: string;
  /** Governance token contract */
  token: string;
  /** Governance/DAO contract */
  governance: string;
  /** Treasury multi-sig */
  treasury: string;
}

/**
 * Contract addresses for Atlas L3 testnet
 */
export const ATLAS_TESTNET_CONTRACTS: ContractAddresses = {
  pool: "0x0000000000000000000000000000000000000000", // To be deployed
  license: "0x0000000000000000000000000000000000000000", // To be deployed
  payouts: "0x0000000000000000000000000000000000000000", // To be deployed
  token: "0x0000000000000000000000000000000000000000", // To be deployed
  governance: "0x0000000000000000000000000000000000000000", // To be deployed
  treasury: "0x0000000000000000000000000000000000000000", // To be deployed
};

/**
 * Contract addresses for Atlas L3 mainnet
 */
export const ATLAS_MAINNET_CONTRACTS: ContractAddresses = {
  pool: "0x0000000000000000000000000000000000000000", // To be deployed
  license: "0x0000000000000000000000000000000000000000", // To be deployed
  payouts: "0x0000000000000000000000000000000000000000", // To be deployed
  token: "0x0000000000000000000000000000000000000000", // To be deployed
  governance: "0x0000000000000000000000000000000000000000", // To be deployed
  treasury: "0x0000000000000000000000000000000000000000", // To be deployed
};

/**
 * Get contract addresses for a given chain ID
 */
export function getContractAddresses(chainId: number): ContractAddresses | null {
  switch (chainId) {
    case atlasChainL3.id:
      return ATLAS_TESTNET_CONTRACTS;
    case 42161: // Arbitrum One mainnet
      return ATLAS_MAINNET_CONTRACTS;
    default:
      return null;
  }
}

/**
 * Supported chain IDs
 */
export const SUPPORTED_CHAIN_IDS = [
  atlasChainL3.id,
  arbitrumSepolia.id,
  arbitrumOne.id,
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
}

/**
 * Get chain definition by ID
 */
export function getChainById(chainId: number): ChainDefinition | null {
  switch (chainId) {
    case atlasChainL3.id:
      return atlasChainL3;
    case arbitrumSepolia.id:
      return arbitrumSepolia;
    case arbitrumOne.id:
      return arbitrumOne;
    default:
      return null;
  }
}

/**
 * Default chain for the application
 */
export const DEFAULT_CHAIN = atlasChainL3;

/**
 * Default chain ID
 */
export const DEFAULT_CHAIN_ID = atlasChainL3.id;
