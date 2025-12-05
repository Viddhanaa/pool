import { cache } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { wsManager } from './index.js';

const logger = createChildLogger('ws-handlers');

/**
 * Publish worker status update
 */
export async function publishWorkerStatus(data: {
  userId: string;
  workerId: string;
  workerName: string;
  hashrate: number;
  isOnline: boolean;
  lastShareAt?: Date;
}): Promise<void> {
  await cache.publish('worker:status', {
    ...data,
    timestamp: Date.now(),
  });

  logger.debug({ workerId: data.workerId }, 'Worker status published');
}

/**
 * Publish share submission
 */
export async function publishShareSubmission(data: {
  userId: string;
  workerId: string;
  workerName: string;
  difficulty: number;
  isValid: boolean;
}): Promise<void> {
  wsManager.emitToUser(data.userId, 'share:submitted', {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Publish payout completed
 */
export async function publishPayoutCompleted(data: {
  userId: string;
  payoutId: string;
  amount: number;
  txHash: string;
}): Promise<void> {
  await cache.publish('payout:completed', {
    ...data,
    timestamp: Date.now(),
  });

  logger.info({ payoutId: data.payoutId }, 'Payout completion published');
}

/**
 * Publish block found
 */
export async function publishBlockFound(data: {
  blockId: string;
  height: number;
  hash: string;
  reward: number;
  finder?: string;
  finderUserId?: string;
}): Promise<void> {
  await cache.publish('block:found', {
    ...data,
    timestamp: Date.now(),
  });

  // Also notify the finder directly
  if (data.finderUserId) {
    wsManager.emitToUser(data.finderUserId, 'block:found:personal', {
      ...data,
      timestamp: Date.now(),
    });
  }

  logger.info({ height: data.height }, 'Block found published');
}

/**
 * Publish pool stats update
 */
export async function publishPoolStats(data: {
  hashrate: number;
  activeWorkers: number;
  activeMiners: number;
  difficulty: number;
}): Promise<void> {
  await cache.publish('pool:stats', {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Publish user notification
 */
export async function publishUserNotification(
  userId: string,
  notification: {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
  }
): Promise<void> {
  wsManager.emitToUser(userId, 'notification', {
    ...notification,
    timestamp: Date.now(),
  });
}

/**
 * Publish earnings update
 */
export async function publishEarningsUpdate(data: {
  userId: string;
  balance: number;
  change: number;
}): Promise<void> {
  wsManager.emitToUser(data.userId, 'earnings:update', {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast maintenance notification
 */
export async function broadcastMaintenance(data: {
  type: 'scheduled' | 'emergency';
  message: string;
  startsAt?: Date;
  estimatedDuration?: number;
}): Promise<void> {
  wsManager.broadcast('maintenance', {
    ...data,
    timestamp: Date.now(),
  });

  logger.warn({ type: data.type }, 'Maintenance notification broadcast');
}

/**
 * Event handler registry for stratum server integration
 */
export const eventHandlers = {
  workerConnected: async (data: {
    userId: string;
    workerId: string;
    workerName: string;
    ipAddress: string;
  }) => {
    await publishWorkerStatus({
      userId: data.userId,
      workerId: data.workerId,
      workerName: data.workerName,
      hashrate: 0,
      isOnline: true,
    });

    await publishUserNotification(data.userId, {
      type: 'success',
      title: 'Worker Connected',
      message: `${data.workerName} has connected from ${data.ipAddress}`,
    });
  },

  workerDisconnected: async (data: {
    userId: string;
    workerId: string;
    workerName: string;
    reason: string;
  }) => {
    await publishWorkerStatus({
      userId: data.userId,
      workerId: data.workerId,
      workerName: data.workerName,
      hashrate: 0,
      isOnline: false,
    });

    await publishUserNotification(data.userId, {
      type: 'warning',
      title: 'Worker Disconnected',
      message: `${data.workerName} has disconnected: ${data.reason}`,
    });
  },

  shareAccepted: async (data: {
    userId: string;
    workerId: string;
    workerName: string;
    difficulty: number;
  }) => {
    await publishShareSubmission({
      userId: data.userId,
      workerId: data.workerId,
      workerName: data.workerName,
      difficulty: data.difficulty,
      isValid: true,
    });
  },

  shareRejected: async (data: {
    userId: string;
    workerId: string;
    workerName: string;
    difficulty: number;
    reason: string;
  }) => {
    await publishShareSubmission({
      userId: data.userId,
      workerId: data.workerId,
      workerName: data.workerName,
      difficulty: data.difficulty,
      isValid: false,
    });
  },

  blockFound: async (data: {
    blockId: string;
    height: number;
    hash: string;
    reward: number;
    finder?: string;
    finderUserId?: string;
  }) => {
    await publishBlockFound(data);
  },
};
