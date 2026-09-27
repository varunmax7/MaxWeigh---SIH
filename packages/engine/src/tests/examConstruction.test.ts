import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { type ExamConstructionObservation, evaluateExamConstruction } from './examConstruction.js';

const rulepack = getRulepack();

describe('evaluateExamConstruction (§4.6 EXAM_CONSTRUCTION)', () => {
  it('passes when construction matches documentation and sealing is intact', () => {
    const obs: ExamConstructionObservation = {
      items: [
        { key: 'matches_documentation', status: 'ok' },
        { key: 'sealing_intact', status: 'ok' },
        { key: 'software_identification', status: 'ok' },
      ],
    };
    const result = evaluateExamConstruction(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('PASS');
  });

  it('fails when sealing has been broken', () => {
    const obs: ExamConstructionObservation = {
      items: [{ key: 'sealing_intact', status: 'fail', note: 'seal cut on junction box' }],
    };
    const result = evaluateExamConstruction(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('FAIL');
  });

  it('fails an item with no note attached', () => {
    const obs: ExamConstructionObservation = { items: [{ key: 'sealing_intact', status: 'fail' }] };
    const result = evaluateExamConstruction(obs, {
      instrument: goldenClassIII,
      rulepack,
      params: {},
    });
    expect(result.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE with no checklist items at all', () => {
    const result = evaluateExamConstruction(
      { items: [] },
      { instrument: goldenClassIII, rulepack, params: {} },
    );
    expect(result.verdict).toBe('INCOMPLETE');
  });
});
