import { FastifyRequest, FastifyReply } from 'fastify';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('auth-middleware');

export interface JwtPayload {
  userId: string;
  walletAddress: string;
  iat: number;
  exp: number;
}

export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = extractToken(request);
    
    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const decoded = await request.jwtVerify<JwtPayload>();
    (request as any).user = decoded;
  } catch (error) {
    logger.warn({ error, path: request.url }, 'Authentication failed');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token',
    });
  }
};

export const optionalAuth = async (
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> => {
  try {
    const token = extractToken(request);
    
    if (token) {
      const decoded = await request.jwtVerify<JwtPayload>();
      (request as any).user = decoded;
    }
  } catch {
    // Token is invalid, but we don't block the request
    (request as any).user = undefined;
  }
};

const extractToken = (request: FastifyRequest): string | null => {
  const authHeader = request.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Check for token in query params (for WebSocket connections)
  const queryToken = (request.query as Record<string, string>).token;
  if (queryToken) {
    return queryToken;
  }
  
  return null;
};

export const requireAuth = authenticate;

export const createAuthMiddleware = () => authenticate;
