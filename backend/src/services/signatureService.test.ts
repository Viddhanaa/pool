import { describe, expect, test, vi, beforeEach } from 'vitest';
import { generateChallenge, validateChallenge, verifySignature } from './signatureService';
import { verifyMessage } from 'ethers';

vi.mock('ethers', () => ({
  verifyMessage: vi.fn()
}));

const mockVerify = verifyMessage as unknown as ReturnType<typeof vi.fn>;

describe('signatureService', () => {
  beforeEach(() => {
    mockVerify.mockReset();
  });

  test('generates and validates a challenge once', async () => {
    const { challenge } = await generateChallenge('0xabc');
    mockVerify.mockReturnValue('0xabc');
    const ok = await validateChallenge('0xabc', challenge);
    const sigOk = verifySignature('0xabc', '0xsig', challenge);
    expect(ok).toBe(true);
    expect(sigOk).toBe(true);
    const second = await validateChallenge('0xabc', challenge);
    expect(second).toBe(false);
  });

  test('rejects expired challenge', async () => {
    const { challenge } = await generateChallenge('0xabc');
    const parts = challenge.split(':');
    const nonce = parts[parts.length - 2];
    const stale = `Sign this message to verify ownership:${nonce}:0`;
    const ok = await validateChallenge('0xabc', stale);
    expect(ok).toBe(false);
  });
});
