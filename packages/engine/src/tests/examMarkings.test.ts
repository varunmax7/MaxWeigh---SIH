import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { type ExamMarkingsObservation, evaluateExamMarkings } from './examMarkings.js';

const rulepack = getRulepack();

describe('evaluateExamMarkings (§4.6 EXAM_MARKINGS)', () => {
  it('passes when every checklist item is ok', () => {
    const obs: ExamMarkingsObservation = {
      items: [
        { key: 'manufacturer_mark', status: 'ok' },
        { key: 'accuracy_class', status: 'ok' },
        { key: 'temperature_range', status: 'not_applicable' },
      ],
    };
    const result = evaluateExamMarkings(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('PASS');
  });

  it('fails when any mandatory item fails', () => {
    const obs: ExamMarkingsObservation = {
      items: [
        { key: 'manufacturer_mark', status: 'ok' },
        { key: 'serial_no', status: 'fail', note: 'missing plate' },
      ],
    };
    const result = evaluateExamMarkings(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('FAIL');
  });

  it('fails an item with no note attached', () => {
    const obs: ExamMarkingsObservation = { items: [{ key: 'serial_no', status: 'fail' }] };
    const result = evaluateExamMarkings(obs, { instrument: goldenClassIII, rulepack, params: {} });
    expect(result.verdict).toBe('FAIL');
  });

  it('is INCOMPLETE with no checklist items at all', () => {
    const result = evaluateExamMarkings(
      { items: [] },
      { instrument: goldenClassIII, rulepack, params: {} },
    );
    expect(result.verdict).toBe('INCOMPLETE');
  });
});
