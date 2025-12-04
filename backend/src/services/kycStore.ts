import { redis } from '../db/redis';

type KycInput = {
  address: string;
  kyc?: boolean;
  provider?: string;
  level?: string;
  meta?: Record<string, unknown>;
};

export type KycRecord = {
  address: string;
  kyc: boolean;
  provider?: string;
  level?: string;
  meta?: Record<string, unknown>;
  updatedAt: string;
};

const keyFor = (address: string) => `kyc:${address.toLowerCase()}`;

export async function getKycStatus(address: string): Promise<KycRecord> {
  const existing = await redis.get(keyFor(address));
  if (!existing) {
    return {
      address: address.toLowerCase(),
      kyc: false,
      updatedAt: new Date(0).toISOString()
    };
  }
  try {
    return JSON.parse(existing) as KycRecord;
  } catch {
    // Corrupted entry: reset to false
    return {
      address: address.toLowerCase(),
      kyc: false,
      updatedAt: new Date(0).toISOString()
    };
  }
}

export async function setKycStatus(input: KycInput): Promise<KycRecord> {
  const record: KycRecord = {
    address: input.address.toLowerCase(),
    kyc: input.kyc ?? true,
    provider: input.provider,
    level: input.level,
    meta: input.meta,
    updatedAt: new Date().toISOString()
  };
  await redis.set(keyFor(input.address), JSON.stringify(record));
  return record;
}
