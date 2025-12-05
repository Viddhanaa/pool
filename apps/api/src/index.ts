import { buildApp } from './app.js';
import { createChildLogger } from './lib/logger.js';
import { workerService } from './services/worker.service.js';
import { statsService } from './services/stats.service.js';
import { payoutService } from './services/payout.service.js';

const logger = createChildLogger('main');

async function main(): Promise<void> {
  logger.info('Starting ViddhanaPool API...');

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
