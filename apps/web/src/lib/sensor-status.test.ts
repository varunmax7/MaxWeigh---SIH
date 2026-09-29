import { describe, expect, it } from 'vitest';
import { deriveSensorStatus } from './sensor-status.js';

describe('deriveSensorStatus', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');

  it('is unknown when no reading has ever arrived', () => {
    expect(deriveSensorStatus(null, now)).toBe('unknown');
  });

  it('is live within 30s', () => {
    expect(deriveSensorStatus(new Date(now.getTime() - 10_000), now)).toBe('live');
    expect(deriveSensorStatus(new Date(now.getTime() - 30_000), now)).toBe('live');
  });

  it('is stale between 30s and 2min', () => {
    expect(deriveSensorStatus(new Date(now.getTime() - 31_000), now)).toBe('stale');
    expect(deriveSensorStatus(new Date(now.getTime() - 120_000), now)).toBe('stale');
  });

  it('is offline past 2min — the acceptance criterion boundary', () => {
    expect(deriveSensorStatus(new Date(now.getTime() - 120_001), now)).toBe('offline');
    expect(deriveSensorStatus(new Date(now.getTime() - 600_000), now)).toBe('offline');
  });
});
