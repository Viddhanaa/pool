import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { createServer } from 'http';
import { db, connectDatabase, disconnectDatabase } from './lib/db.js';
import { redis, connectRedis, disconnectRedis } from './lib/redis.js';
import { logger, createChildLogger } from './lib/logger.js';
import { wsManager } from './websocket/index.js';

// Routes
import authRoutes from './routes/auth.js';
import workerRoutes from './routes/workers.js';
import statsRoutes from './routes/stats.js';
import payoutRoutes from './routes/payouts.js';
import blockRoutes from './routes/blocks.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';

const appLogger = createChildLogger('app');

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof db;
    redis: typeof redis;
  }
}

export interface AppConfig {
  port: number;
  host: string;
  jwtSecret: string;
  corsOrigin: string | string[] | boolean;
  rateLimitMax: number;
  rateLimitWindow: number;
}

export async function buildApp(config?: Partial<AppConfig>): Promise<{
  app: FastifyInstance;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}> {
  // Parse CORS origins - support comma-separated list or '*' for all
  const parseCorsOrigin = (): string | string[] | boolean => {
    const origin = process.env.CORS_ORIGIN;
    if (!origin) {
      // Default: allow common development origins
      return ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
    }
    if (origin === '*' || origin === 'true') {
      return true; // Allow all origins
    }
    // Support comma-separated origins
    if (origin.includes(',')) {
      return origin.split(',').map(o => o.trim());
    }
    return origin;
  };

  const appConfig: AppConfig = {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    corsOrigin: parseCorsOrigin(),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    ...config,
  };

  // Create Fastify instance
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
              },
            }
          : undefined,
    },
    trustProxy: true,
  });

  // Register plugins
  await app.register(cors, {
    origin: appConfig.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflight: true,
    strictPreflight: false,
    preflightContinue: false,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(rateLimit, {
    max: appConfig.rateLimitMax,
    timeWindow: appConfig.rateLimitWindow,
    errorResponseBuilder: (request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)} seconds`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  await app.register(jwt, {
    secret: appConfig.jwtSecret,
    sign: {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    },
  });

  // Decorate with database and redis clients
  app.decorate('prisma', db);
  app.decorate('redis', redis);

  // Global error handler
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    appLogger.error(
      {
        error: error.message,
        stack: error.stack,
        path: request.url,
        method: request.method,
      },
      'Unhandled error'
    );

    // Don't expose internal errors in production
    const isDev = process.env.NODE_ENV === 'development';
    
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: isDev ? error.validation : undefined,
      });
    }

    const statusCode = error.statusCode || 500;
    
    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.name,
      message: isDev || statusCode < 500 ? error.message : 'An unexpected error occurred',
      ...(isDev && { stack: error.stack }),
    });
  });

  // Not found handler
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: false,
        redis: false,
      },
    };

    try {
      await db.$queryRaw`SELECT 1`;
      checks.checks.database = true;
    } catch {
      checks.status = 'degraded';
    }

    try {
      await redis.ping();
      checks.checks.redis = true;
    } catch {
      checks.status = 'degraded';
    }

    const statusCode = checks.status === 'healthy' ? 200 : 503;
    return reply.status(statusCode).send(checks);
  });

  // Ready check endpoint
  app.get('/ready', async (request, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      await redis.ping();
      return reply.status(200).send({ status: 'ready' });
    } catch {
      return reply.status(503).send({ status: 'not ready' });
    }
  });

  // API version info
  app.get('/api', async (request, reply) => {
    return reply.send({
      name: 'ViddhanaPool API',
      version: '1.0.0',
      documentation: '/api/docs',
    });
  });

  // Register routes (v1 API)
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(workerRoutes, { prefix: '/api/v1/workers' });
  await app.register(statsRoutes, { prefix: '/api/v1/stats' });
  await app.register(payoutRoutes, { prefix: '/api/v1/payouts' });
  await app.register(blockRoutes, { prefix: '/api/v1/blocks' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(aiRoutes, { prefix: '/api/v1/ai' });

  // Create HTTP server for Socket.io
  const httpServer = createServer(app.server);

  // Initialize WebSocket
  wsManager.initialize(httpServer, appConfig.jwtSecret);

  const start = async (): Promise<void> => {
    try {
      // Connect to databases
      await connectDatabase();
      await connectRedis();

      // Start server
      await app.listen({ port: appConfig.port, host: appConfig.host });
      
      appLogger.info(
        { port: appConfig.port, host: appConfig.host },
        'Server started'
      );
    } catch (error) {
      appLogger.error({ error }, 'Failed to start server');
      throw error;
    }
  };

  const stop = async (): Promise<void> => {
    try {
      await wsManager.close();
      await app.close();
      await disconnectDatabase();
      await disconnectRedis();
      appLogger.info('Server stopped');
    } catch (error) {
      appLogger.error({ error }, 'Error stopping server');
      throw error;
    }
  };

  return { app, start, stop };
}

export default buildApp;
