import { describe, expect, it } from 'vitest';
import type { TestResult } from './types.js';
import { aggregateEvaluation } from './verdict.js';

function stub(verdict: TestResult['verdict']): TestResult {
  return {
    verdict,
    rows: [],
    summary: {},
    issues: [],
    steps: [],
    engineVersion: '0.1.0',
    rulepack: { id: 'x', version: '1.0.0' },
  };
}

describe('aggregateEvaluation (§4.9)', () => {
  it('CONFORMS when every applicable test passes', () => {
    const result = aggregateEvaluation({ WEIGHING: stub('PASS'), ECCENTRICITY: stub('PASS') });
    expect(result.verdict).toBe('CONFORMS');
  });

  it('CONFORMS when a NOT_APPLICABLE test sits alongside passes', () => {
    const result = aggregateEvaluation({ WEIGHING: stub('PASS'), TILTING: stub('NOT_APPLICABLE') });
    expect(result.verdict).toBe('CONFORMS');
  });

  it('DOES_NOT_CONFORM when any applicable test fails', () => {
    const result = aggregateEvaluation({ WEIGHING: stub('PASS'), ECCENTRICITY: stub('FAIL') });
    expect(result.verdict).toBe('DOES_NOT_CONFORM');
  });

  it('INCOMPLETE when a test has not been run to a verdict, with no FAIL present', () => {
    const result = aggregateEvaluation({
      WEIGHING: stub('PASS'),
      ECCENTRICITY: stub('INCOMPLETE'),
    });
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('INCOMPLETE when there are no applicable tests at all', () => {
    const result = aggregateEvaluation({ TILTING: stub('NOT_APPLICABLE') });
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('INCOMPLETE for an empty test set', () => {
    expect(aggregateEvaluation({}).verdict).toBe('INCOMPLETE');
  });

  it('carries every test into the summary, including NOT_APPLICABLE ones', () => {
    const result = aggregateEvaluation({ WEIGHING: stub('PASS'), TILTING: stub('NOT_APPLICABLE') });
    expect(result.tests).toEqual([
      { code: 'WEIGHING', verdict: 'PASS' },
      { code: 'TILTING', verdict: 'NOT_APPLICABLE' },
    ]);
  });
});
