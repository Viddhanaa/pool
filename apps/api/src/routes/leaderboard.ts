import { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { cache } from '../lib/redis.js';

export async function leaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Get leaderboard - public endpoint
   */
  fastify.get('/leaderboard', async (request, reply) => {
    const { timeframe = '24h' } = request.query as { timeframe?: string };

    const cacheKey = `leaderboard:${timeframe}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send(cached);
    }

    // Get all workers with their stats (public data)
    const workers = await db.worker.findMany({
      where: {
        isOnline: true, // Only show online workers
      },
      orderBy: {
        hashrate: 'desc', // Sort by hashrate
      },
      take: 100, // Limit to top 100
      select: {
        id: true,
        name: true,
        hashrate: true,
        sharesAccepted: true,
        sharesRejected: true,
        isOnline: true,
        lastShareAt: true,
        user: {
          select: {
            username: true,
            walletAddress: true,
          },
        },
      },
    });

    // Transform to leaderboard format
    const miners = workers.map((worker, index) => {
      const accepted = Number(worker.sharesAccepted);
      const rejected = Number(worker.sharesRejected);
      const totalShares = accepted + rejected;
      const efficiency = totalShares > 0
        ? ((accepted / totalShares) * 100).toFixed(1)
        : '0';

      return {
        rank: index + 1,
        username: worker.name,
        minerName: worker.user?.username || worker.user?.walletAddress?.slice(0, 10) || 'Unknown',
        hashrate: Number(worker.hashrate),
        shares: accepted,
        efficiency: Number(efficiency),
        isOnline: worker.isOnline,
        lastShareAt: worker.lastShareAt,
      };
    });

    const result = {
      miners,
      total: miners.length,
      timeframe,
    };

    await cache.set(cacheKey, result, 30); // Cache for 30 seconds
    return reply.send(result);
  });

  /**
   * Get leaderboard stats - public endpoint
   */
  fastify.get('/leaderboard/stats', async (request, reply) => {
    const cacheKey = 'leaderboard:stats';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send(cached);
    }

    const [totalMiners, onlineMiners, totalHashrate] = await Promise.all([
      db.worker.count(),
      db.worker.count({ where: { isOnline: true } }),
      db.worker.aggregate({
        where: { isOnline: true },
        _sum: { hashrate: true },
      }),
    ]);

    const result = {
      stats: {
        totalMiners,
        onlineMiners,
        totalHashrate: Number(totalHashrate._sum.hashrate || 0),
      },
    };

    await cache.set(cacheKey, result, 30);
    return reply.send(result);
  });
}

export default leaderboardRoutes;

