import { Request, Response, NextFunction } from 'express';
import { redis } from '../db/redis';

interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  idFrom?: (req: Request) => string | number | null | undefined;
}

export function rateLimit(options: RateLimitOptions) {
  const { key, limit, windowSeconds, idFrom } = options;
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = idFrom?.(req) ?? req.ip;
    const redisKey = `ratelimit:${key}:${identifier}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    if (count > limit) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    next();
  };
}
