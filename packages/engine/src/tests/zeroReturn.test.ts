import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { evaluateZeroReturn, type ZeroReturnObservation } from './zeroReturn.js';

const rulepack = getRulepack();

// limit = 0.5 e = 2.5 g for the golden class III instrument (e = 5 g).
describe('evaluateZeroReturn (§4.6 ZERO_RETURN, boundary)', () => {
  it('passes at exactly the limit', () => {
    const obs: ZeroReturnObservation = { i0Before: '0', i0After: '2.5' };
    const result = evaluateZeroReturn(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('PASS');
  });

  it('fails just over the limit', () => {
    const obs: ZeroReturnObservation = { i0Before: '0', i0After: '3.0' };
    const result = evaluateZeroReturn(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const obs: ZeroReturnObservation = { i0Before: '0', i0After: '2.5', rangeIndex: 3 };
    const result = evaluateZeroReturn(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('INCOMPLETE');
  });
});
