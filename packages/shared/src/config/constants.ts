/**
 * Application constants and configuration values
 */

// =============================================================================
// API Configuration
// =============================================================================

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    NONCE: "/auth/nonce",
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    REFRESH: "/auth/refresh",
    LOGOUT: "/auth/logout",
    VERIFY_EMAIL: "/auth/verify-email",
    RESEND_VERIFICATION: "/auth/resend-verification",
  },
  // User
  USER: {
    PROFILE: "/user/profile",
    SETTINGS: "/user/settings",
    NOTIFICATIONS: "/user/notifications",
    API_KEYS: "/user/api-keys",
  },
  // Dashboard
  DASHBOARD: {
    OVERVIEW: "/dashboard/overview",
    CHARTS: "/dashboard/charts",
    EARNINGS: "/dashboard/earnings",
  },
  // Workers
  WORKERS: {
    LIST: "/workers",
    DETAIL: "/workers/:id",
    STATS: "/workers/:id/stats",
    UPDATE: "/workers/:id",
    DELETE: "/workers/:id",
  },
  // Payouts
  PAYOUTS: {
    LIST: "/payouts",
    REQUEST: "/payouts/request",
    DETAIL: "/payouts/:id",
    ESTIMATE: "/payouts/estimate",
  },
  // Blocks
  BLOCKS: {
    LIST: "/blocks",
    DETAIL: "/blocks/:id",
  },
  // Leaderboard
  LEADERBOARD: {
    LIST: "/leaderboard",
    USER_RANK: "/leaderboard/me",
  },
  // AI Projections
  AI: {
    PROJECTIONS: "/ai/projections",
    RECOMMENDATIONS: "/ai/recommendations",
    MARKET: "/ai/market",
  },
  // Pool
  POOL: {
    STATS: "/pool/stats",
    HISTORY: "/pool/history",
  },
  // License NFT
  LICENSE: {
    INFO: "/license/info",
    TIERS: "/license/tiers",
    PURCHASE: "/license/purchase",
    UPGRADE: "/license/upgrade",
  },
  // WebSocket
  WS: {
    CONNECT: "/ws",
  },
} as const;

/**
 * API base URLs for different environments
 */
export const API_BASE_URLS = {
  development: "http://localhost:3001/api/v1",
  staging: "https://api.staging.viddhana.io/v1",
  production: "https://api.viddhana.io/v1",
} as const;

/**
 * WebSocket URLs for different environments
 */
export const WS_BASE_URLS = {
  development: "ws://localhost:3001",
  staging: "wss://ws.staging.viddhana.io",
  production: "wss://ws.viddhana.io",
} as const;

// =============================================================================
// Feature Flags
// =============================================================================

/**
 * Feature flags configuration
 */
export const FEATURE_FLAGS = {
  /** Enable AI-powered projections */
  AI_PROJECTIONS: true,
  /** Enable governance voting */
  GOVERNANCE: false,
  /** Enable referral program */
  REFERRALS: true,
  /** Enable license NFT purchases */
  LICENSE_NFT: true,
  /** Enable multi-currency display */
  MULTI_CURRENCY: true,
  /** Enable dark mode */
  DARK_MODE: true,
  /** Enable WebSocket real-time updates */
  REALTIME_UPDATES: true,
  /** Enable email notifications */
  EMAIL_NOTIFICATIONS: true,
  /** Enable 2FA authentication */
  TWO_FACTOR_AUTH: true,
  /** Enable API key management */
  API_KEYS: true,
  /** Enable advanced analytics */
  ADVANCED_ANALYTICS: true,
  /** Enable worker monitoring alerts */
  WORKER_ALERTS: true,
  /** Enable leaderboard */
  LEADERBOARD: true,
} as const;

// =============================================================================
// Default Values
// =============================================================================

/**
 * Pagination defaults
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Worker defaults
 */
export const WORKER_DEFAULTS = {
  /** Default offline threshold in minutes */
  OFFLINE_THRESHOLD_MINUTES: 5,
  /** Maximum workers per user (can be increased with license) */
  MAX_WORKERS: 10,
  /** Hashrate update interval in seconds */
  HASHRATE_UPDATE_INTERVAL: 60,
  /** Share difficulty target */
  DEFAULT_DIFFICULTY: 8192,
} as const;

/**
 * Payout defaults
 */
export const PAYOUT_DEFAULTS = {
  /** Minimum payout amount in wei (0.01 ETH) */
  MIN_PAYOUT: "10000000000000000",
  /** Default payout threshold in wei (0.05 ETH) */
  DEFAULT_THRESHOLD: "50000000000000000",
  /** Maximum payout threshold in wei (10 ETH) */
  MAX_THRESHOLD: "10000000000000000000",
  /** Payout processing interval in hours */
  PROCESSING_INTERVAL_HOURS: 4,
  /** Required confirmations for payout */
  REQUIRED_CONFIRMATIONS: 12,
} as const;

/**
 * Pool configuration
 */
export const POOL_CONFIG = {
  /** Pool fee percentage (1 = 1%) */
  FEE_PERCENTAGE: 1,
  /** PPLNS window in blocks */
  PPLNS_WINDOW: 1000,
  /** Block confirmation requirement */
  BLOCK_CONFIRMATIONS: 100,
  /** Stratum server ports */
  STRATUM_PORTS: {
    LOW_DIFFICULTY: 3333,
    MEDIUM_DIFFICULTY: 5555,
    HIGH_DIFFICULTY: 7777,
  },
  /** Supported algorithms */
  SUPPORTED_ALGORITHMS: ["ethash", "etchash", "kawpow"] as const,
} as const;

/**
 * Authentication configuration
 */
export const AUTH_CONFIG = {
  /** Access token expiry in seconds (15 minutes) */
  ACCESS_TOKEN_EXPIRY: 900,
  /** Refresh token expiry in seconds (7 days) */
  REFRESH_TOKEN_EXPIRY: 604800,
  /** Nonce expiry in seconds (5 minutes) */
  NONCE_EXPIRY: 300,
  /** Maximum login attempts before lockout */
  MAX_LOGIN_ATTEMPTS: 5,
  /** Lockout duration in seconds (15 minutes) */
  LOCKOUT_DURATION: 900,
  /** Session inactivity timeout in seconds (1 hour) */
  SESSION_TIMEOUT: 3600,
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  /** General API rate limit (requests per minute) */
  API_RPM: 100,
  /** Authentication rate limit (requests per minute) */
  AUTH_RPM: 10,
  /** WebSocket message rate limit (messages per minute) */
  WS_MPM: 60,
  /** Payout request rate limit (requests per hour) */
  PAYOUT_RPH: 5,
} as const;

/**
 * UI/Display configuration
 */
export const UI_CONFIG = {
  /** Chart data point limits */
  CHART_POINTS: {
    HASHRATE_1H: 60,
    HASHRATE_24H: 288,
    HASHRATE_7D: 168,
    HASHRATE_30D: 720,
    EARNINGS_24H: 24,
    EARNINGS_7D: 7,
    EARNINGS_30D: 30,
  },
  /** Toast notification duration in ms */
  TOAST_DURATION: 5000,
  /** Auto-refresh intervals in ms */
  REFRESH_INTERVALS: {
    DASHBOARD: 30000,
    WORKERS: 15000,
    POOL_STATS: 60000,
    LEADERBOARD: 120000,
  },
  /** Date format strings */
  DATE_FORMATS: {
    SHORT: "MMM d, yyyy",
    LONG: "MMMM d, yyyy 'at' h:mm a",
    TIME: "h:mm a",
    ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  },
} as const;

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
  /** Display name length */
  DISPLAY_NAME: {
    MIN: 3,
    MAX: 30,
  },
  /** Worker name length */
  WORKER_NAME: {
    MIN: 1,
    MAX: 50,
  },
  /** Email length */
  EMAIL: {
    MAX: 255,
  },
  /** API key name length */
  API_KEY_NAME: {
    MIN: 1,
    MAX: 50,
  },
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  // Authentication errors (1xxx)
  AUTH_INVALID_SIGNATURE: "AUTH_1001",
  AUTH_EXPIRED_NONCE: "AUTH_1002",
  AUTH_INVALID_TOKEN: "AUTH_1003",
  AUTH_EXPIRED_TOKEN: "AUTH_1004",
  AUTH_ACCOUNT_LOCKED: "AUTH_1005",
  AUTH_2FA_REQUIRED: "AUTH_1006",
  AUTH_2FA_INVALID: "AUTH_1007",
  // Validation errors (2xxx)
  VALIDATION_FAILED: "VAL_2001",
  VALIDATION_INVALID_ADDRESS: "VAL_2002",
  VALIDATION_INVALID_AMOUNT: "VAL_2003",
  // Resource errors (3xxx)
  RESOURCE_NOT_FOUND: "RES_3001",
  RESOURCE_ALREADY_EXISTS: "RES_3002",
  RESOURCE_LIMIT_EXCEEDED: "RES_3003",
  // Rate limit errors (4xxx)
  RATE_LIMIT_EXCEEDED: "RATE_4001",
  // Server errors (5xxx)
  INTERNAL_ERROR: "SRV_5001",
  SERVICE_UNAVAILABLE: "SRV_5002",
  DATABASE_ERROR: "SRV_5003",
  // Blockchain errors (6xxx)
  BLOCKCHAIN_TX_FAILED: "BC_6001",
  BLOCKCHAIN_INSUFFICIENT_FUNDS: "BC_6002",
  BLOCKCHAIN_NONCE_TOO_LOW: "BC_6003",
} as const;

/**
 * Application metadata
 */
export const APP_METADATA = {
  NAME: "Viddhana Pool",
  DESCRIPTION: "AI-Powered Decentralized Mining Pool",
  VERSION: "1.0.0",
  SUPPORT_EMAIL: "support@viddhana.io",
  DOCS_URL: "https://docs.viddhana.io",
  GITHUB_URL: "https://github.com/viddhana",
  DISCORD_URL: "https://discord.gg/viddhana",
  TWITTER_URL: "https://twitter.com/viddhana",
} as const;
