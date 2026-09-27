import { describe, expect, it } from 'vitest';
import { goldenClassIII } from '../__fixtures__/instruments.js';
import { getRulepack } from '../__fixtures__/rulepack.js';
import { Decimal } from '../decimal.js';
import {
  computeZeroReference,
  evaluateLoadRow,
  fixedLimitRow,
  maxAbsEc,
  notApplicable,
  verdictFromRows,
} from './shared.js';

const rulepack = getRulepack();

describe('evaluateLoadRow', () => {
  it('is INCOMPLETE for a rangeIndex the instrument does not declare', () => {
    const row = evaluateLoadRow(
      { rowId: 'x', L: '1000', I: '1000', deltaL: '1', rangeIndex: 3 },
      { instrument: goldenClassIII, rulepack, e0: '0' },
    );
    expect(row.verdict).toBe('INCOMPLETE');
    expect(row.issues.map((i) => i.code)).toContain('LOAD_OUT_OF_RANGE');
  });

  it('warns on a suspect reading far outside mpe(L)', () => {
    // L=10000, Ec would need to exceed 3×mpe(5g)=15g; use a huge I to force it.
    const row = evaluateLoadRow(
      { rowId: 'x', L: '10000', I: '10100', deltaL: '1' },
      { instrument: goldenClassIII, rulepack, e0: '0' },
    );
    expect(row.issues.map((i) => i.code)).toContain('OBS_SUSPECT_READING');
  });

  it('flags a load beyond the range Max as out of range', () => {
    const row = evaluateLoadRow(
      { rowId: 'x', L: '40000', I: '40000', deltaL: '1' },
      { instrument: goldenClassIII, rulepack, e0: '0' },
    );
    expect(row.issues.map((i) => i.code)).toContain('LOAD_OUT_OF_RANGE');
  });

  it('flags a negative load as out of range', () => {
    const row = evaluateLoadRow(
      { rowId: 'x', L: '-100', I: '0', deltaL: '1' },
      { instrument: goldenClassIII, rulepack, e0: '0' },
    );
    expect(row.issues.map((i) => i.code)).toContain('LOAD_OUT_OF_RANGE');
  });
});

describe('computeZeroReference', () => {
  it('is an error result for a rangeIndex the instrument does not declare', () => {
    const { issues } = computeZeroReference(
      { L: '50', I: '50', deltaL: '1' },
      goldenClassIII,
      3,
      rulepack,
    );
    expect(issues.map((i) => i.code)).toContain('LOAD_OUT_OF_RANGE');
  });
});

describe('fixedLimitRow', () => {
  it('is INCOMPLETE when a blocking issue is passed in', () => {
    const row = fixedLimitRow('x', new Decimal(1), new Decimal(5), new Decimal(1), [
      { code: 'OBS_MISSING', severity: 'error', params: {} },
    ]);
    expect(row.verdict).toBe('INCOMPLETE');
  });
});

describe('verdictFromRows', () => {
  it('is INCOMPLETE for an empty row set', () => {
    expect(verdictFromRows([])).toBe('INCOMPLETE');
  });
});

describe('maxAbsEc', () => {
  it('is undefined when no row carries an Ec', () => {
    expect(maxAbsEc([{ rowId: 'x', verdict: 'PASS', issues: [] }])).toBeUndefined();
  });
});

describe('notApplicable', () => {
  it('builds a NOT_APPLICABLE result carrying the reason', () => {
    const result = notApplicable(rulepack, 'Instrument has no tare device');
    expect(result.verdict).toBe('NOT_APPLICABLE');
    expect(result.issues[0]?.params['reason']).toBe('Instrument has no tare device');
  });
});
