import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cache } from '../lib/redis.js';
import { db } from '../lib/db.js';
import { createValidationPreHandler } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('ai-routes');

// Validation schemas
const optimizeSchema = z.object({
  body: z.object({
    targetHashrate: z.number().positive().optional(),
    powerCost: z.number().positive().optional(),
    riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
});

const projectionQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().positive().max(365).default(30),
  }),
});

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  /**
   * Get earnings projection
   */
  fastify.get<{
    Querystring: z.infer<typeof projectionQuerySchema>['query'];
  }>(
    '/projection',
    {
      preHandler: createValidationPreHandler(projectionQuerySchema),
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { days } = request.query;

      const cacheKey = `ai:projection:${userId}:${days}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return reply.send(cached);
      }

      // Get user's historical data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [shares, workers, poolStats] = await Promise.all([
        db.share.findMany({
          where: {
            userId,
            createdAt: { gte: thirtyDaysAgo },
            isValid: true,
          },
          select: {
            difficulty: true,
            createdAt: true,
          },
        }),
        db.worker.findMany({
          where: { userId, isOnline: true },
          select: { hashrate: true },
        }),
        db.poolStats.findFirst({
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Calculate current hashrate
      const currentHashrate = workers.reduce(
        (sum, w) => sum + Number(w.hashrate),
        0
      );

      // Calculate average daily earnings from shares
      const totalDifficulty = shares.reduce(
        (sum, s) => sum + Number(s.difficulty),
        0
      );
      const daysWithData = Math.max(
        1,
        (Date.now() - thirtyDaysAgo.getTime()) / (24 * 60 * 60 * 1000)
      );
      const avgDailyDifficulty = totalDifficulty / daysWithData;

      // Simplified earnings projection
      // In production, this would call an AI model
      const rewardPerDifficulty = 0.000001;
      const avgDailyEarnings = avgDailyDifficulty * rewardPerDifficulty * 0.99;

      // Generate projections
      const projections: Array<{
        day: number;
        date: Date;
        earnings: number;
        cumulativeEarnings: number;
      }> = [];
      let cumulativeEarnings = 0;

      for (let i = 1; i <= days; i++) {
        // Add some variance to simulate real projections
        const variance = 0.9 + Math.random() * 0.2;
        const dailyEarning = avgDailyEarnings * variance;
        cumulativeEarnings += dailyEarning;

        projections.push({
          day: i,
          date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
          earnings: dailyEarning,
          cumulativeEarnings,
        });
      }

      // Calculate confidence intervals
      const confidence = {
        low: cumulativeEarnings * 0.7,
        medium: cumulativeEarnings,
        high: cumulativeEarnings * 1.3,
      };

      const result = {
        projection: {
          currentHashrate,
          projectedDailyEarnings: avgDailyEarnings,
          projectedTotalEarnings: cumulativeEarnings,
          confidence,
          timeline: projections,
          assumptions: {
            networkDifficulty: poolStats ? Number(poolStats.difficulty) : 0,
            poolFee: 1.0,
            hashrateConsistency: 95,
          },
        },
      };

      await cache.set(cacheKey, result, 300); // 5 minute cache

      return reply.send(result);
    }
  );

  /**
   * Get mining optimization suggestions
   */
  fastify.post<{
    Body: z.infer<typeof optimizeSchema>['body'];
  }>(
    '/optimize',
    {
      preHandler: createValidationPreHandler(optimizeSchema),
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { targetHashrate, powerCost, riskTolerance } = request.body;

      // Get current worker configuration
      const workers = await db.worker.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          hashrate: true,
          difficulty: true,
          algorithm: true,
          sharesAccepted: true,
          sharesRejected: true,
        },
      });

      const suggestions: Array<{
        type: 'difficulty' | 'worker' | 'algorithm' | 'timing';
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        expectedImprovement: string;
        action?: {
          workerId?: string;
          parameter: string;
          currentValue: string | number;
          suggestedValue: string | number;
        };
      }> = [];

      // Analyze each worker
      for (const worker of workers) {
        const totalShares = Number(worker.sharesAccepted) + Number(worker.sharesRejected);
        const rejectRate =
          totalShares > 0
            ? Number(worker.sharesRejected) / totalShares
            : 0;

        // High reject rate - suggest difficulty adjustment
        if (rejectRate > 0.05) {
          suggestions.push({
            type: 'difficulty',
            priority: 'high',
            title: `Reduce difficulty for ${worker.name}`,
            description: `Worker has a ${(rejectRate * 100).toFixed(1)}% reject rate. Lowering difficulty may improve efficiency.`,
            expectedImprovement: '+5-10% efficiency',
            action: {
              workerId: worker.id,
              parameter: 'difficulty',
              currentValue: Number(worker.difficulty),
              suggestedValue: Number(worker.difficulty) * 0.8,
            },
          });
        }

        // Very low hashrate - potential issue
        if (Number(worker.hashrate) < 1000000) {
          suggestions.push({
            type: 'worker',
            priority: 'medium',
            title: `Check ${worker.name} hardware`,
            description: 'This worker has unusually low hashrate. There may be a hardware or configuration issue.',
            expectedImprovement: 'Variable based on issue',
          });
        }
      }

      // Pool-level suggestions based on risk tolerance
      if (riskTolerance === 'high') {
        suggestions.push({
          type: 'timing',
          priority: 'low',
          title: 'Consider difficulty spikes',
          description: 'Mining during low network difficulty periods can increase block finding probability.',
          expectedImprovement: '+2-5% block probability',
        });
      }

      // Algorithm suggestions
      const algorithms = new Set(workers.map((w) => w.algorithm));
      if (algorithms.size > 1) {
        suggestions.push({
          type: 'algorithm',
          priority: 'low',
          title: 'Consolidate algorithms',
          description: 'Using a single algorithm across all workers may simplify management and reduce overhead.',
          expectedImprovement: 'Improved management',
        });
      }

      // Calculate overall optimization score
      const currentEfficiency = workers.reduce((sum, w) => {
        const total = Number(w.sharesAccepted) + Number(w.sharesRejected);
        return sum + (total > 0 ? Number(w.sharesAccepted) / total : 1);
      }, 0) / (workers.length || 1);

      const result = {
        optimization: {
          currentEfficiency: currentEfficiency * 100,
          potentialEfficiency: Math.min(99, currentEfficiency * 100 + suggestions.length * 2),
          suggestions: suggestions.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }),
          summary: {
            totalWorkers: workers.length,
            totalHashrate: workers.reduce((sum, w) => sum + Number(w.hashrate), 0),
            avgEfficiency: currentEfficiency * 100,
            improvementPotential: suggestions.length * 2,
          },
        },
      };

      return reply.send(result);
    }
  );

  /**
   * Get difficulty prediction
   */
  fastify.get('/difficulty-prediction', async (request, reply) => {
    const cacheKey = 'ai:difficulty-prediction';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return reply.send(cached);
    }

    // Get historical pool stats for difficulty
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const historicalStats = await db.poolStats.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: {
        difficulty: true,
        networkHashrate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate trend
    if (historicalStats.length < 2) {
      return reply.send({
        prediction: {
          available: false,
          message: 'Insufficient data for prediction',
        },
      });
    }

    const difficulties = historicalStats.map((s) => Number(s.difficulty));
    const avgDifficulty = difficulties.reduce((a, b) => a + b, 0) / difficulties.length;
    const latestDifficulty = difficulties[difficulties.length - 1];

    // Simple trend calculation
    const firstHalf = difficulties.slice(0, Math.floor(difficulties.length / 2));
    const secondHalf = difficulties.slice(Math.floor(difficulties.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trend = ((secondAvg - firstAvg) / firstAvg) * 100;

    const predictions: Array<{
      day: number;
      date: Date;
      difficulty: number;
    }> = [];
    let projectedDifficulty = latestDifficulty;

    for (let i = 1; i <= 7; i++) {
      projectedDifficulty *= 1 + trend / 100 / 7;
      predictions.push({
        day: i,
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        difficulty: projectedDifficulty,
      });
    }

    const result = {
      prediction: {
        available: true,
        current: latestDifficulty,
        average7d: avgDifficulty,
        trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
        trendPercent: trend,
        predictions,
        confidence: 0.7, // 70% confidence for simple linear model
      },
    };

    await cache.set(cacheKey, result, 600); // 10 minute cache

    return reply.send(result);
  });

  /**
   * Get anomaly detection alerts
   */
  fastify.get('/anomalies', async (request, reply) => {
    const userId = request.user!.userId;

    const anomalies: Array<{
      type: 'hashrate' | 'shares' | 'worker' | 'network';
      severity: 'high' | 'medium' | 'low';
      message: string;
      detectedAt: Date;
      workerId?: string;
      workerName?: string;
    }> = [];

    // Check for hashrate anomalies
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);

    const workers = await db.worker.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        hashrate: true,
        sharesAccepted: true,
        sharesRejected: true,
        lastShareAt: true,
        isOnline: true,
      },
    });

    for (const worker of workers) {
      // Check for stale workers (online but no recent shares)
      if (
        worker.isOnline &&
        worker.lastShareAt &&
        worker.lastShareAt < hourAgo
      ) {
        anomalies.push({
          type: 'worker',
          severity: 'high',
          message: `Worker "${worker.name}" is marked online but hasn't submitted shares in over an hour`,
          detectedAt: new Date(),
          workerId: worker.id,
          workerName: worker.name,
        });
      }

      // Check for high reject rates
      const total = Number(worker.sharesAccepted) + Number(worker.sharesRejected);
      if (total > 100) {
        const rejectRate = Number(worker.sharesRejected) / total;
        if (rejectRate > 0.1) {
          anomalies.push({
            type: 'shares',
            severity: rejectRate > 0.2 ? 'high' : 'medium',
            message: `Worker "${worker.name}" has ${(rejectRate * 100).toFixed(1)}% reject rate`,
            detectedAt: new Date(),
            workerId: worker.id,
            workerName: worker.name,
          });
        }
      }
    }

    return reply.send({ anomalies });
  });
}

export default aiRoutes;
