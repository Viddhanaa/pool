import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

const makeCorrelationId = () => {
  if ((crypto as any).randomUUID) return (crypto as any).randomUUID();
  return crypto.randomBytes(16).toString('hex');
};

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const correlationId = makeCorrelationId();
  res.status(status).json({ error: err.message || 'Internal error', correlationId });
}
