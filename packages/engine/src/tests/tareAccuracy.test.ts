import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { evaluateTareAccuracy, type TareAccuracyObservation } from './tareAccuracy.js';

const rulepack = getRulepack();

describe('evaluateTareAccuracy (§4.6 TARE_ACCURACY, limit 0.25 e = 1.25 g)', () => {
  it('passes within the limit', () => {
    const obs: TareAccuracyObservation = { L: '50', I: '50', deltaL: '3.0' }; // E = -0.5 g
    const result = evaluateTareAccuracy(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('PASS');
  });

  it('fails beyond the limit', () => {
    const obs: TareAccuracyObservation = { L: '50', I: '50', deltaL: '5.0' }; // E = -2.5 g
    const result = evaluateTareAccuracy(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const obs: TareAccuracyObservation = { L: '50', I: '50', deltaL: '3.0', rangeIndex: 3 };
    const result = evaluateTareAccuracy(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('INCOMPLETE');
  });
});
