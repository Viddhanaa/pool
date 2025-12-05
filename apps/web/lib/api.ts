import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  const token = useAuthStore.getState().token;

  // Build URL with query params
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    let errorCode: string | undefined;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code;
    } catch {
      // Use default error message
    }

    throw new ApiError(errorMessage, response.status, errorCode);
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return {} as T;
  }

  return response.json();
}

// API methods organized by domain
export const api = {
  // Authentication
  auth: {
    login: (data: { wallet: string; signature: string }) =>
      request<{ user: unknown; token: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    register: (data: { wallet: string; email?: string }) =>
      request<{ user: unknown; token: string }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () =>
      request<void>('/api/v1/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ user: unknown }>('/api/v1/auth/me'),
  },

  // Dashboard
  dashboard: {
    overview: () =>
      request<{
        currentHashrate: number;
        avgHashrate: number;
        hashrateTrend: number;
        onlineWorkers: number;
        totalWorkers: number;
        offlineWorkers: number;
        estimated24h: number;
        estimatedMonthly: number;
        unpaidBalance: number;
        nextPayout: string;
      }>('/api/v1/dashboard/overview'),
  },

  // Workers
  workers: {
    list: (params?: { status?: string }) =>
      request<{
        workers: Array<{
          id: string;
          name: string;
          hashrate: number;
          isOnline: boolean;
          lastSeen: string;
          difficulty: number;
          sharesValid: number;
          sharesInvalid: number;
        }>;
        total: number;
      }>('/api/v1/workers', { params }),
    get: (id: string) =>
      request<{
        id: string;
        name: string;
        hashrate: number;
        isOnline: boolean;
        history: Array<{ timestamp: string; hashrate: number }>;
      }>(`/api/v1/workers/${id}`),
    update: (id: string, data: { name?: string; difficulty?: number }) =>
      request(`/api/v1/workers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Statistics
  stats: {
    pool: () =>
      request<{
        hashrate: number;
        networkHashrate: number;
        activeMiners: number;
        difficulty: number;
        blocksFound: number;
        luck: number;
      }>('/api/v1/stats/pool'),
    hashrate: (params: { range: string }) =>
      request<{
        data: Array<{ timestamp: string; hashrate: number }>;
      }>('/api/v1/stats/hashrate', { params }),
  },

  // Blocks
  blocks: {
    list: (params: { page?: number; limit?: number; search?: string }) =>
      request<{
        blocks: Array<{
          id: string;
          height: number;
          hash: string;
          reward: number;
          finder: string;
          foundAt: string;
          confirmations: number;
        }>;
        totalPages: number;
        currentPage: number;
      }>('/api/v1/blocks', { params }),
    getStats: async (): Promise<{
      stats: {
        totalBlocks: number;
        confirmedBlocks: number;
        orphanedBlocks: number;
        pendingBlocks: number;
        blocksLast24h: number;
        blocksLastWeek: number;
        latestHeight: number;
        totalRewards: number;
        totalFees: number;
        orphanRate: number;
      };
    }> => {
      const response = await fetch(`${API_URL}/api/v1/blocks/stats`);
      if (!response.ok) throw new Error('Failed to fetch block stats');
      return response.json();
    },
    get: (id: string) =>
      request(`/api/v1/blocks/${id}`),
  },

  // Leaderboard
  leaderboard: {
    get: (params: { timeRange: string; sortBy: string }) =>
      request<{
        miners: Array<{
          rank: number;
          address: string;
          hashrate: number;
          blocksFound: number;
          earnings: number;
        }>;
      }>('/api/v1/leaderboard', { params }),
  },

  // Payouts
  payouts: {
    list: () =>
      request<{
        payouts: Array<{
          id: string;
          amount: number;
          txHash: string;
          status: string;
          createdAt: string;
        }>;
      }>('/api/v1/payouts'),
    request: (amount: number) =>
      request('/api/v1/payouts', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
  },

  // AI/Prometheus
  ai: {
    projection: () =>
      request<{
        daily: number;
        weekly: number;
        monthly: number;
        confidence: number;
        factors: Array<{ name: string; impact: number }>;
      }>('/api/v1/ai/projection'),
    optimizeWorkers: (workerIds: string[]) =>
      request<{ optimized: number; changes: unknown[] }>('/api/v1/ai/optimize', {
        method: 'POST',
        body: JSON.stringify({ workerIds }),
      }),
  },
};

export { ApiError };
