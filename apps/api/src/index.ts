import { buildApp } from './app.js';
import { createChildLogger } from './lib/logger.js';
import { workerService } from './services/worker.service.js';
import { statsService } from './services/stats.service.js';
import { payoutService } from './services/payout.service.js';

const logger = createChildLogger('main');

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const warnings: string[] = [];
  
  // Required for production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'development-secret-change-in-production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set');
    }
  }
  
  // Warnings for missing optional config
  if (!process.env.DATABASE_URL) {
    warnings.push('DATABASE_URL not set, using default');
  }
  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set, using localhost:6379');
  }
  if (!process.env.ETH_RPC_URL) {
    warnings.push('ETH_RPC_URL not set, blockchain features disabled');
  }
  if (!process.env.POOL_WALLET_PRIVATE_KEY) {
    warnings.push('POOL_WALLET_PRIVATE_KEY not set, payouts disabled');
  }
  
  warnings.forEach(w => logger.warn(w));
}

async function main(): Promise<void> {
  logger.info('Starting ViddhanaPool API...');

  // Validate environment
  validateEnvironment();

  const { app, start, stop } = await buildApp();

  // Graceful shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');
    
    try {
      await stop();
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
  });

  // Start the server
  await start();

  // Start background tasks
  startBackgroundTasks();
}

/**
 * Start background maintenance tasks
 */
function startBackgroundTasks(): void {
  // Mark stale workers offline every minute
  setInterval(async () => {
    try {
      await workerService.markStaleWorkersOffline(5);
    } catch (error) {
      logger.error({ error }, 'Failed to mark stale workers offline');
    }
  }, 60 * 1000);

  // Record pool stats every 5 minutes
  setInterval(async () => {
    try {
      await statsService.recordPoolStats();
    } catch (error) {
      logger.error({ error }, 'Failed to record pool stats');
    }
  }, 5 * 60 * 1000);

  // Process automatic payouts every 10 minutes
  setInterval(async () => {
    try {
      await payoutService.processAutomaticPayouts();
    } catch (error) {
      logger.error({ error }, 'Failed to process automatic payouts');
    }
  }, 10 * 60 * 1000);

  // Retry failed payouts every 30 minutes
  setInterval(async () => {
    try {
      await payoutService.retryFailedPayouts();
    } catch (error) {
      logger.error({ error }, 'Failed to retry failed payouts');
    }
  }, 30 * 60 * 1000);

  logger.info('Background tasks started');
}

// Run the application
main().catch((error) => {
  logger.fatal({ error }, 'Failed to start application');
  process.exit(1);
});
