import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { payoutService } from '../services/payout.service.js';
import { createValidationPreHandler } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { createChildLogger } from '../lib/logger.js';
import { PayoutStatus } from '@prisma/client';

const logger = createChildLogger('payout-routes');

// Validation schemas
const listPayoutsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.nativeEnum(PayoutStatus).optional(),
  }),
});

const requestPayoutSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
    toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  }),
});

const updateThresholdSchema = z.object({
  body: z.object({
    threshold: z.number().positive(),
  }),
});

const payoutIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export async function payoutRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * Get payout history
   */
  fastify.get<{
    Querystring: z.infer<typeof listPayoutsSchema>['query'];
  }>(
    '/',
    {
      preHandler: createValidationPreHandler(listPayoutsSchema),
    },
    async (request, reply) => {
      const { page, limit, status } = request.query;
      const userId = request.user!.userId;

      const result = await payoutService.getPayoutHistory({
        userId,
        page,
        limit,
        status,
      });

      return reply.send(result);
    }
  );

  /**
   * Request a payout
   */
  fastify.post<{
    Body: z.infer<typeof requestPayoutSchema>['body'];
  }>(
    '/',
    {
      preHandler: createValidationPreHandler(requestPayoutSchema),
    },
    async (request, reply) => {
      const { amount, toAddress } = request.body;
      const userId = request.user!.userId;

      try {
        const payout = await payoutService.requestPayout({
          userId,
          amount,
          toAddress,
        });

        logger.info({ payoutId: payout.id, userId, amount }, 'Payout requested');

        return reply.status(201).send({ payout });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * Get payout thresholds
   */
  fastify.get('/thresholds', async (request, reply) => {
    const userId = request.user!.userId;

    const thresholds = payoutService.getThresholds();
    const userThreshold = await payoutService.getUserThreshold(userId);
    const balance = await payoutService.getUserBalance(userId);

    return reply.send({
      thresholds,
      userThreshold,
      balance,
      canRequestPayout: balance >= thresholds.minimum,
    });
  });

  /**
   * Update payout threshold
   */
  fastify.put<{
    Body: z.infer<typeof updateThresholdSchema>['body'];
  }>(
    '/threshold',
    {
      preHandler: createValidationPreHandler(updateThresholdSchema),
    },
    async (request, reply) => {
      const { threshold } = request.body;
      const userId = request.user!.userId;

      try {
        await payoutService.updateUserThreshold(userId, threshold);

        logger.info({ userId, threshold }, 'Payout threshold updated');

        return reply.send({
          message: 'Threshold updated successfully',
          threshold,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * Get payout by ID
   */
  fastify.get<{
    Params: z.infer<typeof payoutIdSchema>['params'];
  }>(
    '/:id',
    {
      preHandler: createValidationPreHandler(payoutIdSchema),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.userId;

      const result = await payoutService.getPayoutHistory({
        userId,
        page: 1,
        limit: 1,
      });

      const payout = result.payouts.find((p) => p.id === id);

      if (!payout) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Payout not found',
        });
      }

      return reply.send({ payout });
    }
  );

  /**
   * Cancel a pending payout
   */
  fastify.delete<{
    Params: z.infer<typeof payoutIdSchema>['params'];
  }>(
    '/:id',
    {
      preHandler: createValidationPreHandler(payoutIdSchema),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.userId;

      const cancelled = await payoutService.cancelPayout(id, userId);

      if (!cancelled) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Payout not found or cannot be cancelled',
        });
      }

      logger.info({ payoutId: id, userId }, 'Payout cancelled');

      return reply.send({
        message: 'Payout cancelled successfully',
      });
    }
  );

  /**
   * Get current balance
   */
  fastify.get('/balance', async (request, reply) => {
    const userId = request.user!.userId;
    const balance = await payoutService.getUserBalance(userId);

    return reply.send({ balance });
  });

  /**
   * Estimate payout fee
   */
  fastify.get<{
    Querystring: { amount: string };
  }>('/fee', async (request, reply) => {
    const amount = parseFloat(request.query.amount);

    if (isNaN(amount) || amount <= 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid amount',
      });
    }

    const fee = payoutService.calculateFee(amount);
    const netAmount = amount - fee;

    return reply.send({
      amount,
      fee,
      netAmount,
    });
  });
}

export default payoutRoutes;
