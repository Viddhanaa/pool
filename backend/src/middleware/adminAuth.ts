import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { log } from '../lib/logger';

export interface AdminRequest extends Request {
  admin?: boolean;
}

export function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  // Skip auth for login endpoint
  if (req.path === '/login') {
    return next();
  }
  
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, config.adminJwtSecret) as { role?: string };
    if (payload.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.admin = true;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
