import { redis } from '../db/redis';
import { log } from '../lib/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
}

export class ResponseCache {
  private prefix: string;

  constructor(prefix: string = 'cache') {
    this.prefix = prefix;
  }

  /**
   * Generate cache key from request parameters
   */
  private generateKey(endpoint: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return `${this.prefix}:${endpoint}:${sortedParams}`;
  }

  /**
   * Get cached response
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      log.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set cached response
   */
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
    } catch (error) {
      log.error('Cache set error', { key, error });
    }
  }

  /**
   * Invalidate cache by key pattern
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      // Note: In production, use Redis SCAN instead of KEYS for better performance
      const key = `${this.prefix}:${pattern}`;
      await redis.del(key);
      log.info('Cache invalidated', { pattern });
    } catch (error) {
      log.error('Cache invalidation error', { pattern, error });
    }
  }

  /**
   * Middleware for automatic caching
   */
  middleware(endpoint: string, options: CacheOptions = {}) {
    const ttl = options.ttl || 300; // Default 5 minutes

    return async (req: any, res: any, next: any) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Generate cache key from query params
      const cacheKey = options.key || this.generateKey(endpoint, req.query);

      // Try to get from cache
      const cached = await this.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = (data: any) => {
        // Cache the response
        this.set(cacheKey, data, ttl).catch(err => 
          log.error('Failed to cache response', { cacheKey, error: err })
        );
        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    };
  }

  /**
   * Wrapper function for caching any async function result
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }
}

// Export singleton instance
export const responseCache = new ResponseCache();
