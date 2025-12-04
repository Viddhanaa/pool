import cron from 'node-cron';
import { processWithdrawals } from '../services/btcdPoolWithdrawalService';
import { log } from '../lib/logger';

/**
 * BTCD Pool Withdrawal Worker
 * Processes pending withdrawals every 1 minute
 *
 * Schedule: '* * * * *' (every minute)
 * - Picks up to 10 pending withdrawals per cycle
 * - Sends BTCD on-chain from admin wallet
 * - Updates withdrawal status (completed/failed)
 * - Restores balance on failure
 */

let isRunning = false;

async function runWithdrawalWorker() {
  // Prevent overlapping executions
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    await processWithdrawals();
  } catch (err) {
    log.error('Withdrawal worker cycle failed', { error: err });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the withdrawal worker cron job
 * Called from startBackgroundTasks in scheduler.ts
 */
export function startWithdrawalWorker(): void {
  // Run every 1 minute
  const cronExpression = '* * * * *';

  cron.schedule(cronExpression, () => {
    runWithdrawalWorker().catch((err) => {
      log.error('Unhandled error in withdrawal worker', { error: err });
    });
  });

  log.info('BTCD Pool withdrawal worker started', { schedule: cronExpression });
}

// Export for testing
export { runWithdrawalWorker };
