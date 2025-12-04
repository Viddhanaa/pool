import { config as envConfig } from '../config/env';
import { query } from '../db/postgres';

export type ConfigShape = {
  minWithdrawalThreshold: number;
  rewardUpdateIntervalMinutes: number;
  dataRetentionDays: number;
  pingTimeoutSeconds: number;
  dailyWithdrawalLimit: number | null;
  blockReward: number;
  blockTimeSec: number;
};

const CACHE_TTL_MS = 30_000;
let cachedConfig: ConfigShape | null = null;
let cachedAt = 0;

const keyMap: Record<string, keyof ConfigShape> = {
  min_withdrawal_threshold: 'minWithdrawalThreshold',
  reward_update_interval_minutes: 'rewardUpdateIntervalMinutes',
  data_retention_days: 'dataRetentionDays',
  ping_timeout_seconds: 'pingTimeoutSeconds',
  daily_withdrawal_limit: 'dailyWithdrawalLimit',
  block_reward: 'blockReward',
  block_time_sec: 'blockTimeSec'
};

export function clearConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

const coerceNumber = (val: unknown): number | null => {
  const n = typeof val === 'string' ? Number(val) : (val as number);
  return Number.isFinite(n) ? n : null;
};

export async function getConfig(): Promise<ConfigShape> {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  // Compute defaults at call time to reflect any test-time mutations of envConfig
  const defaults: ConfigShape = {
    minWithdrawalThreshold: envConfig.minWithdrawalThreshold,
    rewardUpdateIntervalMinutes: envConfig.rewardUpdateIntervalMinutes,
    dataRetentionDays: envConfig.dataRetentionDays ?? 7,
    pingTimeoutSeconds: envConfig.pingOfflineTimeoutSeconds,
    dailyWithdrawalLimit: envConfig.dailyWithdrawalLimit ?? null,
    blockReward: envConfig.blockReward,
    blockTimeSec: envConfig.blockTimeSec
  };

  const rows = await query<{ config_key: string; config_value: unknown }>(
    `SELECT config_key, config_value FROM system_config`
  );

  const next: ConfigShape = { ...defaults };
  for (const row of rows) {
    const mapped = keyMap[row.config_key];
    if (!mapped) continue;
    const num = coerceNumber((row as any).config_value);
    if (num === null) continue;
    (next as any)[mapped] = num;
  }

  cachedConfig = next;
  cachedAt = now;
  return next;
}
