import cron from 'node-cron';
import { withdrawalQueue } from '../queues/withdrawalQueue';
import { cleanupOldData } from '../services/cleanupService';
import { runRewardCycle } from '../services/rewardEngine';
import { markOfflineMiners } from '../services/statusService';
import { processWithdrawal } from '../services/withdrawalService';
import { getConfig } from '../services/configService';
import { log } from '../lib/logger';
import { ensureMiningPartitions } from '../services/partitionService';
import { startPoolRewardCron } from './poolRewardCron';
import { startWithdrawalWorker } from './withdrawalWorker';

export function startBackgroundTasks() {
  const rewardLoop = async () => {
    try {
      const cfg = await getConfig();
      await runRewardCycle(cfg.rewardUpdateIntervalMinutes);
      setTimeout(rewardLoop, cfg.rewardUpdateIntervalMinutes * 60_000);
    } catch (err) {
      log.error('reward cycle failed', err);
      setTimeout(rewardLoop, 60_000);
    }
  };
  rewardLoop();

  ensureMiningPartitions().catch((err) => log.error('partition ensure failed', err));
  cron.schedule('0 0 * * *', () =>
    ensureMiningPartitions().catch((err) => log.error('partition ensure failed', err))
  );

  cron.schedule('0 3 * * *', () => {
    cleanupOldData().catch((err) => log.error('cleanup failed', err));
  });

  const offlineLoop = async () => {
    try {
      const cfg = await getConfig();
      await markOfflineMiners();
      setTimeout(offlineLoop, cfg.pingTimeoutSeconds * 1000);
    } catch (err) {
      log.error('offline sweep failed', err);
      setTimeout(offlineLoop, 30_000);
    }
  };
  offlineLoop();

  withdrawalQueue.start((id) => processWithdrawal(id));

  // Start BTCD Pool withdrawal worker (every 1 minute)
  startWithdrawalWorker();

  // Start BTCD Pool reward distribution cron (every 5 minutes)
  startPoolRewardCron();
  log.info('BTCD Pool reward cron started');
}
