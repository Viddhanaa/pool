export type ConfigKey =
  | 'min_withdrawal_threshold'
  | 'reward_update_interval_minutes'
  | 'data_retention_days'
  | 'ping_timeout_seconds'
  | 'daily_withdrawal_limit';

export type ConfigRow = { config_key: ConfigKey; config_value: unknown; updated_at: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api';

let authToken: string | null = null;

const safeStorage = typeof localStorage === 'undefined' ? null : localStorage;

export function loadStoredToken(): string | null {
  if (!safeStorage) return null;
  const stored = safeStorage.getItem('adminToken');
  if (stored) {
    authToken = stored;
  }
  return stored ?? null;
}

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    safeStorage?.setItem('adminToken', token);
  } else {
    safeStorage?.removeItem('adminToken');
  }
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = options.headers ? { ...(options.headers as Record<string, string>) } : {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let errorMessage = 'Request failed';
    try {
      const data = await res.json();
      if (data?.error) errorMessage = data.error;
    } catch (_err) {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  // Some endpoints (like retry) may not return a body
  try {
    return (await res.json()) as T;
  } catch (_err) {
    return {} as T;
  }
}

export async function login(password: string) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    throw new Error('Invalid password');
  }
  const data = (await res.json()) as { token: string };
  setToken(data.token);
  return data.token;
}

export async function fetchConfig() {
  return request<ConfigRow[]>('/admin/config');
}

export async function saveConfig(key: string, value: unknown) {
  return request('/admin/config', {
    method: 'POST',
    body: JSON.stringify({ key, value })
  });
}

export async function fetchAdminMetrics() {
  return request<{
    active_miners: number;
    pool_hashrate: number;
    pending_withdrawals: number;
    viddhana_distributed: { today: string; week: string; month: string };
  }>('/admin/metrics');
}

export async function health() {
  return request<{ ok: boolean; postgres: any; redis: any; geth: any }>('/admin/health');
}

export async function listAdminWithdrawals() {
  return request<
    Array<{
      withdrawal_id: number;
      miner_id: number;
      amount: string;
      status: string;
      requested_at: string;
      tx_hash?: string | null;
      error_message?: string | null;
    }>
  >('/admin/withdrawals');
}

export async function retryWithdrawal(id: number) {
  return request(`/admin/withdrawals/${id}/retry`, { method: 'POST' });
}

export async function markWithdrawalFailed(id: number, reason?: string) {
  return request(`/admin/withdrawals/${id}/mark-failed`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}
