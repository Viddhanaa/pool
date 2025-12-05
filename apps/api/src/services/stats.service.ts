import { db } from '../lib/db.js';
import { cache } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { Prisma } from '@prisma/client';

const logger = createChildLogger('stats-service');

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
}

export interface HashrateHistory {
  timestamp: Date;
  hashrate: number;
}

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
  private readonly CACHE_TTL = 10; // 10 seconds for real-time stats
  private readonly HISTORY_CACHE_TTL = 60; // 1 minute for historical data

  /**
   * Get pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    const cacheKey = 'stats:pool';
    const cached = await cache.get<PoolStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const [
      activeWorkers,
      activeMiners,
      latestBlock,
      blocksFound,
      totalPaidResult,
      latestPoolStats,
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
    ]);

    // Calculate total hashrate from workers
    const hashrateResult = await db.worker.aggregate({
      where: { isOnline: true },
      _sum: { hashrate: true },
    });

    const stats: PoolStats = {
      hashrate: Number(hashrateResult._sum.hashrate || 0),
      activeWorkers,
      activeMiners,
      blocksFound,
      totalPaid: Number(totalPaidResult._sum.amount || 0),
      difficulty: latestPoolStats ? Number(latestPoolStats.difficulty) : 0,
      networkHashrate: latestPoolStats ? Number(latestPoolStats.networkHashrate) : 0,
      lastBlockTime: latestBlock?.foundAt || null,
      poolFee: 1.0, // 1% pool fee
    };

    await cache.set(cacheKey, stats, this.CACHE_TTL);
    
    return stats;
  }

  /**
   * Get hashrate statistics for a user
   */
  async getUserHashrateStats(userId: string): Promise<UserHashrateStats> {
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
  async getUserEarnings(userId: string): Promise<EarningsData> {
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
}

export const statsService = new StatsService();
export default statsService;
