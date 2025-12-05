import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { statsService } from '../services/stats.service.js';
import { createValidationPreHandler } from '../middleware/validate.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('stats-routes');

// Validation schemas
const hashrateHistorySchema = z.object({
  query: z.object({
    hours: z.coerce.number().int().positive().max(168).default(24),
  }),
});

export async function statsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Get pool statistics (public)
   */
  fastify.get('/pool', async (request, reply) => {
    const stats = await statsService.getPoolStats();
    return reply.send({ stats });
  });

  /**
   * Get pool hashrate history (public)
   */
  fastify.get<{
    Querystring: z.infer<typeof hashrateHistorySchema>['query'];
  }>(
    '/pool/hashrate',
    {
      preHandler: createValidationPreHandler(hashrateHistorySchema),
    },
    async (request, reply) => {
      const { hours } = request.query;
      const history = await statsService.getPoolHashrateHistory(hours);
      return reply.send({ history });
    }
  );

  /**
   * Get user hashrate statistics (authenticated)
   */
  fastify.get(
    '/hashrate',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const stats = await statsService.getUserHashrateStats(userId);
      return reply.send({ stats });
    }
  );

  /**
   * Get user earnings (authenticated)
   */
  fastify.get(
    '/earnings',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const earnings = await statsService.getUserEarnings(userId);
      return reply.send({ earnings });
    }
  );

  /**
   * Get comprehensive dashboard stats (authenticated)
   */
  fastify.get(
    '/dashboard',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const userId = request.user!.userId;

      const [poolStats, hashrateStats, earnings] = await Promise.all([
        statsService.getPoolStats(),
        statsService.getUserHashrateStats(userId),
        statsService.getUserEarnings(userId),
      ]);

      return reply.send({
        pool: poolStats,
        hashrate: hashrateStats,
        earnings,
      });
    }
  );

  /**
   * Get network statistics (public)
   */
  fastify.get('/network', async (request, reply) => {
    const poolStats = await statsService.getPoolStats();

    return reply.send({
      network: {
        difficulty: poolStats.difficulty,
        hashrate: poolStats.networkHashrate,
        blockTime: 12, // Average block time in seconds
      },
    });
  });

  /**
   * Get leaderboard (public, with optional auth for highlighting current user)
   */
  fastify.get(
    '/leaderboard',
    {
      preHandler: optionalAuth,
    },
    async (request, reply) => {
      // This would typically query and aggregate user stats
      // Simplified implementation for now
      const leaderboard = await fastify.prisma.user.findMany({
        select: {
          id: true,
          walletAddress: true,
          username: true,
          workers: {
            where: { isOnline: true },
            select: { hashrate: true },
          },
        },
        take: 50,
      });

      const ranked = leaderboard
        .map((user) => ({
          id: user.id,
          displayName:
            user.username ||
            `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`,
          hashrate: user.workers.reduce((sum, w) => sum + Number(w.hashrate), 0),
          isCurrentUser: request.user?.userId === user.id,
        }))
        .sort((a, b) => b.hashrate - a.hashrate)
        .map((user, index) => ({ ...user, rank: index + 1 }));

      return reply.send({ leaderboard: ranked.slice(0, 50) });
    }
  );
}

export default statsRoutes;
