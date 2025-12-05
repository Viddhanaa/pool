/**
 * Blockchain-related types for smart contracts and transactions
 */

// =============================================================================
// License NFT Types
// =============================================================================

/**
 * NFT License tiers with their benefits
 */
export enum LicenseTier {
  /** No license - standard pool fees */
  NONE = 0,
  /** Bronze tier - 10% fee discount */
  BRONZE = 1,
  /** Silver tier - 25% fee discount, priority support */
  SILVER = 2,
  /** Gold tier - 50% fee discount, priority payouts */
  GOLD = 3,
  /** Platinum tier - 75% fee discount, all benefits */
  PLATINUM = 4,
  /** Diamond tier - 90% fee discount, exclusive features */
  DIAMOND = 5,
}

/**
 * License tier configuration
 */
export interface LicenseTierConfig {
  tier: LicenseTier;
  name: string;
  feeDiscount: number; // percentage discount on pool fees
  bonusRewards: number; // percentage bonus on mining rewards
  priorityPayout: boolean;
  prioritySupport: boolean;
  customWorkerLimit: number;
  aiProjections: boolean;
  apiAccess: boolean;
  price: string; // price in wei
}

/**
 * License tier configurations
 */
export const LICENSE_TIERS: Record<LicenseTier, LicenseTierConfig> = {
  [LicenseTier.NONE]: {
    tier: LicenseTier.NONE,
    name: "None",
    feeDiscount: 0,
    bonusRewards: 0,
    priorityPayout: false,
    prioritySupport: false,
    customWorkerLimit: 10,
    aiProjections: false,
    apiAccess: false,
    price: "0",
  },
  [LicenseTier.BRONZE]: {
    tier: LicenseTier.BRONZE,
    name: "Bronze",
    feeDiscount: 10,
    bonusRewards: 1,
    priorityPayout: false,
    prioritySupport: false,
    customWorkerLimit: 25,
    aiProjections: false,
    apiAccess: false,
    price: "100000000000000000", // 0.1 ETH
  },
  [LicenseTier.SILVER]: {
    tier: LicenseTier.SILVER,
    name: "Silver",
    feeDiscount: 25,
    bonusRewards: 2,
    priorityPayout: false,
    prioritySupport: true,
    customWorkerLimit: 50,
    aiProjections: true,
    apiAccess: false,
    price: "250000000000000000", // 0.25 ETH
  },
  [LicenseTier.GOLD]: {
    tier: LicenseTier.GOLD,
    name: "Gold",
    feeDiscount: 50,
    bonusRewards: 5,
    priorityPayout: true,
    prioritySupport: true,
    customWorkerLimit: 100,
    aiProjections: true,
    apiAccess: true,
    price: "500000000000000000", // 0.5 ETH
  },
  [LicenseTier.PLATINUM]: {
    tier: LicenseTier.PLATINUM,
    name: "Platinum",
    feeDiscount: 75,
    bonusRewards: 10,
    priorityPayout: true,
    prioritySupport: true,
    customWorkerLimit: 250,
    aiProjections: true,
    apiAccess: true,
    price: "1000000000000000000", // 1 ETH
  },
  [LicenseTier.DIAMOND]: {
    tier: LicenseTier.DIAMOND,
    name: "Diamond",
    feeDiscount: 90,
    bonusRewards: 15,
    priorityPayout: true,
    prioritySupport: true,
    customWorkerLimit: 1000,
    aiProjections: true,
    apiAccess: true,
    price: "2500000000000000000", // 2.5 ETH
  },
};

// =============================================================================
// Payout Status Types
// =============================================================================

/**
 * On-chain payout status
 */
export enum PayoutStatus {
  /** Payout is queued but not yet processed */
  QUEUED = 0,
  /** Payout transaction is pending confirmation */
  PENDING = 1,
  /** Payout has been confirmed on-chain */
  CONFIRMED = 2,
  /** Payout failed and needs retry */
  FAILED = 3,
  /** Payout was cancelled by user or admin */
  CANCELLED = 4,
}

/**
 * Payout status labels
 */
export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  [PayoutStatus.QUEUED]: "Queued",
  [PayoutStatus.PENDING]: "Pending",
  [PayoutStatus.CONFIRMED]: "Confirmed",
  [PayoutStatus.FAILED]: "Failed",
  [PayoutStatus.CANCELLED]: "Cancelled",
};

// =============================================================================
// Transaction Types
// =============================================================================

/**
 * Transaction receipt from blockchain
 */
export interface TransactionReceipt {
  /** Transaction hash */
  transactionHash: string;
  /** Transaction index in the block */
  transactionIndex: number;
  /** Block hash containing the transaction */
  blockHash: string;
  /** Block number containing the transaction */
  blockNumber: number;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Contract address (if contract creation) */
  contractAddress: string | null;
  /** Cumulative gas used */
  cumulativeGasUsed: bigint;
  /** Gas used by this transaction */
  gasUsed: bigint;
  /** Effective gas price */
  effectiveGasPrice: bigint;
  /** Transaction status (1 = success, 0 = failure) */
  status: 0 | 1;
  /** Transaction logs */
  logs: TransactionLog[];
  /** Logs bloom filter */
  logsBloom: string;
  /** Transaction type */
  type: string;
}

/**
 * Transaction log entry
 */
export interface TransactionLog {
  /** Log index */
  logIndex: number;
  /** Transaction index */
  transactionIndex: number;
  /** Transaction hash */
  transactionHash: string;
  /** Block hash */
  blockHash: string;
  /** Block number */
  blockNumber: number;
  /** Contract address that emitted the log */
  address: string;
  /** Log data */
  data: string;
  /** Indexed topics */
  topics: string[];
  /** Whether the log was removed due to reorg */
  removed: boolean;
}

// =============================================================================
// Contract Event Types
// =============================================================================

/**
 * PayoutProcessed event
 */
export interface PayoutProcessedEvent {
  recipient: string;
  amount: bigint;
  payoutId: string;
  timestamp: number;
}

/**
 * LicensePurchased event
 */
export interface LicensePurchasedEvent {
  buyer: string;
  tier: LicenseTier;
  tokenId: bigint;
  price: bigint;
  timestamp: number;
}

/**
 * LicenseUpgraded event
 */
export interface LicenseUpgradedEvent {
  owner: string;
  tokenId: bigint;
  oldTier: LicenseTier;
  newTier: LicenseTier;
  pricePaid: bigint;
  timestamp: number;
}

/**
 * ShareSubmitted event (from stratum proxy)
 */
export interface ShareSubmittedEvent {
  miner: string;
  workerId: string;
  difficulty: bigint;
  timestamp: number;
}

/**
 * BlockFound event
 */
export interface BlockFoundEvent {
  miner: string;
  blockNumber: bigint;
  blockHash: string;
  reward: bigint;
  timestamp: number;
}

// =============================================================================
// Contract Types
// =============================================================================

/**
 * Supported contract names
 */
export type ContractName =
  | "ViddhanaPool"
  | "ViddhanaLicense"
  | "ViddhanaPayouts"
  | "ViddhanaGovernance"
  | "ViddhanaToken";

/**
 * Contract deployment info
 */
export interface ContractDeployment {
  name: ContractName;
  address: string;
  deployedAt: number; // block number
  version: string;
  abi: string; // ABI JSON string
}

/**
 * Multi-sig wallet configuration
 */
export interface MultiSigConfig {
  address: string;
  requiredSignatures: number;
  owners: string[];
}
