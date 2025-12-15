/* eslint-disable @typescript-eslint/no-unused-vars */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Pool Stats
export function usePoolStats() {
  return useQuery({
    queryKey: ['pool-stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ stats: any }>('/stats/pool');
      return response.stats; // Extract stats from response
    },
    refetchInterval: 5000, // Refresh every 5 seconds for realtime updates
    staleTime: 0, // Always consider data stale
  });
}

// Blocks
export function useBlocks(page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: ['blocks', page, limit],
    queryFn: () => apiClient.get('/blocks', { params: { page, limit } }),
    refetchInterval: 30000,
  });
}

export function useRecentBlocks(limit: number = 5) {
  return useQuery({
    queryKey: ['blocks', 'recent', limit],
    queryFn: () => apiClient.get('/blocks/recent', { params: { limit } }),
    refetchInterval: 15000,
  });
}

// Workers (authenticated)
export function useWorkers(userId?: string, page: number = 1, limit: number = 100) {
  return useQuery({
    queryKey: ['workers', userId, page, limit],
    queryFn: () => apiClient.get('/workers', { params: { userId, page, limit } }),
    enabled: !!userId,
    refetchInterval: 15000,
  });
}

// Dashboard Overview (authenticated)
export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => apiClient.get('/dashboard/overview'),
    refetchInterval: 10000,
  });
}

// Payouts (authenticated)
export function usePayouts(userId?: string, page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: ['payouts', userId, page, limit],
    queryFn: () => apiClient.get('/payouts', { params: { userId, page, limit } }),
    enabled: !!userId,
    refetchInterval: 30000,
  });
}

// User balance (authenticated)
export function useUserBalance(userId?: string) {
  return useQuery({
    queryKey: ['user', 'balance', userId],
    queryFn: () => apiClient.get(`/payouts/balance/${userId}`),
    enabled: !!userId,
    refetchInterval: 20000,
  });
}

// Network Stats
export function useNetworkStats() {
  return useQuery({
    queryKey: ['network-stats'],
    queryFn: () => apiClient.get('/stats/network'),
    refetchInterval: 15000,
  });
}

// Hashrate History
export function useHashrateHistory(hours: number = 24) {
  return useQuery({
    queryKey: ['hashrate-history', hours],
    queryFn: () => apiClient.get('/stats/hashrate-history', { params: { hours } }),
    refetchInterval: 30000,
  });
}

// Leaderboard
export function useLeaderboard(type: 'hashrate' | 'blocks' | 'earnings', period: 'day' | 'week' | 'month' | 'all' = 'all', limit: number = 20) {
  return useQuery({
    queryKey: ['leaderboard', type, period, limit],
    queryFn: () => apiClient.get('/stats/leaderboard', { params: { type, period, limit } }),
    refetchInterval: 30000,
  });
}

// Top Miners
export function useTopMiners(limit: number = 5) {
  return useQuery({
    queryKey: ['top-miners', limit],
    queryFn: () => apiClient.get('/stats/top-miners', { params: { limit } }),
    refetchInterval: 30000,
  });
}

