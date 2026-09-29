import { describe, expect, it, vi } from 'vitest';
import { mintPrintToken, verifyPrintToken } from './print-token.js';

// Mirrors apps/worker/src/print-token.test.ts — this module is a hand-kept
// copy of that one (see its own docstring for why), so both sides get the
// identical test coverage rather than trusting one to stand in for both.
const SECRET = 'a'.repeat(32);
const VERSION_ID = '11111111-1111-1111-1111-111111111111';

describe('print token', () => {
  it('verifies a token it just minted', () => {
    const token = mintPrintToken(SECRET, VERSION_ID);
    expect(verifyPrintToken(SECRET, VERSION_ID, token)).toBe(true);
  });

  it('refuses a token for a different version id', () => {
    const token = mintPrintToken(SECRET, VERSION_ID);
    expect(verifyPrintToken(SECRET, '22222222-2222-2222-2222-222222222222', token)).toBe(false);
  });

  it('refuses a token signed with a different secret', () => {
    const token = mintPrintToken(SECRET, VERSION_ID);
    expect(verifyPrintToken('b'.repeat(32), VERSION_ID, token)).toBe(false);
  });

  it('refuses a malformed token', () => {
    expect(verifyPrintToken(SECRET, VERSION_ID, 'not-a-token')).toBe(false);
    expect(verifyPrintToken(SECRET, VERSION_ID, '')).toBe(false);
  });

  it('refuses a token past its TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = mintPrintToken(SECRET, VERSION_ID, 60);
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    expect(verifyPrintToken(SECRET, VERSION_ID, token)).toBe(false);
    vi.useRealTimers();
  });

  it('refuses a tampered signature, not just a malformed one', () => {
    const token = mintPrintToken(SECRET, VERSION_ID);
    const [expiresAt] = token.split('.');
    expect(verifyPrintToken(SECRET, VERSION_ID, `${expiresAt}.${'0'.repeat(64)}`)).toBe(false);
  });
});
