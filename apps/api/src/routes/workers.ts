import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workerService } from '../services/worker.service.js';
import { createValidationPreHandler } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('worker-routes');

// Validation schemas
const listWorkersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    isOnline: z.enum(['true', 'false']).optional().transform((val) => 
      val === 'true' ? true : val === 'false' ? false : undefined
    ),
    sortBy: z.enum(['hashrate', 'name', 'lastShareAt', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const workerIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

const updateWorkerSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    difficulty: z.number().positive().optional(),
    algorithm: z.string().min(1).optional(),
  }),
});

export async function workerRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * List workers
   */
  fastify.get<{
    Querystring: z.infer<typeof listWorkersSchema>['query'];
  }>(
    '/',
    {
      preHandler: createValidationPreHandler(listWorkersSchema),
    },
    async (request, reply) => {
      const { page, limit, isOnline, sortBy, sortOrder } = request.query;
      const userId = request.user!.userId;

      const result = await workerService.getWorkers({
        userId,
        page,
        limit,
        isOnline,
        sortBy,
        sortOrder,
      });

      return reply.send(result);
    }
  );

  /**
   * Get worker by ID
   */
  fastify.get<{
    Params: z.infer<typeof workerIdSchema>['params'];
  }>(
    '/:id',
    {
      preHandler: createValidationPreHandler(workerIdSchema),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.userId;

      const worker = await workerService.getWorkerById(id, userId);

      if (!worker) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Worker not found',
        });
      }

      return reply.send({ worker });
    }
  );

  /**
   * Get worker statistics
   */
  fastify.get<{
    Params: z.infer<typeof workerIdSchema>['params'];
  }>(
    '/:id/stats',
    {
      preHandler: createValidationPreHandler(workerIdSchema),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.userId;

      const stats = await workerService.getWorkerStats(id, userId);

      if (!stats) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Worker not found',
        });
      }

      return reply.send({ stats });
    }
  );

  /**
   * Update worker
   */
  fastify.put<{
    Params: z.infer<typeof updateWorkerSchema>['params'];
    Body: z.infer<typeof updateWorkerSchema>['body'];
  }>(
    '/:id',
    {
      preHandler: createValidationPreHandler(updateWorkerSchema),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.userId;
      const updates = request.body;

      const worker = await workerService.updateWorker(id, userId, updates);

      if (!worker) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Worker not found',
        });
      }

      logger.info({ workerId: id, userId }, 'Worker updated');

      return reply.send({ worker });
    }
  );

  /**
   * Delete worker
   */
  fastify.delete<{
    Params: z.infer<typeof workerIdSchema>['params'];
  }>(
    '/:id',
    {
      preHandler: createValidationPreHandler(workerIdSchema),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.userId;

      const deleted = await workerService.deleteWorker(id, userId);

      if (!deleted) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Worker not found',
        });
      }

      logger.info({ workerId: id, userId }, 'Worker deleted');

      return reply.status(204).send();
    }
  );

  /**
   * Get summary of all workers
   */
  fastify.get('/summary', async (request, reply) => {
    const userId = request.user!.userId;

    const result = await workerService.getWorkers({
      userId,
      page: 1,
      limit: 1000,
    });

    const online = result.workers.filter((w) => w.isOnline);
    const offline = result.workers.filter((w) => !w.isOnline);

    const totalHashrate = online.reduce((sum, w) => sum + w.hashrate, 0);
    const totalSharesAccepted = result.workers.reduce(
      (sum, w) => sum + w.sharesAccepted,
      0
    );
    const totalSharesRejected = result.workers.reduce(
      (sum, w) => sum + w.sharesRejected,
      0
    );

    return reply.send({
      summary: {
        total: result.total,
        online: online.length,
        offline: offline.length,
        totalHashrate,
        totalSharesAccepted,
        totalSharesRejected,
        efficiency:
          totalSharesAccepted + totalSharesRejected > 0
            ? (totalSharesAccepted / (totalSharesAccepted + totalSharesRejected)) * 100
            : 0,
      },
    });
  });
}

export default workerRoutes;
