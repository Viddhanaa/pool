import { NextFunction, Request, Response } from 'express';
import { log } from '../lib/logger';

export function logRequests(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    log.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}
