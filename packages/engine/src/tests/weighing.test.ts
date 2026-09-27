import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { evaluateWeighing, type WeighingObservation } from './weighing.js';

const rulepack = getRulepack();
const zeroRef = { L: '50', I: '50', deltaL: '3.0' }; // E0 = -0.5 g

describe('evaluateWeighing (§4.6 WEIGHING)', () => {
  it('passes when every row is within mpe(L)', () => {
    const obs: WeighingObservation = {
      zeroRef,
      ascending: [
        { rowId: 'a', L: '10000', I: '10000', deltaL: '1.5' }, // Ec=+1.5, mpe=5.0 → PASS
        { rowId: 'b', L: '30000', I: '30005', deltaL: '0.5' }, // Ec=+7.5, mpe=7.5 → PASS (boundary)
      ],
      descending: [],
    };
    const result = evaluateWeighing(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 2, stepFractionOfE: '0.1' },
    });
    expect(result.verdict).toBe('PASS');
    expect(result.rows.every((r) => r.verdict === 'PASS')).toBe(true);
  });

  it('fails when any row exceeds mpe(L)', () => {
    const obs: WeighingObservation = {
      zeroRef,
      ascending: [{ rowId: 'a', L: '2500', I: '2505', deltaL: '4.5' }], // Ec=+3.5, mpe=2.5 → FAIL
      descending: [],
    };
    const result = evaluateWeighing(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 1, stepFractionOfE: '0.1' },
    });
    expect(result.verdict).toBe('FAIL');
    expect(result.rows[0]?.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE, never PASS, when a row carries a blocking data-quality issue', () => {
    const obs: WeighingObservation = {
      zeroRef,
      ascending: [{ rowId: 'a', L: '10000', I: '10001', deltaL: '1.5' }], // I not a multiple of d=5
      descending: [],
    };
    const result = evaluateWeighing(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 1, stepFractionOfE: '0.1' },
    });
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('accepts descending rows with an explicit method and rangeIndex', () => {
    const obs: WeighingObservation = {
      zeroRef,
      ascending: [],
      descending: [
        {
          rowId: 'a',
          L: '10000',
          I: '10000',
          method: 'change_point',
          rangeIndex: 0,
          deltaL: '1.5',
        },
      ],
    };
    const result = evaluateWeighing(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 0, stepFractionOfE: '0.1' },
    });
    expect(result.rows[0]?.rowId).toBe('desc-a');
    expect(result.verdict).toBe('PASS');
  });

  it('accepts a row with no ΔL, via the direct method', () => {
    const obs: WeighingObservation = {
      zeroRef,
      ascending: [{ rowId: 'a', L: '10000', I: '10001', method: 'direct' }],
      descending: [],
    };
    const result = evaluateWeighing(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 0, stepFractionOfE: '0.1' },
    });
    expect(result.rows[0]?.P).toBe('10001');
  });

  it('doubles the mpe used per row when mpeContext is in_service', () => {
    const obs: WeighingObservation = {
      zeroRef,
      ascending: [{ rowId: 'a', L: '2500', I: '2505', deltaL: '4.5' }], // Ec=+3.5, initial mpe=2.5 → FAIL, in_service mpe=5.0 → PASS
      descending: [],
      mpeContext: 'in_service',
    };
    const result = evaluateWeighing(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 1, stepFractionOfE: '0.1' },
    });
    expect(result.rows[0]?.mpe).toBe('5');
    expect(result.rows[0]?.verdict).toBe('PASS');
  });

  it('stamps engineVersion and the pinned rulepack id@version', () => {
    const obs: WeighingObservation = { zeroRef, ascending: [], descending: [] };
    const result = evaluateWeighing(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 5, stepFractionOfE: '0.1' },
    });
    expect(result.rulepack).toEqual({ id: 'oiml-r76-1-2006', version: '1.0.0' });
    expect(result.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
