/**
 * Shared TypeScript types for the Viddhana mining pool platform
 */

// =============================================================================
// User Types
// =============================================================================

/**
 * User entity representing a pool participant
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** Ethereum wallet address */
  walletAddress: string;
  /** Optional display name */
  displayName?: string;
  /** Optional email for notifications */
  email?: string;
  /** User's avatar URL */
  avatarUrl?: string;
  /** Total hashrate across all workers in H/s */
  totalHashrate: number;
  /** Total shares submitted */
  totalShares: number;
  /** Total earnings in wei */
  totalEarnings: string;
  /** Unpaid balance in wei */
  unpaidBalance: string;
  /** NFT license tier */
  licenseTier: number;
  /** Whether the user has verified their email */
  isEmailVerified: boolean;
  /** Whether the user has enabled 2FA */
  is2FAEnabled: boolean;
  /** Account creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastSeenAt: Date;
}

/**
 * User settings preferences
 */
export interface UserSettings {
  /** Notification preferences */
  notifications: {
    email: boolean;
    workerOffline: boolean;
    payoutComplete: boolean;
    weeklyReport: boolean;
  };
  /** Payout preferences */
  payout: {
    /** Minimum payout threshold in wei */
    threshold: string;
    /** Auto-payout enabled */
    autoEnabled: boolean;
  };
  /** Display preferences */
  display: {
    theme: "light" | "dark" | "system";
    currency: "USD" | "EUR" | "GBP" | "JPY";
    hashUnit: "auto" | "H" | "KH" | "MH" | "GH" | "TH" | "PH";
  };
}

// =============================================================================
// Worker Types
// =============================================================================

/**
 * Worker status enum
 */
export type WorkerStatus = "online" | "offline" | "inactive" | "error";

/**
 * Mining worker entity
 */
export interface Worker {
  /** Unique worker identifier */
  id: string;
  /** Owner user ID */
  userId: string;
  /** Worker name assigned by user */
  name: string;
  /** Current status */
  status: WorkerStatus;
  /** Current hashrate in H/s */
  hashrate: number;
  /** Average hashrate over 24h in H/s */
  averageHashrate: number;
  /** Reported hashrate from miner in H/s */
  reportedHashrate: number;
  /** Valid shares submitted */
  validShares: number;
  /** Invalid/stale shares submitted */
  invalidShares: number;
  /** Share rejection rate (0-1) */
  rejectionRate: number;
  /** Mining algorithm */
  algorithm: string;
  /** Last share submission timestamp */
  lastShareAt: Date | null;
  /** Worker connection timestamp */
  connectedAt: Date | null;
  /** Worker creation timestamp */
  createdAt: Date;
  /** Worker IP address (masked for privacy) */
  ipAddress?: string;
  /** Mining software version */
  minerVersion?: string;
  /** GPU/hardware info */
  hardware?: string;
  /** Current difficulty */
  difficulty: number;
}

/**
 * Worker statistics over a time period
 */
export interface WorkerStats {
  workerId: string;
  period: "1h" | "24h" | "7d" | "30d";
  averageHashrate: number;
  totalShares: number;
  validShares: number;
  invalidShares: number;
  uptime: number; // percentage 0-100
  efficiency: number; // percentage 0-100
}

// =============================================================================
// Share Types
// =============================================================================

/**
 * Mining share submission
 */
export interface Share {
  /** Share identifier */
  id: string;
  /** Worker that submitted the share */
  workerId: string;
  /** User ID */
  userId: string;
  /** Block height */
  blockHeight: number;
  /** Share difficulty */
  difficulty: number;
  /** Whether the share was valid */
  isValid: boolean;
  /** Rejection reason if invalid */
  rejectionReason?: string;
  /** Submission timestamp */
  submittedAt: Date;
  /** Nonce value */
  nonce: string;
  /** Share hash */
  hash: string;
}

// =============================================================================
// Block Types
// =============================================================================

/**
 * Block status enum
 */
export type BlockStatus = "pending" | "confirmed" | "orphaned" | "uncle";

/**
 * Mined block entity
 */
export interface Block {
  /** Block identifier */
  id: string;
  /** Block height/number */
  height: number;
  /** Block hash */
  hash: string;
  /** Parent block hash */
  parentHash: string;
  /** Current status */
  status: BlockStatus;
  /** Block difficulty */
  difficulty: string;
  /** Block reward in wei */
  reward: string;
  /** Transaction fees in wei */
  fees: string;
  /** Total reward (block + fees) in wei */
  totalReward: string;
  /** Worker that found the block */
  foundByWorkerId: string;
  /** User that found the block */
  foundByUserId: string;
  /** Number of confirmations */
  confirmations: number;
  /** Block discovery timestamp */
  foundAt: Date;
  /** Network the block was mined on */
  network: string;
  /** Round shares for PPLNS calculation */
  roundShares: number;
}

// =============================================================================
// Payout Types
// =============================================================================

/**
 * Payout status enum
 */
export type PayoutStatusType = "pending" | "processing" | "completed" | "failed";

/**
 * Payout entity
 */
export interface Payout {
  /** Payout identifier */
  id: string;
  /** User receiving the payout */
  userId: string;
  /** Payout amount in wei */
  amount: string;
  /** Transaction hash */
  txHash: string | null;
  /** Current status */
  status: PayoutStatusType;
  /** Failure reason if failed */
  failureReason?: string;
  /** Gas used for the transaction */
  gasUsed?: string;
  /** Gas price in wei */
  gasPrice?: string;
  /** Number of confirmations */
  confirmations: number;
  /** Payout request timestamp */
  requestedAt: Date;
  /** Payout processing timestamp */
  processedAt: Date | null;
  /** Payout completion timestamp */
  completedAt: Date | null;
  /** Destination wallet address */
  toAddress: string;
  /** Network/chain ID */
  chainId: number;
}

// =============================================================================
// WebSocket Event Types
// =============================================================================

/**
 * WebSocket event names
 */
export type WebSocketEventType =
  | "connect"
  | "disconnect"
  | "error"
  | "hashrate:update"
  | "share:submitted"
  | "worker:status"
  | "block:found"
  | "payout:status"
  | "pool:stats"
  | "notification";

/**
 * Base WebSocket event structure
 */
export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  timestamp: Date;
  data: T;
}

/**
 * Hashrate update event data
 */
export interface HashrateUpdateEvent {
  workerId: string;
  hashrate: number;
  reportedHashrate: number;
}

/**
 * Share submitted event data
 */
export interface ShareSubmittedEvent {
  workerId: string;
  isValid: boolean;
  difficulty: number;
}

/**
 * Worker status change event data
 */
export interface WorkerStatusEvent {
  workerId: string;
  status: WorkerStatus;
  previousStatus: WorkerStatus;
}

/**
 * Block found event data
 */
export interface BlockFoundEvent {
  blockHeight: number;
  blockHash: string;
  reward: string;
  foundByWorkerId: string;
}

/**
 * Payout status event data
 */
export interface PayoutStatusEvent {
  payoutId: string;
  status: PayoutStatusType;
  txHash?: string;
}

/**
 * Pool statistics event data
 */
export interface PoolStatsEvent {
  totalHashrate: number;
  activeWorkers: number;
  blocksFound24h: number;
  currentDifficulty: string;
}

/**
 * Notification event data
 */
export interface NotificationEvent {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  actionUrl?: string;
}

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: Date;
  };
}

/**
 * Standard API error response
 */
export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: Date;
  };
}
