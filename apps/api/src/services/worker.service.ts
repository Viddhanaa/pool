import { db } from '../lib/db.js';
import { cache } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { Prisma } from '@prisma/client';

const logger = createChildLogger('worker-service');

export interface WorkerData {
  id: string;
  name: string;
  hashrate: number;
  sharesAccepted: number;
  sharesRejected: number;
  lastShareAt: Date | null;
  isOnline: boolean;
  difficulty: number;
  algorithm: string;
  version: string | null;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerListParams {
  userId: string;
  page: number;
  limit: number;
  isOnline?: boolean;
  sortBy?: 'hashrate' | 'name' | 'lastShareAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface WorkerUpdateData {
  name?: string;
  difficulty?: number;
  algorithm?: string;
}

export class WorkerService {
  private readonly CACHE_TTL = 30; // 30 seconds

  /**
   * Get workers for a user with pagination
   */
  async getWorkers(params: WorkerListParams): Promise<{
    workers: WorkerData[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { userId, page, limit, isOnline, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const where: Prisma.WorkerWhereInput = {
      userId,
      ...(isOnline !== undefined && { isOnline }),
    };

    const [workers, total] = await Promise.all([
      db.worker.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      db.worker.count({ where }),
    ]);

    return {
      workers: workers.map(this.mapWorkerToData),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single worker by ID
   */
  async getWorkerById(workerId: string, userId: string): Promise<WorkerData | null> {
    // Check cache first
    const cacheKey = `worker:${workerId}`;
    const cached = await cache.get<WorkerData>(cacheKey);
    
    if (cached && cached.id) {
      return cached;
    }

    const worker = await db.worker.findFirst({
      where: { id: workerId, userId },
    });

    if (!worker) {
      return null;
    }

    const workerData = this.mapWorkerToData(worker);
    
    // Cache the result
    await cache.set(cacheKey, workerData, this.CACHE_TTL);

    return workerData;
  }

  /**
   * Update a worker
   */
  async updateWorker(
    workerId: string,
    userId: string,
    data: WorkerUpdateData
  ): Promise<WorkerData | null> {
    const worker = await db.worker.findFirst({
      where: { id: workerId, userId },
    });

    if (!worker) {
      return null;
    }

    const updated = await db.worker.update({
      where: { id: workerId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.difficulty && { difficulty: data.difficulty }),
        ...(data.algorithm && { algorithm: data.algorithm }),
      },
    });

    // Invalidate cache
    await cache.del(`worker:${workerId}`);

    logger.info({ workerId, userId }, 'Worker updated');

    return this.mapWorkerToData(updated);
  }

  /**
   * Delete a worker
   */
  async deleteWorker(workerId: string, userId: string): Promise<boolean> {
    const worker = await db.worker.findFirst({
      where: { id: workerId, userId },
    });

    if (!worker) {
      return false;
    }

    await db.worker.delete({ where: { id: workerId } });

    // Invalidate cache
    await cache.del(`worker:${workerId}`);

    logger.info({ workerId, userId }, 'Worker deleted');

    return true;
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(workerId: string, userId: string): Promise<{
    hashrate24h: number[];
    shares24h: number;
    validShares24h: number;
    invalidShares24h: number;
    efficiency: number;
  } | null> {
    const worker = await db.worker.findFirst({
      where: { id: workerId, userId },
    });

    if (!worker) {
      return null;
    }

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const shares = await db.share.findMany({
      where: {
        workerId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      orderBy: { createdAt: 'asc' },
    });

    const validShares = shares.filter((s) => s.isValid).length;
    const invalidShares = shares.filter((s) => !s.isValid).length;
    const totalShares = shares.length;

    // Calculate hourly hashrate (simplified)
    const hashrate24h = this.calculateHourlyHashrate(shares);

    return {
      hashrate24h,
      shares24h: totalShares,
      validShares24h: validShares,
      invalidShares24h: invalidShares,
      efficiency: totalShares > 0 ? (validShares / totalShares) * 100 : 0,
    };
  }

  /**
   * Update worker status (called by stratum server)
   */
  async updateWorkerStatus(
    workerId: string,
    hashrate: number,
    isOnline: boolean,
    lastShareAt?: Date
  ): Promise<void> {
    await db.worker.update({
      where: { id: workerId },
      data: {
        hashrate,
        isOnline,
        ...(lastShareAt && { lastShareAt }),
      },
    });

    // Publish update for real-time notifications
    await cache.publish('worker:status', {
      workerId,
      hashrate,
      isOnline,
      lastShareAt,
    });
  }

  /**
   * Record a share submission
   */
  async recordShare(
    workerId: string,
    userId: string,
    difficulty: number,
    isValid: boolean,
    nonce?: string,
    hash?: string,
    blockId?: string
  ): Promise<void> {
    await db.$transaction(async (tx) => {
      // Create share record
      await tx.share.create({
        data: {
          workerId,
          userId,
          difficulty,
          isValid,
          nonce,
          hash,
          blockId,
        },
      });

      // Update worker stats
      if (isValid) {
        await tx.worker.update({
          where: { id: workerId },
          data: {
            sharesAccepted: { increment: 1 },
            lastShareAt: new Date(),
          },
        });
      } else {
        await tx.worker.update({
          where: { id: workerId },
          data: {
            sharesRejected: { increment: 1 },
          },
        });
      }
    });
  }

  /**
   * Get or create a worker
   */
  async getOrCreateWorker(
    userId: string,
    workerName: string,
    ipAddress?: string
  ): Promise<WorkerData> {
    let worker = await db.worker.findUnique({
      where: {
        userId_name: {
          userId,
          name: workerName,
        },
      },
    });

    if (!worker) {
      worker = await db.worker.create({
        data: {
          userId,
          name: workerName,
          ipAddress,
          isOnline: true,
        },
      });
      logger.info({ workerId: worker.id, userId, workerName }, 'Worker created');
    } else {
      // Update worker to online status
      worker = await db.worker.update({
        where: { id: worker.id },
        data: {
          isOnline: true,
          ...(ipAddress && { ipAddress }),
        },
      });
    }

    return this.mapWorkerToData(worker);
  }

  /**
   * Mark workers as offline if no recent activity
   */
  async markStaleWorkersOffline(thresholdMinutes: number = 5): Promise<number> {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - thresholdMinutes);

    const result = await db.worker.updateMany({
      where: {
        isOnline: true,
        OR: [
          { lastShareAt: { lt: threshold } },
          { lastShareAt: null, updatedAt: { lt: threshold } },
        ],
      },
      data: { isOnline: false },
    });

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Marked stale workers offline');
    }

    return result.count;
  }

  /**
   * Calculate hourly hashrate from shares
   */
  private calculateHourlyHashrate(shares: { difficulty: Prisma.Decimal; createdAt: Date }[]): number[] {
    const hourlyData: number[] = new Array(24).fill(0);
    const now = new Date();

    for (const share of shares) {
      const hoursAgo = Math.floor(
        (now.getTime() - share.createdAt.getTime()) / (1000 * 60 * 60)
      );
      if (hoursAgo >= 0 && hoursAgo < 24) {
        hourlyData[23 - hoursAgo] += Number(share.difficulty);
      }
    }

    // Convert difficulty to approximate hashrate
    return hourlyData.map((d) => d * 1000000); // Simplified conversion
  }

  /**
   * Map Prisma worker to WorkerData
   */
  private mapWorkerToData(worker: {
    id: string;
    name: string;
    hashrate: Prisma.Decimal;
    sharesAccepted: bigint;
    sharesRejected: bigint;
    lastShareAt: Date | null;
    isOnline: boolean;
    difficulty: Prisma.Decimal;
    algorithm: string;
    version: string | null;
    ipAddress: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkerData {
    return {
      id: worker.id,
      name: worker.name,
      hashrate: Number(worker.hashrate),
      sharesAccepted: Number(worker.sharesAccepted),
      sharesRejected: Number(worker.sharesRejected),
      lastShareAt: worker.lastShareAt,
      isOnline: worker.isOnline,
      difficulty: Number(worker.difficulty),
      algorithm: worker.algorithm,
      version: worker.version,
      ipAddress: worker.ipAddress,
      createdAt: worker.createdAt,
      updatedAt: worker.updatedAt,
    };
  }
}

export const workerService = new WorkerService();
export default workerService;
