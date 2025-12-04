export type MinerStats = {
  pending_balance: string;
  total_earned: string;
  active_minutes_today: number;
  current_hashrate: number;
  pool_hashrate: number;
};

export type EarningPoint = { date: string; earned_amount: string };
export type HashratePoint = { timestamp: string; hashrate: string | number };
export type ActivePoint = { date: string; minutes: number };
export type WithdrawalRow = { withdrawal_id: number; amount: string; status: string; tx_hash: string; requested_at: string };
export type ConfigRow = { config_key: string; config_value: unknown; updated_at?: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api';

// JWT removed: no auth headers required
const authHeaders = (): Record<string, string> => ({})

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
}

export async function fetchMinerStats(minerId: number): Promise<MinerStats> {
  const res = await fetch(`${API_BASE}/miner/stats?minerId=${minerId}`);
  return handle<MinerStats>(res);
}

export async function fetchEarningsHistory(minerId: number): Promise<EarningPoint[]> {
  const res = await fetch(`${API_BASE}/miner/earnings-history?minerId=${minerId}`);
  return handle<EarningPoint[]>(res);
}

export async function fetchHashrateHistory(minerId: number): Promise<HashratePoint[]> {
  const res = await fetch(`${API_BASE}/miner/hashrate-history?minerId=${minerId}`);
  return handle<HashratePoint[]>(res);
}

export async function fetchActiveHistory(minerId: number): Promise<ActivePoint[]> {
  const res = await fetch(`${API_BASE}/miner/active-history?minerId=${minerId}`);
  return handle<ActivePoint[]>(res);
}

export async function fetchConfig(): Promise<ConfigRow[]> {
  const res = await fetch(`${API_BASE}/admin/config`);
  return handle<ConfigRow[]>(res);
}

export async function fetchWithdrawals(
  minerId: number,
  page = 0,
  pageSize = 10
): Promise<WithdrawalRow[]> {
  const params = new URLSearchParams({ minerId: String(minerId), limit: String(pageSize), offset: String(page * pageSize) });
  const res = await fetch(`${API_BASE}/withdrawals?${params.toString()}`);
  return handle<WithdrawalRow[]>(res);
}

export async function requestWithdrawal(
  minerId: number,
  amount: number
): Promise<{ withdrawalId: number }> {
  const res = await fetch(`${API_BASE}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minerId, amount })
  });
  return handle<{ withdrawalId: number }>(res);
}

// Signature-based flow removed with JWT

// Frictionless miner registration (no wallet signature required)
export async function registerOpen(walletAddress: string, hashrate: number, deviceType = 'web') {
  const res = await fetch(`${API_BASE}/auth/register-open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress, hashrate, device_type: deviceType })
  });
  return handle<{ minerId: number }>(res);
}

export async function pingMiner(minerId: number, hashrate: number, deviceType: string) {
  const res = await fetch(`${API_BASE}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ miner_id: minerId, hashrate, device_type: deviceType })
  });
  return handle<{ ok: boolean; updated_at?: string }>(res);
}
