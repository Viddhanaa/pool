/**
 * @viddhana/shared - Main exports
 *
 * This package provides shared types, utilities, and configuration
 * for the Viddhana mining pool platform.
 */

// Types
export * from "./types/index.js";
export * from "./types/api.js";
// Export blockchain types excluding duplicates
export {
  LicenseTier,
  type LicenseTierConfig,
  LICENSE_TIERS,
  PayoutStatus,
  PAYOUT_STATUS_LABELS,
  type TransactionReceipt,
  type TransactionLog,
  type PayoutProcessedEvent,
  type LicensePurchasedEvent,
  type LicenseUpgradedEvent,
  type ContractName,
  type ContractDeployment,
  type MultiSigConfig,
} from "./types/blockchain.js";

// Configuration
export * from "./config/chains.js";
export * from "./config/constants.js";

// Validation
export * from "./validation/schemas.js";

// Utilities
export * from "./utils/formatters.js";
export * from "./utils/helpers.js";
export * from "./utils/crypto.js";
