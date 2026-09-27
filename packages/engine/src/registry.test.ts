import { describe, expect, it } from 'vitest';
import { goldenClassIII } from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import { evaluateTest, UnknownTestCodeError, UnregisteredEvaluatorError } from './registry.js';
import type { ExamMarkingsObservation } from './tests/examMarkings.js';

const rulepack = getRulepack();

describe('evaluateTest (§4.10 registry dispatch)', () => {
  it('dispatches a test code to its registered evaluator, using the rule pack’s own params by default', () => {
    const obs: ExamMarkingsObservation = { items: [{ key: 'manufacturer_mark', status: 'ok' }] };
    const result = evaluateTest('EXAM_MARKINGS', obs, { instrument: goldenClassIII, rulepack });
    expect(result.verdict).toBe('PASS');
  });

  it('throws for a code the rule pack does not define', () => {
    expect(() => evaluateTest('NOT_A_CODE', {}, { instrument: goldenClassIII, rulepack })).toThrow(
      UnknownTestCodeError,
    );
  });

  it('throws when the rule pack names an evaluator that is not registered', () => {
    const brokenRulepack = {
      ...rulepack,
      tests: rulepack.tests.map((t) =>
        t.code === 'MODULE_COMPAT' ? { ...t, evaluator: 'moduleCompat@1' } : t,
      ),
    };
    expect(() =>
      evaluateTest('MODULE_COMPAT', {}, { instrument: goldenClassIII, rulepack: brokenRulepack }),
    ).toThrow(UnregisteredEvaluatorError);
  });

  it('accepts caller-supplied params instead of the rule pack default', () => {
    const obs = { zeroRef: { L: '50', I: '50', deltaL: '3.0' }, ascending: [], descending: [] };
    const result = evaluateTest('WEIGHING', obs, {
      instrument: goldenClassIII,
      rulepack,
      params: { minLoads: 0, stepFractionOfE: '0.1' },
    });
    // With minLoads:0 no "too few loads" warning is raised, unlike the rule pack's default of 5.
    expect(result.issues.some((i) => i.code === 'OBS_MISSING')).toBe(false);
  });
});
