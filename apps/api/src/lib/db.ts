import { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('prisma');

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  client.$on('query', (e) => {
    logger.debug({ query: e.query, duration: e.duration }, 'Database query');
  });

  client.$on('error', (e) => {
    logger.error({ error: e.message }, 'Database error');
  });

  client.$on('warn', (e) => {
    logger.warn({ warning: e.message }, 'Database warning');
  });

  return client;
};

export const db = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await db.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await db.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error({ error }, 'Failed to disconnect from database');
    throw error;
  }
};

export default db;
