/**
 * API-specific types for request/response handling
 */

import type {
  User,
  Worker,
  Payout,
  Block,
  PaginatedResponse,
  WorkerStats,
} from "./index.js";

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Login request payload
 */
export interface LoginRequest {
  /** Ethereum wallet address */
  walletAddress: string;
  /** Signed message for verification */
  signature: string;
  /** Original message that was signed */
  message: string;
  /** Nonce used in the message */
  nonce: string;
}

/**
 * Login response payload
 */
export interface LoginResponse {
  /** JWT access token */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** User information */
  user: User;
}

/**
 * Registration request payload
 */
export interface RegisterRequest {
  /** Ethereum wallet address */
  walletAddress: string;
  /** Signed message for verification */
  signature: string;
  /** Original message that was signed */
  message: string;
  /** Nonce used in the message */
  nonce: string;
  /** Optional display name */
  displayName?: string;
  /** Optional email for notifications */
  email?: string;
  /** Referral code if any */
  referralCode?: string;
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Nonce request for wallet authentication
 */
export interface NonceRequest {
  walletAddress: string;
}

/**
 * Nonce response for wallet authentication
 */
export interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: Date;
}

// =============================================================================
// Dashboard Types
// =============================================================================

/**
 * Dashboard overview statistics
 */
export interface DashboardOverview {
  /** User statistics */
  user: {
    totalHashrate: number;
    averageHashrate24h: number;
    hashrateChange24h: number; // percentage change
    activeWorkers: number;
    totalWorkers: number;
    validShares24h: number;
    invalidShares24h: number;
    efficiency: number; // percentage 0-100
  };
  /** Earnings statistics */
  earnings: {
    unpaidBalance: string;
    estimatedDaily: string;
    estimatedMonthly: string;
    last24h: string;
    last7d: string;
    last30d: string;
    totalEarnings: string;
    lastPayoutAmount: string;
    lastPayoutAt: Date | null;
  };
  /** Pool statistics */
  pool: {
    totalHashrate: number;
    activeMiners: number;
    activeWorkers: number;
    blocksFound24h: number;
    currentDifficulty: string;
    networkHashrate: number;
    blockReward: string;
    poolFee: number;
    minPayout: string;
    payoutInterval: string;
  };
  /** User's share of the pool */
  poolShare: number; // percentage of total hashrate
  /** NFT license information */
  license: {
    tier: number;
    tierName: string;
    feeDiscount: number;
    bonusRewards: number;
    expiresAt: Date | null;
  };
}

/**
 * Hashrate history data point
 */
export interface HashrateDataPoint {
  timestamp: Date;
  hashrate: number;
  reportedHashrate: number;
}

/**
 * Earnings history data point
 */
export interface EarningsDataPoint {
  timestamp: Date;
  amount: string;
  cumulative: string;
}

/**
 * Dashboard chart data
 */
export interface DashboardChartData {
  hashrate: {
    period: "1h" | "24h" | "7d" | "30d";
    data: HashrateDataPoint[];
  };
  earnings: {
    period: "24h" | "7d" | "30d" | "90d";
    data: EarningsDataPoint[];
  };
}

// =============================================================================
// Workers Types
// =============================================================================

/**
 * Workers list request parameters
 */
export interface WorkersListRequest {
  /** Filter by status */
  status?: "online" | "offline" | "all";
  /** Search by worker name */
  search?: string;
  /** Sort field */
  sortBy?: "name" | "hashrate" | "shares" | "lastShareAt" | "status";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Workers list response
 */
export interface WorkersListResponse extends PaginatedResponse<Worker> {
  /** Summary statistics */
  summary: {
    totalWorkers: number;
    onlineWorkers: number;
    offlineWorkers: number;
    totalHashrate: number;
  };
}

/**
 * Worker detail response
 */
export interface WorkerDetailResponse {
  worker: Worker;
  stats: WorkerStats[];
  recentShares: {
    valid: number;
    invalid: number;
    stale: number;
    lastShareAt: Date | null;
  };
  hashrateHistory: HashrateDataPoint[];
}

/**
 * Worker update request
 */
export interface WorkerUpdateRequest {
  /** New worker name */
  name?: string;
  /** Worker monitoring enabled */
  monitoringEnabled?: boolean;
  /** Offline alert threshold in minutes */
  offlineAlertThreshold?: number;
}

// =============================================================================
// Payouts Types
// =============================================================================

/**
 * Payouts list request parameters
 */
export interface PayoutsListRequest {
  /** Filter by status */
  status?: "pending" | "processing" | "completed" | "failed" | "all";
  /** Start date filter */
  startDate?: Date;
  /** End date filter */
  endDate?: Date;
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Payouts list response
 */
export interface PayoutsResponse extends PaginatedResponse<Payout> {
  /** Summary statistics */
  summary: {
    totalPaid: string;
    pendingAmount: string;
    lastPayoutAt: Date | null;
    nextPayoutEstimate: Date | null;
  };
}

/**
 * Request payout payload
 */
export interface PayoutRequestPayload {
  /** Amount to withdraw in wei (optional, defaults to full balance) */
  amount?: string;
}

// =============================================================================
// Leaderboard Types
// =============================================================================

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  displayName?: string;
  avatarUrl?: string;
  hashrate: number;
  sharesSubmitted: number;
  blocksFound: number;
  totalEarnings: string;
  licenseTier: number;
  isCurrentUser: boolean;
}

/**
 * Leaderboard request parameters
 */
export interface LeaderboardRequest {
  /** Time period for ranking */
  period: "24h" | "7d" | "30d" | "all";
  /** Ranking metric */
  metric: "hashrate" | "shares" | "blocks" | "earnings";
  /** Number of entries to return */
  limit?: number;
}

/**
 * Leaderboard response
 */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserRank?: number;
  totalParticipants: number;
  period: string;
  updatedAt: Date;
}

// =============================================================================
// AI Projection Types
// =============================================================================

/**
 * AI-based mining projection request
 */
export interface AIProjectionRequest {
  /** Hashrate to project for (defaults to current) */
  hashrate?: number;
  /** Number of workers */
  workerCount?: number;
  /** Projection time period in days */
  days?: number;
  /** Whether to include market predictions */
  includeMarketPrediction?: boolean;
}

/**
 * AI projection response
 */
export interface AIProjectionResponse {
  /** Projected earnings */
  earnings: {
    optimistic: string;
    expected: string;
    pessimistic: string;
    currency: "ETH" | "USD";
  };
  /** Confidence interval (0-100) */
  confidence: number;
  /** Factors considered in the projection */
  factors: {
    name: string;
    impact: "positive" | "negative" | "neutral";
    weight: number;
    description: string;
  }[];
  /** Historical accuracy of projections */
  historicalAccuracy: number;
  /** Recommendations from AI */
  recommendations: {
    type: "info" | "warning" | "opportunity";
    title: string;
    description: string;
    potentialImpact?: string;
  }[];
  /** Market predictions if requested */
  marketPrediction?: {
    currentPrice: string;
    predictedPrice: string;
    priceChange: number;
    trend: "bullish" | "bearish" | "neutral";
    volatilityIndex: number;
  };
  /** Model information */
  modelInfo: {
    version: string;
    lastTrainedAt: Date;
    dataPointsUsed: number;
  };
  /** When this projection was generated */
  generatedAt: Date;
  /** Projection valid until */
  validUntil: Date;
}

// =============================================================================
// Blocks Types
// =============================================================================

/**
 * Blocks list request parameters
 */
export interface BlocksListRequest {
  /** Filter by status */
  status?: "pending" | "confirmed" | "orphaned" | "all";
  /** Filter by user (show only user's found blocks) */
  onlyMine?: boolean;
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Blocks list response
 */
export interface BlocksListResponse extends PaginatedResponse<Block> {
  summary: {
    totalBlocks: number;
    confirmedBlocks: number;
    pendingBlocks: number;
    totalRewards: string;
    averageBlockTime: number;
  };
}

// =============================================================================
// Settings Types
// =============================================================================

/**
 * Settings update request
 */
export interface SettingsUpdateRequest {
  /** Display name */
  displayName?: string;
  /** Email address */
  email?: string;
  /** Notification settings */
  notifications?: {
    email?: boolean;
    workerOffline?: boolean;
    payoutComplete?: boolean;
    weeklyReport?: boolean;
  };
  /** Payout settings */
  payout?: {
    threshold?: string;
    autoEnabled?: boolean;
  };
  /** Display preferences */
  display?: {
    theme?: "light" | "dark" | "system";
    currency?: "USD" | "EUR" | "GBP" | "JPY";
    hashUnit?: "auto" | "H" | "KH" | "MH" | "GH" | "TH" | "PH";
  };
}

/**
 * Settings response
 */
export interface SettingsResponse {
  user: User;
  settings: {
    notifications: {
      email: boolean;
      workerOffline: boolean;
      payoutComplete: boolean;
      weeklyReport: boolean;
    };
    payout: {
      threshold: string;
      autoEnabled: boolean;
    };
    display: {
      theme: "light" | "dark" | "system";
      currency: "USD" | "EUR" | "GBP" | "JPY";
      hashUnit: "auto" | "H" | "KH" | "MH" | "GH" | "TH" | "PH";
    };
  };
}
