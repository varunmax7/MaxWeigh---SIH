import { describe, expect, it } from 'vitest';
import { computeEnvStability } from './env-stability.js';

describe('computeEnvStability', () => {
  it('is null with no readings', () => {
    expect(computeEnvStability([])).toBeNull();
  });

  it('is stable when temp/RH stay within the band', () => {
    const summary = computeEnvStability([
      { tempC: 22.0, rhPct: 54, ts: '2026-01-01T10:00:00Z' },
      { tempC: 22.5, rhPct: 55, ts: '2026-01-01T10:05:00Z' },
      { tempC: 22.3, rhPct: 53, ts: '2026-01-01T10:10:00Z' },
    ]);
    expect(summary).toEqual({
      sampleCount: 3,
      maxTempDeltaC: 0.5,
      maxRhDeltaPct: 2,
      stable: true,
    });
  });

  it('flags drift beyond the band as unstable', () => {
    const summary = computeEnvStability([
      { tempC: 20, rhPct: 50, ts: '2026-01-01T10:00:00Z' },
      { tempC: 23.5, rhPct: 50, ts: '2026-01-01T10:30:00Z' },
    ]);
    expect(summary?.stable).toBe(false);
    expect(summary?.maxTempDeltaC).toBeCloseTo(3.5);
  });
});
