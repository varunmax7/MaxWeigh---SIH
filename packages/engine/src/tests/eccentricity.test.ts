import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { type EccentricityObservation, evaluateEccentricity } from './eccentricity.js';

const rulepack = getRulepack();
const zeroRef = { L: '50', I: '50', deltaL: '3.0' }; // E0 = -0.5 g

describe('evaluateEccentricity (§4.6 ECCENTRICITY)', () => {
  it('passes when every position is within mpe(L)', () => {
    const obs: EccentricityObservation = {
      zeroRef,
      positions: [
        { position: 'centre', L: '10000', I: '10000', deltaL: '1.5' },
        { position: 'Q1', L: '10000', I: '10000', deltaL: '1.5' },
      ],
    };
    const result = evaluateEccentricity(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('PASS');
  });

  it('accepts an explicit rangeIndex and method per position', () => {
    const obs: EccentricityObservation = {
      zeroRef,
      positions: [
        {
          position: 'centre',
          L: '10000',
          I: '10000',
          method: 'change_point',
          rangeIndex: 0,
          deltaL: '1.5',
        },
      ],
    };
    const result = evaluateEccentricity(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('PASS');
  });

  it('fails when a position exceeds mpe(L), using the direct method (no ΔL needed)', () => {
    const obs: EccentricityObservation = {
      zeroRef,
      positions: [
        { position: 'centre', L: '10000', I: '10000', deltaL: '1.5' },
        { position: 'Q2', L: '10000', I: '10015', method: 'direct' },
      ],
    };
    const result = evaluateEccentricity(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('FAIL');
    expect(result.rows.find((r) => r.rowId === 'Q2')?.verdict).toBe('FAIL');
  });
});
