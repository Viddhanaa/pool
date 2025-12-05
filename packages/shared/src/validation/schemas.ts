/**
 * Zod validation schemas for API request validation
 */

import { z } from "zod";
import { VALIDATION_LIMITS } from "../config/constants.js";

// =============================================================================
// Common Validators
// =============================================================================

/**
 * Ethereum address validation regex
 */
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

/**
 * Ethereum address schema
 */
export const ethereumAddressSchema = z
  .string()
  .regex(ethereumAddressRegex, "Invalid Ethereum address format");

/**
 * Hex string schema
 */
export const hexStringSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, "Invalid hex string format");

/**
 * Wei amount schema (big integer as string)
 */
export const weiAmountSchema = z
  .string()
  .regex(/^\d+$/, "Amount must be a valid wei value (positive integer string)");

/**
 * Positive number schema
 */
export const positiveNumberSchema = z.number().positive();

/**
 * Email schema
 */
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(VALIDATION_LIMITS.EMAIL.MAX);

/**
 * Display name schema
 */
export const displayNameSchema = z
  .string()
  .min(
    VALIDATION_LIMITS.DISPLAY_NAME.MIN,
    `Display name must be at least ${VALIDATION_LIMITS.DISPLAY_NAME.MIN} characters`
  )
  .max(
    VALIDATION_LIMITS.DISPLAY_NAME.MAX,
    `Display name must be at most ${VALIDATION_LIMITS.DISPLAY_NAME.MAX} characters`
  )
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Display name can only contain letters, numbers, underscores, and hyphens"
  );

/**
 * Worker name schema
 */
export const workerNameSchema = z
  .string()
  .min(
    VALIDATION_LIMITS.WORKER_NAME.MIN,
    `Worker name must be at least ${VALIDATION_LIMITS.WORKER_NAME.MIN} character`
  )
  .max(
    VALIDATION_LIMITS.WORKER_NAME.MAX,
    `Worker name must be at most ${VALIDATION_LIMITS.WORKER_NAME.MAX} characters`
  )
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Worker name can only contain letters, numbers, underscores, hyphens, and periods"
  );

// =============================================================================
// Authentication Schemas
// =============================================================================

/**
 * Login request schema
 */
export const loginSchema = z.object({
  walletAddress: ethereumAddressSchema,
  signature: hexStringSchema.min(132, "Signature must be at least 132 characters"),
  message: z.string().min(1, "Message is required"),
  nonce: z.string().min(16, "Nonce must be at least 16 characters"),
});

export type LoginSchemaType = z.infer<typeof loginSchema>;

/**
 * Register request schema
 */
export const registerSchema = z.object({
  walletAddress: ethereumAddressSchema,
  signature: hexStringSchema.min(132, "Signature must be at least 132 characters"),
  message: z.string().min(1, "Message is required"),
  nonce: z.string().min(16, "Nonce must be at least 16 characters"),
  displayName: displayNameSchema.optional(),
  email: emailSchema.optional(),
  referralCode: z
    .string()
    .length(8, "Referral code must be exactly 8 characters")
    .regex(/^[A-Z0-9]+$/, "Referral code must be alphanumeric uppercase")
    .optional(),
});

export type RegisterSchemaType = z.infer<typeof registerSchema>;

/**
 * Nonce request schema
 */
export const nonceRequestSchema = z.object({
  walletAddress: ethereumAddressSchema,
});

export type NonceRequestSchemaType = z.infer<typeof nonceRequestSchema>;

/**
 * Refresh token schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RefreshTokenSchemaType = z.infer<typeof refreshTokenSchema>;

// =============================================================================
// Worker Schemas
// =============================================================================

/**
 * Worker update request schema
 */
export const workerUpdateSchema = z.object({
  name: workerNameSchema.optional(),
  monitoringEnabled: z.boolean().optional(),
  offlineAlertThreshold: z
    .number()
    .min(1, "Threshold must be at least 1 minute")
    .max(1440, "Threshold cannot exceed 24 hours (1440 minutes)")
    .optional(),
});

export type WorkerUpdateSchemaType = z.infer<typeof workerUpdateSchema>;

/**
 * Workers list query schema
 */
export const workersListQuerySchema = z.object({
  status: z.enum(["online", "offline", "all"]).optional().default("all"),
  search: z.string().max(50).optional(),
  sortBy: z
    .enum(["name", "hashrate", "shares", "lastShareAt", "status"])
    .optional()
    .default("hashrate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type WorkersListQuerySchemaType = z.infer<typeof workersListQuerySchema>;

// =============================================================================
// Payout Schemas
// =============================================================================

/**
 * Payout request schema
 */
export const payoutRequestSchema = z
  .object({
    amount: weiAmountSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.amount) {
        const amount = BigInt(data.amount);
        // Minimum 0.01 ETH
        return amount >= BigInt("10000000000000000");
      }
      return true;
    },
    {
      message: "Payout amount must be at least 0.01 ETH",
      path: ["amount"],
    }
  );

export type PayoutRequestSchemaType = z.infer<typeof payoutRequestSchema>;

/**
 * Payouts list query schema
 */
export const payoutsListQuerySchema = z.object({
  status: z
    .enum(["pending", "processing", "completed", "failed", "all"])
    .optional()
    .default("all"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type PayoutsListQuerySchemaType = z.infer<typeof payoutsListQuerySchema>;

// =============================================================================
// Settings Schemas
// =============================================================================

/**
 * Notification settings schema
 */
export const notificationSettingsSchema = z.object({
  email: z.boolean().optional(),
  workerOffline: z.boolean().optional(),
  payoutComplete: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
});

/**
 * Payout settings schema
 */
export const payoutSettingsSchema = z
  .object({
    threshold: weiAmountSchema.optional(),
    autoEnabled: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.threshold) {
        const threshold = BigInt(data.threshold);
        const min = BigInt("10000000000000000"); // 0.01 ETH
        const max = BigInt("10000000000000000000"); // 10 ETH
        return threshold >= min && threshold <= max;
      }
      return true;
    },
    {
      message: "Payout threshold must be between 0.01 and 10 ETH",
      path: ["threshold"],
    }
  );

/**
 * Display settings schema
 */
export const displaySettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "JPY"]).optional(),
  hashUnit: z.enum(["auto", "H", "KH", "MH", "GH", "TH", "PH"]).optional(),
});

/**
 * Settings update schema
 */
export const settingsUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  email: emailSchema.optional().nullable(),
  notifications: notificationSettingsSchema.optional(),
  payout: payoutSettingsSchema.optional(),
  display: displaySettingsSchema.optional(),
});

export type SettingsUpdateSchemaType = z.infer<typeof settingsUpdateSchema>;

// =============================================================================
// Leaderboard Schemas
// =============================================================================

/**
 * Leaderboard query schema
 */
export const leaderboardQuerySchema = z.object({
  period: z.enum(["24h", "7d", "30d", "all"]).optional().default("24h"),
  metric: z
    .enum(["hashrate", "shares", "blocks", "earnings"])
    .optional()
    .default("hashrate"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type LeaderboardQuerySchemaType = z.infer<typeof leaderboardQuerySchema>;

// =============================================================================
// AI Projection Schemas
// =============================================================================

/**
 * AI projection request schema
 */
export const aiProjectionSchema = z.object({
  hashrate: positiveNumberSchema.optional(),
  workerCount: z.number().int().min(1).max(1000).optional(),
  days: z.number().int().min(1).max(365).optional().default(30),
  includeMarketPrediction: z.boolean().optional().default(false),
});

export type AIProjectionSchemaType = z.infer<typeof aiProjectionSchema>;

// =============================================================================
// Pagination Schema
// =============================================================================

/**
 * Generic pagination query schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type PaginationSchemaType = z.infer<typeof paginationSchema>;

// =============================================================================
// ID Parameter Schema
// =============================================================================

/**
 * UUID parameter schema
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export type UuidParamSchemaType = z.infer<typeof uuidParamSchema>;

/**
 * Ethereum address parameter schema
 */
export const addressParamSchema = z.object({
  address: ethereumAddressSchema,
});

export type AddressParamSchemaType = z.infer<typeof addressParamSchema>;
