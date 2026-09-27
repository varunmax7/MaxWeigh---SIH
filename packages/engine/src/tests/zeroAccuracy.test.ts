import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { evaluateZeroAccuracy, type ZeroAccuracyObservation } from './zeroAccuracy.js';

const rulepack = getRulepack();

// limit = 0.25 e = 1.25 g for the golden class III instrument (e = 5 g).
describe('evaluateZeroAccuracy (§4.6 ZERO_ACCURACY)', () => {
  it('passes when |E0| ≤ 0.25 e', () => {
    const obs: ZeroAccuracyObservation = { L: '50', I: '50', deltaL: '3.0' }; // E0 = -0.5 g
    const result = evaluateZeroAccuracy(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('PASS');
  });

  it('fails when |E0| exceeds 0.25 e', () => {
    const obs: ZeroAccuracyObservation = { L: '50', I: '50', deltaL: '5.0' }; // E0 = -2.5 g
    const result = evaluateZeroAccuracy(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const obs: ZeroAccuracyObservation = { L: '50', I: '50', deltaL: '3.0', rangeIndex: 3 };
    const result = evaluateZeroAccuracy(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('INCOMPLETE');
  });
});
