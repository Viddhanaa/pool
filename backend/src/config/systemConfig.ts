export type ConfigKey =
  | 'min_withdrawal_threshold'
  | 'reward_update_interval_minutes'
  | 'data_retention_days'
  | 'ping_timeout_seconds'
  | 'daily_withdrawal_limit'
  | 'block_reward'
  | 'block_time_sec';

type ConfigDefinition = {
  key: ConfigKey;
  min: number;
  max?: number;
  unit: string;
  allowNull?: boolean;
};

export const CONFIG_DEFINITIONS: Record<ConfigKey, ConfigDefinition> = {
  min_withdrawal_threshold: { key: 'min_withdrawal_threshold', min: 1, max: 1_000_000, unit: 'BTCD' },
  reward_update_interval_minutes: { key: 'reward_update_interval_minutes', min: 1, max: 60, unit: 'minutes' },
  data_retention_days: { key: 'data_retention_days', min: 1, max: 365, unit: 'days' },
  ping_timeout_seconds: { key: 'ping_timeout_seconds', min: 30, max: 600, unit: 'seconds' },
  daily_withdrawal_limit: {
    key: 'daily_withdrawal_limit',
    min: 0,
    max: 5_000_000,
    unit: 'BTCD/day',
    allowNull: true
  },
  block_reward: {
    key: 'block_reward',
    min: 0.000000000000000001,
    max: 1_000_000,
    unit: 'BTCD'
  },
  block_time_sec: {
    key: 'block_time_sec',
    min: 1,
    max: 60,
    unit: 'seconds'
  }
};

export function normalizeConfigValue(
  key: string,
  raw: unknown
): { key: ConfigKey; value: number | null } | { error: string } {
  const def = CONFIG_DEFINITIONS[key as ConfigKey];
  if (!def) {
    return { error: 'Invalid config key' };
  }

  if ((raw === null || raw === undefined || raw === '') && def.allowNull) {
    return { key: def.key, value: null };
  }

  const num = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (raw as number);
  if (!Number.isFinite(num)) {
    return { error: 'Value must be a number' };
  }

  if (num < def.min) {
    return { error: `Value must be >= ${def.min}` };
  }

  if (def.max !== undefined && num > def.max) {
    return { error: `Value must be <= ${def.max}` };
  }

  return { key: def.key, value: num };
}
