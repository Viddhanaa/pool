import { pingWithRetry } from './pingClient';

export type MiningStatus = 'stopped' | 'mining' | 'paused' | 'error';

export interface MiningSession {
  minerId: number;
  hashrate: number;
  deviceType?: string;
  pingIntervalSeconds?: number;
}

export class AutoMiner {
  private intervalId: number | null = null;
  private status: MiningStatus = 'stopped';
  private session: MiningSession | null = null;
  private successCount = 0;
  private failCount = 0;
  private lastError: string | null = null;

  constructor() {}

  start(session: MiningSession) {
    if (this.intervalId) {
      this.stop();
    }

    this.session = session;
    this.status = 'mining';
    this.successCount = 0;
    this.failCount = 0;
    this.lastError = null;

    const intervalMs = (session.pingIntervalSeconds || 5) * 1000;

    // Ping immediately
    this.doPing();

    // Then ping at intervals
    this.intervalId = window.setInterval(() => {
      this.doPing();
    }, intervalMs);

    console.log(`⛏️ Auto-mining started for miner ${session.minerId} (ping every ${session.pingIntervalSeconds || 5}s)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.status = 'stopped';
    console.log('⏹️ Auto-mining stopped');
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.status = 'paused';
    console.log('⏸️ Auto-mining paused');
  }

  resume() {
    if (!this.session) return;
    if (this.status === 'paused') {
      this.start(this.session);
    }
  }

  getStatus(): {
    status: MiningStatus;
    successCount: number;
    failCount: number;
    lastError: string | null;
  } {
    return {
      status: this.status,
      successCount: this.successCount,
      failCount: this.failCount,
      lastError: this.lastError,
    };
  }

  private async doPing() {
    if (!this.session) return;

    try {
      const result = await pingWithRetry(
        this.session.minerId,
        this.session.hashrate,
        this.session.deviceType || 'web',
        { maxRetries: 3, baseDelayMs: 1000 }
      );

      if (result.ok) {
        this.successCount++;
        this.lastError = null;
        this.status = 'mining';
        console.log(`✅ Ping #${this.successCount} successful (${result.attempt} attempts)`);
      } else {
        this.failCount++;
        this.lastError = String(result.error);
        this.status = 'error';
        console.error(`❌ Ping failed after ${result.attempt} attempts:`, result.error);

        // Auto-stop after 5 consecutive failures
        if (this.failCount >= 5) {
          console.error('🛑 Too many failures, stopping auto-miner');
          this.stop();
        }
      }
    } catch (err) {
      this.failCount++;
      this.lastError = String(err);
      this.status = 'error';
      console.error('❌ Ping error:', err);
    }
  }
}

// Singleton instance
export const autoMiner = new AutoMiner();
