import { db } from '../lib/db.js';
import { cache } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { Prisma } from '@prisma/client';

const logger = createChildLogger('stats-service');

// Miner API URL for fetching real-time mining stats
const MINER_API_URL = process.env.MINER_API_URL || 'http://localhost:3006';

// Ethereum RPC URL for blockchain data
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'http://localhost:8545';

// Type for Miner API stats response
interface MinerApiStats {
  totalMiners: number;
  activeMiners: number;
  totalHashrate: number;
  tokenomics?: {
    totalSupply: number;
    circulatingSupply: number;
    dailyEmission: number;
    rewardsPool: number;
  };
}

// Type for blockchain data
interface BlockchainData {
  latestBlockNumber: number;
  latestBlockTime: Date;
  difficulty: number;
  totalTransactions: number;
}

// Helper to fetch from Miner API
async function fetchMinerStats(): Promise<MinerApiStats | null> {
  try {
    const response = await fetch(`${MINER_API_URL}/api/stats/pool`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json() as MinerApiStats;
      return data;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to fetch miner stats: ${errorMessage}`);
  }
  return null;
}

// Helper to make JSON-RPC call to Ethereum node
async function ethRpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(ETH_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
    signal: AbortSignal.timeout(5000),
  });
  
  if (!response.ok) {
    throw new Error(`RPC call failed: ${response.statusText}`);
  }
  
  const data = await response.json() as { result?: unknown; error?: { message: string } };
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return data.result;
}

// Helper to fetch blockchain data from Ethereum node
async function fetchBlockchainData(): Promise<BlockchainData | null> {
  try {
    // Get latest block
    const block = await ethRpcCall('eth_getBlockByNumber', ['latest', false]) as {
      number: string;
      timestamp: string;
      difficulty: string;
      transactions: string[];
    } | null;
    
    if (!block) {
      return null;
    }
    
    const blockNumber = parseInt(block.number, 16);
    const timestamp = parseInt(block.timestamp, 16);
    const difficulty = parseInt(block.difficulty, 16);
    
    // Get transaction count (approximate - sum of last 100 blocks or use eth_getBlockTransactionCountByNumber)
    let totalTransactions = 0;
    
    // Get transaction counts for recent blocks (last 24 hours worth, ~8640 blocks at 10s each)
    // For performance, just count transactions in the last 100 blocks
    const blocksToCheck = Math.min(100, blockNumber);
    const txCountPromises: Promise<number>[] = [];
    
    for (let i = 0; i < blocksToCheck; i++) {
      const blockNum = `0x${(blockNumber - i).toString(16)}`;
      txCountPromises.push(
        ethRpcCall('eth_getBlockTransactionCountByNumber', [blockNum])
          .then(count => parseInt(count as string, 16))
          .catch(() => 0)
      );
    }
    
    const txCounts = await Promise.all(txCountPromises);
    totalTransactions = txCounts.reduce((sum, count) => sum + count, 0);
    
    return {
      latestBlockNumber: blockNumber,
      latestBlockTime: new Date(timestamp * 1000),
      difficulty,
      totalTransactions,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to fetch blockchain data: ${errorMessage}`);
    return null;
  }
}

export interface PoolStats {
  hashrate: number;
  activeWorkers: number;
  activeMiners: number;
  blocksFound: number;
  totalPaid: number;
  difficulty: number;
  networkHashrate: number;
  lastBlockTime: Date | null;
  poolFee: number;
  // New blockchain data fields
  latestBlockNumber: number;
  totalTransactions: number;
  // Tokenomics & earnings
  dailyEmission: number;
  rewardsPool: number;
  estimatedDailyEarnings: number;
}

export interface HashrateHistory {
  timestamp: Date;
  hashrate: number;
}

export interface TopMiner {
  rank: number;
  address: string;
  hashrate: number;
  blocksFound: number;
  earnings: number;
  percentage: number;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  value: number;
  percentage: number;
  change: number;
}

export type LeaderboardType = 'hashrate' | 'blocks' | 'earnings';
export type LeaderboardPeriod = 'day' | 'week' | 'month' | 'all';

export interface EarningsData {
  balance: number;
  pending: number;
  paid: number;
  last24h: number;
  last7d: number;
  last30d: number;
}

export interface UserHashrateStats {
  current: number;
  average24h: number;
  peak24h: number;
  history: HashrateHistory[];
}

export class StatsService {
  private readonly CACHE_TTL = 5; // 5 seconds for real-time stats
  private readonly HISTORY_CACHE_TTL = 60; // 1 minute for historical data

  /**
   * Get pool statistics
   * Fetches real-time data from Miner API, blockchain node, and merges with local database stats
   */
  async getPoolStats(): Promise<PoolStats> {
    const cacheKey = 'stats:pool';
    const cached = await cache.get<PoolStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Fetch from local DB, Miner API, and blockchain node in parallel
    const [
      activeWorkers,
      activeMiners,
      latestBlock,
      blocksFound,
      totalPaidResult,
      latestPoolStats,
      hashrateResult,
      minerApiStats,
      blockchainData,
    ] = await Promise.all([
      db.worker.count({ where: { isOnline: true } }),
      db.user.count({
        where: {
          workers: { some: { isOnline: true } },
        },
      }),
      db.block.findFirst({
        where: { isConfirmed: true },
        orderBy: { foundAt: 'desc' },
      }),
      db.block.count({ where: { isConfirmed: true } }),
      db.payout.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      db.poolStats.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
      db.worker.aggregate({
        where: { isOnline: true },
        _sum: { hashrate: true },
      }),
      fetchMinerStats(),
      fetchBlockchainData(),
    ]);

    // Use Miner API data if available, otherwise fall back to local DB
    const finalHashrate = minerApiStats?.totalHashrate || Number(hashrateResult._sum.hashrate || 0);
    const finalActiveMiners = minerApiStats?.activeMiners || activeMiners;
    const finalActiveWorkers = minerApiStats?.activeMiners || activeWorkers; // Miner API treats miners as workers

    // Use blockchain data if available
    const finalDifficulty = blockchainData?.difficulty || (latestPoolStats ? Number(latestPoolStats.difficulty) : 0);
    const finalBlockNumber = blockchainData?.latestBlockNumber || 0;
    const finalBlockTime = blockchainData?.latestBlockTime || latestBlock?.foundAt || null;
    const finalTotalTransactions = blockchainData?.totalTransactions || 0;
    
    // For Viddhana private chain, pool hashrate = network hashrate (we are the only pool)
    const finalNetworkHashrate = finalHashrate;

    // Tokenomics data from Miner API
    const dailyEmission = minerApiStats?.tokenomics?.dailyEmission || 100000; // Default 100k BTCD/day
    const rewardsPool = minerApiStats?.tokenomics?.rewardsPool || 100000000;
    
    // Calculate estimated daily earnings for pool (all miners share the daily emission)
    // If there are active miners, each miner gets: dailyEmission / activeMiners
    const estimatedDailyEarnings = finalActiveMiners > 0 
      ? dailyEmission / finalActiveMiners 
      : dailyEmission;

    logger.info(`Pool stats: Miner API ${minerApiStats ? 'OK' : 'N/A'}, Blockchain ${blockchainData ? 'OK' : 'N/A'}, hashrate=${finalHashrate}, block=${finalBlockNumber}, dailyEmission=${dailyEmission}`);

    const stats: PoolStats = {
      hashrate: finalHashrate,
      activeWorkers: finalActiveWorkers,
      activeMiners: finalActiveMiners,
      blocksFound: blocksFound || finalBlockNumber, // Use blockchain block number if no pool blocks
      totalPaid: Number(totalPaidResult._sum.amount || 0),
      difficulty: finalDifficulty,
      networkHashrate: finalNetworkHashrate,
      lastBlockTime: finalBlockTime,
      poolFee: 1.0, // 1% pool fee
      latestBlockNumber: finalBlockNumber,
      totalTransactions: finalTotalTransactions,
      dailyEmission,
      rewardsPool,
      estimatedDailyEarnings,
    };

    await cache.set(cacheKey, stats, this.CACHE_TTL);
    
    return stats;
  }

  /**
   * Get hashrate statistics for a user
   */
  async getUserHashrateStats(userId: string | undefined): Promise<UserHashrateStats> {
    // Handle missing userId
    if (!userId) {
      return {
        current: 0,
        average24h: 0,
        peak24h: 0,
        history: [],
      };
    }

    const cacheKey = `stats:hashrate:${userId}`;
    const cached = await cache.get<UserHashrateStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const workers = await db.worker.findMany({
      where: { userId },
      select: { hashrate: true, isOnline: true },
    });

    const currentHashrate = workers
      .filter((w) => w.isOnline)
      .reduce((sum, w) => sum + Number(w.hashrate), 0);

    // Get historical data from cache or calculate
    const history = await this.getUserHashrateHistory(userId);
    
    const hashrates = history.map((h) => h.hashrate);
    const average24h = hashrates.length > 0
      ? hashrates.reduce((a, b) => a + b, 0) / hashrates.length
      : currentHashrate;
    const peak24h = hashrates.length > 0 ? Math.max(...hashrates) : currentHashrate;

    const stats: UserHashrateStats = {
      current: currentHashrate,
      average24h,
      peak24h,
      history,
    };

    await cache.set(cacheKey, stats, this.CACHE_TTL);
    
    return stats;
  }

  /**
   * Get hashrate history for a user
   */
  private async getUserHashrateHistory(userId: string): Promise<HashrateHistory[]> {
    const cacheKey = `stats:hashrate:history:${userId}`;
    const cached = await cache.get<HashrateHistory[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Get shares grouped by hour
    const shares = await db.share.findMany({
      where: {
        userId,
        createdAt: { gte: twentyFourHoursAgo },
        isValid: true,
      },
      select: {
        difficulty: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by hour
    const hourlyData = new Map<string, number>();
    
    for (const share of shares) {
      const hourKey = share.createdAt.toISOString().slice(0, 13);
      const current = hourlyData.get(hourKey) || 0;
      hourlyData.set(hourKey, current + Number(share.difficulty));
    }

    const history: HashrateHistory[] = Array.from(hourlyData.entries()).map(
      ([hour, difficulty]) => ({
        timestamp: new Date(hour + ':00:00.000Z'),
        hashrate: difficulty * 1000000, // Convert to hashrate
      })
    );

    await cache.set(cacheKey, history, this.HISTORY_CACHE_TTL);
    
    return history;
  }

  /**
   * Get earnings for a user
   */
  async getUserEarnings(userId: string | undefined): Promise<EarningsData> {
    // Handle missing userId
    if (!userId) {
      return {
        balance: 0,
        pending: 0,
        paid: 0,
        last24h: 0,
        last7d: 0,
        last30d: 0,
      };
    }

    const cacheKey = `stats:earnings:${userId}`;
    const cached = await cache.get<EarningsData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalPaid,
      pendingPayouts,
      earnings24h,
      earnings7d,
      earnings30d,
    ] = await Promise.all([
      db.payout.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      db.payout.aggregate({
        where: { userId, status: 'PENDING' },
        _sum: { amount: true },
      }),
      this.calculateEarnings(userId, oneDayAgo),
      this.calculateEarnings(userId, sevenDaysAgo),
      this.calculateEarnings(userId, thirtyDaysAgo),
    ]);

    // Calculate balance from shares (simplified)
    const balance = await this.calculateUserBalance(userId);

    const earnings: EarningsData = {
      balance,
      pending: Number(pendingPayouts._sum.amount || 0),
      paid: Number(totalPaid._sum.amount || 0),
      last24h: earnings24h,
      last7d: earnings7d,
      last30d: earnings30d,
    };

    await cache.set(cacheKey, earnings, this.CACHE_TTL);
    
    return earnings;
  }

  /**
   * Calculate earnings for a time period
   */
  private async calculateEarnings(userId: string, since: Date): Promise<number> {
    const shares = await db.share.aggregate({
      where: {
        userId,
        isValid: true,
        createdAt: { gte: since },
      },
      _sum: { difficulty: true },
    });

    const totalDifficulty = Number(shares._sum.difficulty || 0);
    
    // Get blocks found in the period
    const blocks = await db.block.findMany({
      where: {
        isConfirmed: true,
        foundAt: { gte: since },
      },
      select: {
        reward: true,
        fees: true,
      },
    });

    const totalRewards = blocks.reduce(
      (sum, block) => sum + Number(block.reward) + Number(block.fees),
      0
    );

    // Get total pool difficulty in the period
    const poolShares = await db.share.aggregate({
      where: {
        isValid: true,
        createdAt: { gte: since },
      },
      _sum: { difficulty: true },
    });

    const totalPoolDifficulty = Number(poolShares._sum.difficulty || 0);

    if (totalPoolDifficulty === 0) {
      return 0;
    }

    // User's share of rewards (PPLNS-style calculation simplified)
    const userShare = totalDifficulty / totalPoolDifficulty;
    return totalRewards * userShare * 0.99; // 1% pool fee
  }

  /**
   * Calculate user's current balance
   */
  private async calculateUserBalance(userId: string): Promise<number> {
    // This is a simplified balance calculation
    // In a real implementation, you would track this more accurately
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        shares: {
          where: { isValid: true },
          select: { difficulty: true },
        },
        payouts: {
          where: { status: 'COMPLETED' },
          select: { amount: true },
        },
      },
    });

    if (!user) {
      return 0;
    }

    // Calculate total earned from shares
    const totalDifficulty = user.shares.reduce(
      (sum, s) => sum + Number(s.difficulty),
      0
    );

    // Get approximate earnings rate
    const rewardPerDifficulty = 0.000001; // Simplified rate
    const totalEarned = totalDifficulty * rewardPerDifficulty;

    // Subtract paid amounts
    const totalPaid = user.payouts.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    return Math.max(0, totalEarned - totalPaid);
  }

  /**
   * Record pool stats snapshot
   */
  async recordPoolStats(): Promise<void> {
    const stats = await this.getPoolStats();

    await db.poolStats.create({
      data: {
        hashrate: stats.hashrate,
        activeWorkers: stats.activeWorkers,
        activeMiners: stats.activeMiners,
        blocksFound: stats.blocksFound,
        totalPaid: stats.totalPaid,
        difficulty: stats.difficulty,
        networkHashrate: stats.networkHashrate,
      },
    });

    logger.debug('Pool stats snapshot recorded');
  }

  /**
   * Get pool hashrate history
   */
  async getPoolHashrateHistory(hours: number = 24): Promise<HashrateHistory[]> {
    const cacheKey = `stats:pool:hashrate:history:${hours}`;
    const cached = await cache.get<HashrateHistory[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const since = new Date();
    since.setHours(since.getHours() - hours);

    const stats = await db.poolStats.findMany({
      where: { createdAt: { gte: since } },
      select: {
        hashrate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const history = stats.map((s) => ({
      timestamp: s.createdAt,
      hashrate: Number(s.hashrate),
    }));

    await cache.set(cacheKey, history, this.HISTORY_CACHE_TTL);
    
    return history;
  }

  /**
   * Get top miners
   * Returns top miners by hashrate with their stats
   */
  async getTopMiners(limit: number = 5): Promise<TopMiner[]> {
    const cacheKey = `stats:top-miners:${limit}`;
    const cached = await cache.get<TopMiner[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Fetch real miner data from database
    const users = await db.user.findMany({
      where: {
        workers: { some: { isOnline: true } },
      },
      select: {
        id: true,
        walletAddress: true,
        workers: {
          where: { isOnline: true },
          select: { hashrate: true },
        },
      },
    });

    // Calculate total pool hashrate
    const totalPoolHashrate = users.reduce(
      (sum, user) => sum + user.workers.reduce((ws, w) => ws + Number(w.hashrate), 0),
      0
    );

    // Get blocks found per user and calculate earnings
    const minersWithStats = await Promise.all(
      users.map(async (user) => {
        const hashrate = user.workers.reduce((sum, w) => sum + Number(w.hashrate), 0);
        
        const [blocksFound, earnings] = await Promise.all([
          db.block.count({ where: { finderUserId: user.id, isConfirmed: true } }),
          db.payout.aggregate({
            where: { userId: user.id, status: 'COMPLETED' },
            _sum: { amount: true },
          }),
        ]);

        return {
          address: user.walletAddress,
          hashrate,
          blocksFound,
          earnings: Number(earnings._sum.amount || 0),
          percentage: totalPoolHashrate > 0 ? (hashrate / totalPoolHashrate) * 100 : 0,
        };
      })
    );

    // Sort by hashrate and add rank
    const topMiners: TopMiner[] = minersWithStats
      .sort((a, b) => b.hashrate - a.hashrate)
      .slice(0, limit)
      .map((miner, index) => ({
        rank: index + 1,
        ...miner,
      }));

    await cache.set(cacheKey, topMiners, this.CACHE_TTL);
    
    return topMiners;
  }

  /**
   * Get leaderboard data
   * Returns ranked miners based on type (hashrate, blocks, or earnings)
   */
  async getLeaderboard(
    type: LeaderboardType = 'hashrate',
    period: LeaderboardPeriod = 'all',
    limit: number = 20
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `stats:leaderboard:${type}:${period}:${limit}`;
    const cached = await cache.get<LeaderboardEntry[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Calculate time range based on period
    const since = this.getPeriodStartDate(period);

    // Fetch user data based on type
    const users = await db.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        walletAddress: true,
        workers: {
          where: { isOnline: true },
          select: { hashrate: true },
        },
      },
    });

    // Calculate values based on type
    const usersWithValues = await Promise.all(
      users.map(async (user) => {
        let value = 0;

        switch (type) {
          case 'hashrate':
            value = user.workers.reduce((sum, w) => sum + Number(w.hashrate), 0);
            break;
          case 'blocks':
            value = await db.block.count({
              where: {
                finderUserId: user.id,
                isConfirmed: true,
                ...(since && { foundAt: { gte: since } }),
              },
            });
            break;
          case 'earnings':
            const earnings = await db.payout.aggregate({
              where: {
                userId: user.id,
                status: 'COMPLETED',
                ...(since && { processedAt: { gte: since } }),
              },
              _sum: { amount: true },
            });
            value = Number(earnings._sum.amount || 0);
            break;
        }

        return {
          address: user.walletAddress,
          value,
        };
      })
    );

    // Filter out zero values and sort
    const sortedUsers = usersWithValues
      .filter((u) => u.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);

    // Calculate total for percentage
    const totalValue = sortedUsers.reduce((sum, u) => sum + u.value, 0);

    // Build leaderboard with rank, percentage, and mock change (would need historical data for real change)
    const leaderboard: LeaderboardEntry[] = sortedUsers.map((user, index) => ({
      rank: index + 1,
      address: user.address,
      value: user.value,
      percentage: totalValue > 0 ? (user.value / totalValue) * 100 : 0,
      change: Math.random() * 10 - 5, // Mock change between -5% and +5% for now
    }));

    await cache.set(cacheKey, leaderboard, this.CACHE_TTL);
    
    return leaderboard;
  }

  /**
   * Get hashrate history for the pool
   * Fetches from poolStats table
   */
  async getHashrateHistory(hours: number = 24): Promise<HashrateHistory[]> {
    // This is an alias to getPoolHashrateHistory for the new API endpoint
    return this.getPoolHashrateHistory(hours);
  }

  /**
   * Helper to get the start date for a period
   */
  private getPeriodStartDate(period: LeaderboardPeriod): Date | null {
    const now = new Date();
    
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        return null;
    }
  }
}

export const statsService = new StatsService();
export default statsService;
