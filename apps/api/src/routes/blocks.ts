import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { cache } from '../lib/redis.js';
import { createValidationPreHandler } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('blocks-routes');

// Validation schemas
const listBlocksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    confirmed: z.enum(['true', 'false']).optional().transform((val) =>
      val === 'true' ? true : val === 'false' ? false : undefined
    ),
  }),
});

const blockIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export async function blockRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * List blocks (public)
   */
  fastify.get<{
    Querystring: z.infer<typeof listBlocksSchema>['query'];
  }>(
    '/',
    {
      preHandler: createValidationPreHandler(listBlocksSchema),
    },
    async (request, reply) => {
      const { page, limit, confirmed } = request.query;

      const cacheKey = `blocks:list:${page}:${limit}:${confirmed}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return reply.send(cached);
      }

      const where = {
        ...(confirmed !== undefined && { isConfirmed: confirmed }),
        isOrphan: false,
      };

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [blocks, total, confirmedBlocks, pendingBlocks, totalRewardsAgg, blocksLast24h] = await Promise.all([
        db.block.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { height: 'desc' },
          select: {
            id: true,
            height: true,
            hash: true,
            difficulty: true,
            reward: true,
            fees: true,
            finder: true,
            confirmations: true,
            isConfirmed: true,
            foundAt: true,
          },
        }),
        db.block.count({ where }),
        db.block.count({ where: { isConfirmed: true, isOrphan: false } }),
        db.block.count({ where: { isConfirmed: false, isOrphan: false } }),
        db.block.aggregate({
          where: { isConfirmed: true, isOrphan: false },
          _sum: { reward: true },
        }),
        db.block.count({ where: { foundAt: { gte: oneDayAgo }, isOrphan: false } }),
      ]);

      const averageBlockTime = blocksLast24h > 1 ? Math.round(86400 / blocksLast24h) : 0;
      const totalPages = Math.ceil(total / limit);

      const result = {
        blocks: blocks.map((block) => ({
          id: block.id,
          height: Number(block.height),
          hash: block.hash,
          difficulty: Number(block.difficulty),
          reward: Number(block.reward),
          fees: Number(block.fees),
          finder: block.finder,
          confirmations: block.confirmations,
          isConfirmed: block.isConfirmed,
          foundAt: block.foundAt,
        })),
        total,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      await cache.set(cacheKey, result, 10);
      return reply.send(result);
    }
  );

  /**
   * Get recent blocks (public) - MUST be before /:id route
   */
  fastify.get('/recent', async (request, reply) => {
    const { limit = 5 } = request.query as { limit?: number };

    const cacheKey = `blocks:recent:${limit}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send(cached);
    }

    const blocks = await db.block.findMany({
      where: { isOrphan: false },
      orderBy: { height: 'desc' },
      take: Number(limit),
      select: {
        id: true,
        height: true,
        hash: true,
        reward: true,
        confirmations: true,
        isConfirmed: true,
        isOrphan: true,
        foundAt: true,
        finder: true,
      },
    });

    const result = {
      blocks: blocks.map((block) => ({
        id: block.id,
        height: Number(block.height),
        hash: block.hash,
        reward: Number(block.reward),
        confirmations: block.confirmations,
        isConfirmed: block.isConfirmed,
        isOrphan: block.isOrphan,
        foundAt: block.foundAt,
        finder: block.finder,
      })),
    };

    await cache.set(cacheKey, result, 10);
    return reply.send(result);
  });

  /**
   * Get block statistics (public)
   */
  fastify.get('/stats', async (request, reply) => {
    const cacheKey = 'blocks:stats';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send(cached);
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalBlocks,
      confirmedBlocks,
      orphanedBlocks,
      blocksLast24h,
      blocksLastWeek,
      latestBlock,
      totalRewards,
    ] = await Promise.all([
      db.block.count(),
      db.block.count({ where: { isConfirmed: true } }),
      db.block.count({ where: { isOrphan: true } }),
      db.block.count({ where: { foundAt: { gte: oneDayAgo } } }),
      db.block.count({ where: { foundAt: { gte: oneWeekAgo } } }),
      db.block.findFirst({
        where: { isConfirmed: true },
        orderBy: { height: 'desc' },
      }),
      db.block.aggregate({
        where: { isConfirmed: true },
        _sum: { reward: true, fees: true },
      }),
    ]);

    const result = {
      stats: {
        totalBlocks,
        confirmedBlocks,
        orphanedBlocks,
        pendingBlocks: totalBlocks - confirmedBlocks - orphanedBlocks,
        blocksLast24h,
        blocksLastWeek,
        latestHeight: latestBlock ? Number(latestBlock.height) : 0,
        totalRewards: Number(totalRewards._sum.reward || 0),
        totalFees: Number(totalRewards._sum.fees || 0),
        orphanRate: totalBlocks > 0 ? (orphanedBlocks / totalBlocks) * 100 : 0,
      },
    };

    await cache.set(cacheKey, result, 30);
    return reply.send(result);
  });

  /**
   * Get block by ID or height (public)
   */
  fastify.get<{
    Params: z.infer<typeof blockIdSchema>['params'];
  }>(
    '/:id',
    {
      preHandler: createValidationPreHandler(blockIdSchema),
    },
    async (request, reply) => {
      const { id } = request.params;

      let block = await db.block.findUnique({
        where: { id },
        include: {
          shares: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              difficulty: true,
              createdAt: true,
              user: {
                select: {
                  username: true,
                  walletAddress: true,
                },
              },
            },
          },
        },
      });

      if (!block) {
        const height = parseInt(id, 10);
        if (!isNaN(height) && height >= 0) {
          block = await db.block.findUnique({
            where: { height: BigInt(height) },
            include: {
              shares: {
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  difficulty: true,
                  createdAt: true,
                  user: {
                    select: {
                      username: true,
                      walletAddress: true,
                    },
                  },
                },
              },
            },
          });
        }
      }

      if (!block) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Block not found',
        });
      }

      const result = {
        block: {
          id: block.id,
          height: Number(block.height),
          hash: block.hash,
          difficulty: Number(block.difficulty),
          reward: Number(block.reward),
          fees: Number(block.fees),
          finder: block.finder,
          confirmations: block.confirmations,
          isConfirmed: block.isConfirmed,
          isOrphan: block.isOrphan,
          foundAt: block.foundAt,
          shares: block.shares.map((share) => ({
            id: share.id,
            difficulty: Number(share.difficulty),
            createdAt: share.createdAt,
            miner:
              share.user.username ||
              `${share.user.walletAddress.slice(0, 6)}...${share.user.walletAddress.slice(-4)}`,
          })),
        },
      };

      return reply.send(result);
    }
  );

  /**
   * Get blocks found by current user (authenticated)
   */
  fastify.get(
    '/mine',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const userId = request.user!.userId;

      const blocks = await db.block.findMany({
        where: { finderUserId: userId },
        orderBy: { foundAt: 'desc' },
        take: 50,
        select: {
          id: true,
          height: true,
          hash: true,
          reward: true,
          fees: true,
          isConfirmed: true,
          foundAt: true,
        },
      });

      return reply.send({
        blocks: blocks.map((block) => ({
          id: block.id,
          height: Number(block.height),
          hash: block.hash,
          reward: Number(block.reward),
          fees: Number(block.fees),
          isConfirmed: block.isConfirmed,
          foundAt: block.foundAt,
        })),
      });
    }
  );
}

export default blockRoutes;

