import cron from 'node-cron';
import { distributePoolRewards } from '../services/btcdPoolRewardEngine';
import { log } from '../lib/logger';

/**
 * BTCD Pool Reward Cron Job
 *
 * Schedule: Every 5 minutes (cron pattern: 0,5,10,15... minutes)
 * Purpose: Distributes BTCD rewards to all pool participants
 *
 * This cron job:
 * 1. Runs distributePoolRewards() every 5 minutes
 * 2. Handles errors gracefully without crashing
 * 3. Logs all executions for monitoring
 * 4. Continues running even if a single execution fails
 */

let cronTask: cron.ScheduledTask | null = null;
let isRunning = false;

/**
 * Starts the BTCD Pool reward distribution cron job.
 * Schedule: Every 5 minutes.
 *
 * @returns The cron task instance
 */
export function startPoolRewardCron(): cron.ScheduledTask {
  if (cronTask) {
    log.warn('poolRewardCron: already started', {
      message: 'Attempted to start pool reward cron but it is already running'
    });
    return cronTask;
  }

  log.info('poolRewardCron: starting', {
    schedule: '*/5 * * * *',
    message: 'BTCD Pool reward cron job starting'
  });

  cronTask = cron.schedule('*/5 * * * *', async () => {
    // Prevent overlapping executions
    if (isRunning) {
      log.warn('poolRewardCron: skipped (previous run still executing)', {
        message: 'Skipped pool reward distribution - previous execution still in progress'
      });
      return;
    }

    isRunning = true;
    const startTime = new Date();

    try {
      log.info('poolRewardCron: executing', {
        timestamp: startTime.toISOString(),
        message: 'Starting BTCD Pool reward distribution'
      });

      const result = await distributePoolRewards('btcd-main-pool');

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      if (result.success) {
        log.info('poolRewardCron: success', {
          totalDistributed: result.totalDistributed,
          userCount: result.userCount,
          durationMs,
          message: result.message
        });
      } else {
        log.warn('poolRewardCron: completed with warnings', {
          message: result.message,
          durationMs
        });
      }
    } catch (err) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      log.error('poolRewardCron: error', {
        error: err,
        durationMs,
        message: 'BTCD Pool reward distribution failed'
      });
    } finally {
      isRunning = false;
    }
  });

  log.info('poolRewardCron: started', {
    schedule: '*/5 * * * *',
    message: 'BTCD Pool reward cron job is now active'
  });

  return cronTask;
}

/**
 * Stops the BTCD Pool reward cron job.
 * Useful for graceful shutdown or testing.
 */
export function stopPoolRewardCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    isRunning = false;
    log.info('poolRewardCron: stopped', {
      message: 'BTCD Pool reward cron job has been stopped'
    });
  } else {
    log.warn('poolRewardCron: not running', {
      message: 'Attempted to stop pool reward cron but it is not running'
    });
  }
}

/**
 * Gets the current status of the cron job.
 * @returns Object with running status
 */
export function getPoolRewardCronStatus(): {
  isScheduled: boolean;
  isExecuting: boolean;
} {
  return {
    isScheduled: cronTask !== null,
    isExecuting: isRunning
  };
}
