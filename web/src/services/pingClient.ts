import { pingMiner } from '../api';

export type ConnectionStatus = 'idle' | 'connected' | 'reconnecting' | 'offline';

type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
};

const DEFAULT_OPTS: RetryOptions = { maxRetries: 3, baseDelayMs: 1000 };

export async function pingWithRetry(
  minerId: number,
  hashrate: number,
  deviceType = 'web',
  opts: RetryOptions = {}
) {
  const { maxRetries, baseDelayMs } = { ...DEFAULT_OPTS, ...opts };
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < (maxRetries ?? 3)) {
    attempt += 1;
    try {
      const res = await pingMiner(minerId, hashrate, deviceType);
      return { ok: true, attempt, res };
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.response?.status;
      const msg = err?.message?.toString() ?? '';
      const isRateLimit = status === 429 || msg.includes('429');
      const isRetryable =
        isRateLimit ||
        status === undefined ||
        status >= 500 ||
        err?.name === 'TypeError'; // network error

      if (!isRetryable || attempt >= (maxRetries ?? 3)) {
        break;
      }

      // Exponential backoff: retry 1 = 1s, retry 2 = 2s, retry 3 = 4s
      const retryNumber = attempt; // attempt is number of tries so far, so retry number = attempt
      const delay = (baseDelayMs ?? 1000) * Math.pow(2, retryNumber - 1) * (isRateLimit ? 2 : 1);
      await sleep(delay);
    }
  }

  return { ok: false, attempt, error: lastError };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
