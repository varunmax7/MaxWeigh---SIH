import { describe, expect, it } from 'vitest';
import {
  goldenClassIII,
  makeInstrument,
  multiIntervalClassIII,
} from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import { validateInstrument } from './classification.js';

const rulepack = getRulepack();

function codesOf(instrument: Parameters<typeof validateInstrument>[0]) {
  return validateInstrument(instrument, rulepack).map((issue) => issue.code);
}

describe('validateInstrument — Table 3 classification (§4.3)', () => {
  it('accepts the golden class III, 30 kg / 5 g instrument', () => {
    expect(codesOf(goldenClassIII)).toEqual([]);
  });

  it('flags n too high: class III, e = 1 g, Max 15 kg', () => {
    const instrument = makeInstrument({ accuracyClass: 'III', max: '15000', e: '1', min: '100' });
    expect(codesOf(instrument)).toContain('CLS_N_HIGH');
  });

  it('flags n too low: class II, e = 0.1 g, Max 300 g', () => {
    const instrument = makeInstrument({ accuracyClass: 'II', max: '300', e: '0.1', min: '5' });
    expect(codesOf(instrument)).toContain('CLS_N_LOW');
  });

  it('flags n too high: class IIII, e = 50 g, Max 60 kg', () => {
    const instrument = makeInstrument({
      accuracyClass: 'IIII',
      max: '60000',
      e: '50',
      min: '1000',
    });
    expect(codesOf(instrument)).toContain('CLS_N_HIGH');
  });

  it('rejects auxiliary indication for class III (d = 1 g, e = 5 g)', () => {
    const instrument = makeInstrument({
      accuracyClass: 'III',
      max: '30000',
      e: '5',
      d: '1',
      min: '100',
    });
    expect(codesOf(instrument)).toContain('CLS_AUX_NOT_ALLOWED');
  });

  it('accepts a valid class I auxiliary indication (Max 220 g, e = 1 mg, d = 0.1 mg)', () => {
    const instrument = makeInstrument({
      accuracyClass: 'I',
      max: '220',
      e: '0.001',
      d: '0.0001',
      min: '0.1',
    });
    expect(codesOf(instrument)).toEqual([]);
  });

  it('rejects a non-1/2/5 scale interval (e = 3 g)', () => {
    const instrument = makeInstrument({ accuracyClass: 'III', max: '3000', e: '3', min: '100' });
    expect(codesOf(instrument)).toContain('CLS_E_FORM');
  });

  it('flags Min below the lower limit: class III, Min = 50 g, e = 5 g (limit 100 g)', () => {
    const instrument = makeInstrument({ accuracyClass: 'III', max: '30000', e: '5', min: '50' });
    expect(codesOf(instrument)).toContain('CLS_MIN_LOW');
  });

  it('accepts a valid multi-interval instrument (class III, 6/15 kg, e 2/5 g)', () => {
    expect(codesOf(multiIntervalClassIII)).toEqual([]);
  });

  it('flags e not strictly increasing across intervals', () => {
    const instrument = {
      ...multiIntervalClassIII,
      ranges: [
        { max: '6000', e: '5', d: '5' },
        { max: '15000', e: '5', d: '5' },
      ],
    };
    expect(codesOf(instrument)).toContain('CLS_RANGE_E_NOT_INCREASING');
  });

  it('flags Max not strictly ascending across intervals', () => {
    const instrument = {
      ...multiIntervalClassIII,
      ranges: [
        { max: '15000', e: '2', d: '2' },
        { max: '15000', e: '5', d: '5' },
      ],
    };
    expect(codesOf(instrument)).toContain('CLS_RANGE_MAX_NOT_ASCENDING');
  });

  it('raises an info issue when the initial zero-setting range exceeds 20 % of Max', () => {
    const instrument = { ...goldenClassIII, initialZeroSettingRangePct: 25 };
    const issues = validateInstrument(instrument, rulepack);
    const info = issues.find((i) => i.code === 'CLS_ZERO_RANGE_SUPPL');
    expect(info?.severity).toBe('info');
  });

  it('does not raise the zero-range info issue at or below 20 %', () => {
    const instrument = { ...goldenClassIII, initialZeroSettingRangePct: 20 };
    expect(codesOf(instrument)).not.toContain('CLS_ZERO_RANGE_SUPPL');
  });

  it('rejects d greater than e', () => {
    const instrument = makeInstrument({
      accuracyClass: 'III',
      max: '30000',
      e: '5',
      d: '10',
      min: '100',
    });
    expect(codesOf(instrument)).toContain('CLS_D_EXCEEDS_E');
  });

  it('rejects a d/e ratio beyond 10x for auxiliary indication', () => {
    // e = 0.001 (power of ten in kg ✓) but d = 0.00005 → ratio 20, over the 10x limit
    const instrument = makeInstrument({
      accuracyClass: 'I',
      max: '220',
      e: '0.001',
      d: '0.00005',
      min: '0.1',
    });
    expect(codesOf(instrument)).toContain('CLS_AUX_RATIO');
  });

  it('flags a zero scale interval as the wrong form, without looping forever', () => {
    const instrument = makeInstrument({ accuracyClass: 'III', max: '30000', e: '0', min: '100' });
    expect(codesOf(instrument)).toContain('CLS_E_FORM');
  });

  it('does not crash and raises no Min issue for an instrument with no ranges declared', () => {
    const instrument = { ...goldenClassIII, ranges: [] };
    expect(codesOf(instrument)).toEqual([]);
  });

  it('rejects an e that is not a power of ten in kg for auxiliary indication', () => {
    // e = 0.002 g → in kg, 0.000002 = 2×10⁻⁶, not a pure power of ten
    const instrument = makeInstrument({
      accuracyClass: 'I',
      max: '220',
      e: '0.002',
      d: '0.0002',
      min: '0.1',
    });
    expect(codesOf(instrument)).toContain('CLS_AUX_E_FORM');
  });
});
