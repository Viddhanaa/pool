import { FastifyInstance } from 'fastify';
import { statsService } from '../services/stats.service.js';
import { workerService } from '../services/worker.service.js';
import { payoutService } from '../services/payout.service.js';
import { authenticate } from '../middleware/auth.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('dashboard-routes');

export async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  // DEVELOPMENT: Comment out auth to use seed data
  // fastify.addHook('preHandler', authenticate);

  /**
   * Get complete dashboard overview
   */
  fastify.get('/overview', async (request, reply) => {
    // DEVELOPMENT: Use first seed user if not authenticated
    let userId = request.user?.userId;

    if (!userId) {
      const firstUser = await fastify.prisma.user.findFirst({ where: { isActive: true } });
      userId = firstUser?.id || 'mock-user';
    }

    const [
      poolStats,
      hashrateStats,
      earnings,
      workers,
      balance,
    ] = await Promise.all([
      statsService.getPoolStats(),
      statsService.getUserHashrateStats(userId),
      statsService.getUserEarnings(userId),
      workerService.getWorkers({ userId, page: 1, limit: 100 }),
      payoutService.getUserBalance(userId),
    ]);

    const onlineWorkers = workers.workers.filter((w) => w.isOnline);
    const offlineWorkers = workers.workers.filter((w) => !w.isOnline);

    return reply.send({
      overview: {
        // User stats
        user: {
          hashrate: hashrateStats.current,
          averageHashrate24h: hashrateStats.average24h,
          peakHashrate24h: hashrateStats.peak24h,
          workersOnline: onlineWorkers.length,
          workersOffline: offlineWorkers.length,
          totalWorkers: workers.total,
        },
        // Earnings
        earnings: {
          balance,
          pending: earnings.pending,
          totalPaid: earnings.paid,
          last24h: earnings.last24h,
          last7d: earnings.last7d,
          last30d: earnings.last30d,
        },
        // Pool stats
        pool: {
          hashrate: poolStats.hashrate,
          activeWorkers: poolStats.activeWorkers,
          activeMiners: poolStats.activeMiners,
          blocksFound: poolStats.blocksFound,
          lastBlockTime: poolStats.lastBlockTime,
          difficulty: poolStats.difficulty,
          fee: poolStats.poolFee,
        },
        // Worker summary
        workers: onlineWorkers.slice(0, 5).map((w) => ({
          id: w.id,
          name: w.name,
          hashrate: w.hashrate,
          lastShareAt: w.lastShareAt,
        })),
        // Charts data
        hashrateHistory: hashrateStats.history,
      },
    });
  });

  /**
   * Get recent activity
   */
  fastify.get('/activity', async (request, reply) => {
    let userId = request.user?.userId;
    if (!userId) {
      const firstUser = await fastify.prisma.user.findFirst({ where: { isActive: true } });
      userId = firstUser?.id || 'mock-user';
    }

    const [recentPayouts, recentShares] = await Promise.all([
      fastify.prisma.payout.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          status: true,
          txHash: true,
          createdAt: true,
        },
      }),
      fastify.prisma.share.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          difficulty: true,
          isValid: true,
          createdAt: true,
          worker: {
            select: { name: true },
          },
        },
      }),
    ]);

    const activity = [
      ...recentPayouts.map((p) => ({
        type: 'payout' as const,
        id: p.id,
        description: `Payout of ${Number(p.amount)} ETH`,
        status: p.status,
        txHash: p.txHash,
        createdAt: p.createdAt,
      })),
      ...recentShares.map((s) => ({
        type: 'share' as const,
        id: s.id,
        description: `${s.isValid ? 'Valid' : 'Invalid'} share from ${s.worker.name}`,
        difficulty: Number(s.difficulty),
        createdAt: s.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reply.send({ activity: activity.slice(0, 20) });
  });

  /**
   * Get alerts/notifications
   */
  fastify.get('/alerts', async (request, reply) => {
    let userId = request.user?.userId;
    if (!userId) {
      const firstUser = await fastify.prisma.user.findFirst({ where: { isActive: true } });
      userId = firstUser?.id || 'mock-user';
    }

    const alerts: Array<{
      type: 'warning' | 'error' | 'info' | 'success';
      title: string;
      message: string;
      createdAt: Date;
    }> = [];

    // Check for offline workers
    const workers = await workerService.getWorkers({
      userId,
      page: 1,
      limit: 100,
    });

    const recentlyOffline = workers.workers.filter(
      (w) =>
        !w.isOnline &&
        w.lastShareAt &&
        Date.now() - w.lastShareAt.getTime() < 30 * 60 * 1000
    );

    if (recentlyOffline.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Workers Offline',
        message: `${recentlyOffline.length} worker(s) went offline recently`,
        createdAt: new Date(),
      });
    }

    // Check for pending payouts
    const pendingPayouts = await fastify.prisma.payout.count({
      where: {
        userId,
        status: 'PENDING',
      },
    });

    if (pendingPayouts > 0) {
      alerts.push({
        type: 'info',
        title: 'Pending Payout',
        message: `You have ${pendingPayouts} pending payout(s)`,
        createdAt: new Date(),
      });
    }

    // Check if balance is near threshold
    const balance = await payoutService.getUserBalance(userId);
    const threshold = await payoutService.getUserThreshold(userId);

    if (balance >= threshold * 0.9 && balance < threshold) {
      alerts.push({
        type: 'info',
        title: 'Almost at Payout',
        message: `You're ${((balance / threshold) * 100).toFixed(1)}% of the way to your payout threshold`,
        createdAt: new Date(),
      });
    }

    return reply.send({ alerts });
  });

  /**
   * Get quick stats for header
   */
  fastify.get('/quick-stats', async (request, reply) => {
    let userId = request.user?.userId;
    if (!userId) {
      const firstUser = await fastify.prisma.user.findFirst({ where: { isActive: true } });
      userId = firstUser?.id || 'mock-user';
    }

    const [hashrateStats, balance, workers] = await Promise.all([
      statsService.getUserHashrateStats(userId),
      payoutService.getUserBalance(userId),
      workerService.getWorkers({ userId, page: 1, limit: 100, isOnline: true }),
    ]);

    return reply.send({
      hashrate: hashrateStats.current,
      balance,
      onlineWorkers: workers.total,
    });
  });
}

export default dashboardRoutes;
