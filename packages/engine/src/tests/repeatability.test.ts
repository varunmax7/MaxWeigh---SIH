import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { evaluateRepeatability, type RepeatabilityObservation } from './repeatability.js';

const rulepack = getRulepack();

// L = 15000 g → m = 3000 → class III mpe = 1.5e = 7.5 g (the ">2000e" band).
// P = I + e/2 − ΔL, e = 5 g:
//   I=15000, ΔL=2.5  → P = 15000.0
//   I=15010, ΔL=5.0  → P = 15007.5  → spread = 7.5 g, exactly at the limit
//   I=15015, ΔL=5.0  → P = 15012.5  → spread = 12.5 g, one d step (5 g) over

describe('evaluateRepeatability (§4.6 REPEATABILITY)', () => {
  it('passes at exactly the limit: spread == mpe(L)', () => {
    const obs: RepeatabilityObservation = {
      series: [
        {
          L: '15000',
          readings: [
            { rowId: 'r1', I: '15000', deltaL: '2.5' },
            { rowId: 'r2', I: '15010', deltaL: '5.0' },
          ],
        },
      ],
    };
    const result = evaluateRepeatability(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.rows[0]?.Ec).toBe('7.5');
    expect(result.rows[0]?.mpe).toBe('7.5');
    expect(result.verdict).toBe('PASS');
  });

  it('fails one step over the limit', () => {
    const obs: RepeatabilityObservation = {
      series: [
        {
          L: '15000',
          readings: [
            { rowId: 'r1', I: '15000', deltaL: '2.5' },
            { rowId: 'r2', I: '15015', deltaL: '5.0' },
          ],
        },
      ],
    };
    const result = evaluateRepeatability(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.rows[0]?.Ec).toBe('12.5');
    expect(result.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const obs: RepeatabilityObservation = { series: [{ L: '15000', rangeIndex: 3, readings: [] }] };
    const result = evaluateRepeatability(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.rows[0]?.verdict).toBe('INCOMPLETE');
  });

  it('is INCOMPLETE for a series with no readings at all', () => {
    const obs: RepeatabilityObservation = { series: [{ L: '15000', readings: [] }] };
    const result = evaluateRepeatability(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.rows[0]?.verdict).toBe('INCOMPLETE');
  });

  it('raises no warning when enough readings are supplied, and finds min/max over a non-monotonic series', () => {
    // I = 15000 throughout; ΔL varies so P = 15000 + 2.5 − ΔL swings up and down.
    const deltas = ['2.5', '0.5', '4.5', '1.0', '3.0', '2.0', '5.0', '1.5', '3.5', '4.0'];
    const obs: RepeatabilityObservation = {
      series: [
        {
          L: '15000',
          readings: deltas.map((deltaL, i) => ({
            rowId: `r${i}`,
            I: '15000',
            deltaL,
            method: 'change_point' as const,
          })),
        },
      ],
    };
    const result = evaluateRepeatability(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.issues.some((i) => i.code === 'OBS_MISSING')).toBe(false);
    // spread = max ΔL swing (4.5) since I is constant → 4.5 g ≤ mpe 7.5 g
    expect(result.rows[0]?.Ec).toBe('4.5');
    expect(result.verdict).toBe('PASS');
  });

  it('warns when fewer than the required readings are supplied', () => {
    const obs: RepeatabilityObservation = {
      series: [{ L: '15000', readings: [{ rowId: 'r1', I: '15000', deltaL: '2.5' }] }],
    };
    const result = evaluateRepeatability(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.issues.some((i) => i.code === 'OBS_MISSING' && i.severity === 'warning')).toBe(
      true,
    );
  });

  it('requires only 3 readings above the 1000 kg (instrument Max) threshold', () => {
    const heavy = { ...goldenClassIII, ranges: [{ max: '2000000', e: '5', d: '5' }] }; // instrument Max 2000 kg
    const obs: RepeatabilityObservation = {
      series: [
        {
          L: '1000000',
          readings: [
            { rowId: 'r1', I: '1000000', method: 'direct' as const },
            { rowId: 'r2', I: '1000005', method: 'direct' as const },
            { rowId: 'r3', I: '1000000', method: 'direct' as const },
          ],
        },
      ],
    };
    const result = evaluateRepeatability(obs, { instrument: heavy, rulepack, params: {} });
    expect(result.issues.some((i) => i.code === 'OBS_MISSING')).toBe(false); // 3 readings meet the 3 required
  });

  it('is INCOMPLETE when a reading carries a blocking data-quality issue', () => {
    const obs: RepeatabilityObservation = {
      series: [
        {
          L: '15000',
          readings: [
            { rowId: 'r1', I: '15000', deltaL: '2.5' },
            { rowId: 'r2', I: '15001', deltaL: '2.5' }, // not a multiple of d = 5
          ],
        },
      ],
    };
    const result = evaluateRepeatability(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.rows[0]?.verdict).toBe('INCOMPLETE');
  });
});
