import Redis from 'ioredis';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('redis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.warn({ attempt: times, delay }, 'Redis retry');
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  logger.error({ error: error.message }, 'Redis error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Cache utilities
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1;
  },

  async incr(key: string): Promise<number> {
    return redis.incr(key);
  },

  async expire(key: string, seconds: number): Promise<void> {
    await redis.expire(key, seconds);
  },

  async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await redis.hget(key, field);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  async hset(key: string, field: string, value: unknown): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await redis.hset(key, field, serialized);
  },

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const data = await redis.hgetall(key);
    const result: Record<string, T> = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        result[k] = JSON.parse(v) as T;
      } catch {
        result[k] = v as unknown as T;
      }
    }
    return result;
  },

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    const serialized = values.map((v) =>
      typeof v === 'string' ? v : JSON.stringify(v)
    );
    return redis.lpush(key, ...serialized);
  },

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await redis.lrange(key, start, stop);
    return values.map((v) => {
      try {
        return JSON.parse(v) as T;
      } catch {
        return v as unknown as T;
      }
    });
  },

  async publish(channel: string, message: unknown): Promise<number> {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    return redis.publish(channel, serialized);
  },
};

export const connectRedis = async (): Promise<void> => {
  if (redis.status === 'ready') {
    return;
  }
  
  // If already connecting, wait for it
  if (redis.status === 'connecting') {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 30000);
      
      redis.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
      redis.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timeout'));
    }, 30000);
    
    redis.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });
    redis.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
  logger.info('Redis disconnected');
};

export default redis;
