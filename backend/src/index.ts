import { config } from './config/env';
import { log } from './lib/logger';
import { startBackgroundTasks } from './tasks/scheduler';
import { createApp } from './server';
import { initBlockRewardService } from './services/blockRewardService';

const app = createApp();
app.listen(config.port, () => {
  log.info(`API listening on :${config.port}`);
});

startBackgroundTasks();

// Initialize block reward service
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
initBlockRewardService(ADMIN_PRIVATE_KEY).catch((error) => {
  log.error('Failed to initialize block reward service', error);
});
