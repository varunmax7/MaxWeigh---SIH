import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { type DiscriminationObservation, evaluateDiscrimination } from './discrimination.js';

const rulepack = getRulepack();

describe('evaluateDiscrimination (§4.6 DISCRIMINATION, d = 5 g)', () => {
  it('passes when the indication moves by exactly one d', () => {
    const obs: DiscriminationObservation = {
      rows: [{ rowId: 'Min', iBefore: '100', iAfter: '105' }],
    };
    const result = evaluateDiscrimination(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('PASS');
  });

  it('fails when the indication does not move', () => {
    const obs: DiscriminationObservation = {
      rows: [{ rowId: 'Max', iBefore: '30000', iAfter: '30000' }],
    };
    const result = evaluateDiscrimination(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('FAIL');
  });

  it('fails when the indication moves by more than one d', () => {
    const obs: DiscriminationObservation = {
      rows: [{ rowId: 'half', iBefore: '15000', iAfter: '15010' }],
    };
    const result = evaluateDiscrimination(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const obs: DiscriminationObservation = {
      rows: [{ rowId: 'x', iBefore: '100', iAfter: '105', rangeIndex: 3 }],
    };
    const result = evaluateDiscrimination(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('rolls three load points up to one verdict', () => {
    const obs: DiscriminationObservation = {
      rows: [
        { rowId: 'Min', iBefore: '100', iAfter: '105' },
        { rowId: 'half', iBefore: '15000', iAfter: '15005' },
        { rowId: 'Max', iBefore: '30000', iAfter: '30005' },
      ],
    };
    const result = evaluateDiscrimination(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('PASS');
    expect(result.rows).toHaveLength(3);
  });
});
