// User types
export interface User {
  id: string;
  walletAddress: string;
  email?: string;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Worker types
export interface Worker {
  id: string;
  name: string;
  hashrate: number;
  avgHashrate24h: number;
  isOnline: boolean;
  lastSeen: string;
  difficulty: number;
  sharesValid: number;
  sharesInvalid: number;
  sharesStale: number;
  uptime: number;
  efficiency: number;
}

export interface WorkerStats {
  total: number;
  online: number;
  offline: number;
  totalHashrate: number;
}

// Block types
export interface Block {
  id: string;
  height: number;
  hash: string;
  reward: number;
  finder: string;
  finderAddress: string;
  foundAt: string;
  confirmations: number;
  isConfirmed: boolean;
  difficulty: number;
  luck: number;
}

// Pool stats types
export interface PoolStats {
  hashrate: number;
  networkHashrate: number;
  activeMiners: number;
  difficulty: number;
  blocksFound: number;
  luck: number;
  lastBlockFoundAt: string;
}

// Payout types
export interface Payout {
  id: string;
  amount: number;
  txHash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  fee: number;
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName?: string;
  hashrate: number;
  blocksFound: number;
  earnings: number;
  isCurrentUser?: boolean;
}

// Chart data types
export interface HashrateDataPoint {
  timestamp: string;
  hashrate: number;
}

export interface EarningsDataPoint {
  timestamp: string;
  amount: number;
  currency: string;
}

// AI Projection types
export interface AIProjection {
  daily: number;
  weekly: number;
  monthly: number;
  confidence: number;
  factors: ProjectionFactor[];
}

export interface ProjectionFactor {
  name: string;
  impact: number;
  description?: string;
}

// Dashboard overview types
export interface DashboardOverview {
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
}

// Real-time event types
export interface RealtimePoolStats {
  hashrate: number;
  networkHashrate: number;
  activeMiners: number;
  difficulty: number;
}

export interface RealtimeWorkerUpdate {
  id: string;
  hashrate: number;
  isOnline: boolean;
  lastSeen: string;
}

export interface RealtimeBlockFound {
  height: number;
  hash: string;
  reward: number;
  finder: string;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Form types
export interface LoginForm {
  wallet: string;
  signature: string;
}

export interface RegisterForm {
  wallet: string;
  email?: string;
}

// Filter types
export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
export type WorkerStatus = 'all' | 'online' | 'offline';
export type SortBy = 'hashrate' | 'blocks' | 'earnings' | 'name';
export type SortOrder = 'asc' | 'desc';
