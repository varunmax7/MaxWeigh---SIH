import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { type CreepObservation, evaluateCreep } from './creep.js';

const rulepack = getRulepack();

describe('evaluateCreep (§4.6 CREEP, load ≈ Max = 30 kg)', () => {
  it('passes within the 30-minute criteria (drift ≤ 0.5 e and last 15 min ≤ 0.2 e)', () => {
    const obs: CreepObservation = {
      L: '30000',
      readings: [
        { tMin: 0, i: '30000' },
        { tMin: 5, i: '30002' }, // drift 2 g ≤ 2.5 g limit
        { tMin: 15, i: '30002' },
        { tMin: 30, i: '30002' }, // t15→t30 drift 0 ≤ 1 g limit
      ],
    };
    const result = evaluateCreep(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('PASS');
  });

  it('fails the 30-minute criteria but passes via the 4-hour reading within mpe(L)', () => {
    const obs: CreepObservation = {
      L: '30000',
      readings: [
        { tMin: 0, i: '30000' },
        { tMin: 5, i: '30003' }, // drift 3 g > 2.5 g limit — fails
        { tMin: 15, i: '30003' },
        { tMin: 30, i: '30006' }, // drift 6 g > 2.5 g; t15→t30 = 3 g > 1 g — fails
        { tMin: 240, i: '30005' }, // drift 5 g ≤ mpe(30000) = 7.5 g — the fallback passes
      ],
    };
    const result = evaluateCreep(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.rows.some((r) => r.verdict === 'FAIL')).toBe(true); // 30-min rows genuinely failed
    expect(result.verdict).toBe('PASS'); // but the 4 h fallback carries the test
  });

  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const obs: CreepObservation = {
      L: '30000',
      rangeIndex: 3,
      readings: [{ tMin: 0, i: '30000' }],
    };
    const result = evaluateCreep(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('is INCOMPLETE when the t = 0 reading is missing', () => {
    const obs: CreepObservation = { L: '30000', readings: [{ tMin: 5, i: '30000' }] };
    const result = evaluateCreep(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('is INCOMPLETE when a scheduled reading is missing and there is no 4 h fallback', () => {
    const obs: CreepObservation = {
      L: '30000',
      readings: [
        { tMin: 0, i: '30000' },
        { tMin: 30, i: '30001' }, // t=5 and t=15 never taken
      ],
    };
    const result = evaluateCreep(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.issues.some((i) => i.code === 'OBS_MISSING' && i.severity === 'error')).toBe(
      true,
    );
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('fails outright when the 30-minute criteria fail and no 4-hour reading was taken', () => {
    const obs: CreepObservation = {
      L: '30000',
      readings: [
        { tMin: 0, i: '30000' },
        { tMin: 5, i: '30003' },
        { tMin: 15, i: '30003' },
        { tMin: 30, i: '30006' },
      ],
    };
    const result = evaluateCreep(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('FAIL');
  });
});
