import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
};

export const config = {
  port: numberFromEnv('PORT', 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/asdminer',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  adminWallet: process.env.ADMIN_WALLET_ADDRESS ?? '',
  withdrawSharedSecret: process.env.WITHDRAW_SECRET ?? '',
  minWithdrawalThreshold: numberFromEnv('MIN_WITHDRAWAL_THRESHOLD', 100),
  rewardUpdateIntervalMinutes: numberFromEnv('REWARD_UPDATE_INTERVAL_MINUTES', 5),
  blockReward: numberFromEnv('BLOCK_REWARD', 2), // BTCD per block
  blockTimeSec: numberFromEnv('BLOCK_TIME_SEC', 5), // seconds per block
  pingOfflineTimeoutSeconds: numberFromEnv('PING_OFFLINE_TIMEOUT_SECONDS', 300), // 5 minutes
  dataRetentionDays: numberFromEnv('DATA_RETENTION_DAYS', 7),
  dailyWithdrawalLimit: numberFromEnv('DAILY_WITHDRAWAL_LIMIT', 0) || null,
  rpcUrl: process.env.RPC_URL ?? 'http://localhost:8545',
  rpcUrls: (process.env.RPC_URLS ?? process.env.RPC_URL ?? 'http://localhost:8545')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'changeme',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET ?? process.env.JWT_SECRET ?? 'changeme'
};
