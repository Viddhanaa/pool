import { describe, expect, test, vi, beforeEach } from 'vitest';
import { pingWithRetry } from './pingClient';

const mockPing = vi.fn();

vi.mock('../api', () => ({
  pingMiner: (...args: unknown[]) => mockPing(...args)
}));

describe('pingClient', () => {
  beforeEach(() => {
    mockPing.mockReset();
  });

  test('succeeds without retries', async () => {
    mockPing.mockResolvedValue({ ok: true });
    const result = await pingWithRetry(1, 1000);
    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(1);
  });

  test('retries on failure then succeeds', async () => {
    mockPing
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true });
    const result = await pingWithRetry(1, 1000, 'web', { baseDelayMs: 1 });
    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(2);
  });

  test('stops after max retries', async () => {
    mockPing.mockRejectedValue(new Error('500'));
    const result = await pingWithRetry(1, 1000, 'web', { maxRetries: 2, baseDelayMs: 1 });
    expect(result.ok).toBe(false);
    expect(result.attempt).toBe(2);
  });

  test('handles rate limit (429) with longer delay', async () => {
    const err429 = new Error('Rate limit');
    (err429 as any).status = 429;
    mockPing
      .mockRejectedValueOnce(err429)
      .mockResolvedValueOnce({ ok: true });
    const result = await pingWithRetry(1, 1000, 'web', { baseDelayMs: 100 });
    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(2);
  });

  test('does not retry on 400 bad request', async () => {
    const err400 = new Error('Bad request');
    (err400 as any).status = 400;
    mockPing.mockRejectedValueOnce(err400);
    const result = await pingWithRetry(1, 1000, 'web', { baseDelayMs: 1 });
    expect(result.ok).toBe(false);
    expect(result.attempt).toBe(1);
  });

  test('does not retry on 401 auth error', async () => {
    const err401 = new Error('Unauthorized');
    (err401 as any).status = 401;
    mockPing.mockRejectedValueOnce(err401);
    const result = await pingWithRetry(1, 1000, 'web', { baseDelayMs: 1 });
    expect(result.ok).toBe(false);
    expect(result.attempt).toBe(1);
  });
});
