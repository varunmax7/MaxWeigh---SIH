import { describe, expect, it } from 'vitest';
import {
  goldenClassIII,
  makeInstrument,
  multiIntervalClassIII,
} from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import { mpe, mpeBandBoundaries } from './mpe.js';

const rulepack = getRulepack();

describe('mpe — Table 6 maximum permissible errors (§4.4)', () => {
  it.each([
    ['2500', '2.5'],
    ['2505', '5'],
    ['10000', '5'],
    ['10005', '7.5'],
  ])('class III, e = 5 g: load %s g → mpe %s g', (load, expected) => {
    expect(mpe(goldenClassIII, load, rulepack).value).toBe(expected);
  });

  it('doubles the MPE for in-service context', () => {
    const initial = mpe(goldenClassIII, '10005', rulepack, { context: 'initial' });
    const inService = mpe(goldenClassIII, '10005', rulepack, { context: 'in_service' });
    expect(inService.value).toBe('15');
    expect(initial.value).toBe('7.5');
  });

  it('reports boundaries at each MPE band transition', () => {
    expect(mpeBandBoundaries(goldenClassIII, rulepack)).toEqual(['2500', '10000']);
  });

  it('excludes a boundary that falls beyond the range it would apply to', () => {
    // e = 5 g but Max = 1000 g: both Table 6 boundaries (2500 g, 10000 g) exceed Max.
    const instrument = makeInstrument({ accuracyClass: 'III', max: '1000', e: '5', min: '100' });
    expect(mpeBandBoundaries(instrument, rulepack)).toEqual([]);
  });

  it('excludes a boundary that falls at or below the previous range in a multi-range instrument', () => {
    const instrument = {
      ...goldenClassIII,
      kind: 'multi_range' as const,
      ranges: [
        { max: '10000', e: '2', d: '2' }, // boundaries here: 1000, 4000
        { max: '30000', e: '5', d: '5' }, // boundaries here (2500, 10000) fall at/under prevMax=10000
      ],
    };
    expect(mpeBandBoundaries(instrument, rulepack)).toEqual(['1000', '4000']);
  });

  it('reports no boundaries when the rule pack has none for the class', () => {
    const noBandsForIII = { ...rulepack, mpeBands: { ...rulepack.mpeBands, III: undefined } };
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed for this defensive-path test
    expect(mpeBandBoundaries(goldenClassIII, noBandsForIII as any)).toEqual([]);
  });

  it.each([
    ['I', '1', '50000', '0.5'], // m = 50000, boundary inclusive
    ['I', '1', '50001', '1'], // m = 50001, just over
    ['II', '1', '5000', '0.5'],
    ['II', '1', '5001', '1'],
    ['IIII', '1', '50', '0.5'],
    ['IIII', '1', '51', '1'],
  ] as const)('class %s, e = %s g, load %s g → mpe %s g', (accuracyClass, e, load, expected) => {
    const instrument = makeInstrument({ accuracyClass, max: '999999999', e, min: '1' });
    expect(mpe(instrument, load, rulepack).value).toBe(expected);
  });

  describe('multi-interval instruments select the partial range containing the load', () => {
    it('uses e = 2 g inside the first interval (≤ 6 kg)', () => {
      const result = mpe(multiIntervalClassIII, '6000', rulepack);
      expect(result.eUsed).toBe('2');
      // m = 3000 → band 1.5e for class III (>2000)
      expect(result.value).toBe('3');
    });

    it('uses e = 5 g in the second interval (> 6 kg)', () => {
      const result = mpe(multiIntervalClassIII, '6005', rulepack);
      expect(result.eUsed).toBe('5');
      // m = 1201 → band 1.0e
      expect(result.value).toBe('5');
    });
  });

  describe('multi_range instruments', () => {
    const multiRange = {
      ...goldenClassIII,
      kind: 'multi_range' as const,
      ranges: [
        { max: '10000', e: '2', d: '2' },
        { max: '30000', e: '5', d: '5' },
      ],
    };

    it('requires rangeIndex', () => {
      expect(() => mpe(multiRange, '1000', rulepack)).toThrow(/rangeIndex/);
    });

    it('rejects an out-of-bounds rangeIndex', () => {
      expect(() => mpe(multiRange, '1000', rulepack, { rangeIndex: 5 })).toThrow(
        /no range at index/,
      );
    });

    it('uses the named range', () => {
      expect(mpe(multiRange, '1000', rulepack, { rangeIndex: 0 }).eUsed).toBe('2');
      expect(mpe(multiRange, '20000', rulepack, { rangeIndex: 1 }).eUsed).toBe('5');
    });
  });

  it('throws when the instrument declares no weighing ranges at all', () => {
    const instrument = { ...goldenClassIII, ranges: [] };
    expect(() => mpe(instrument, '1000', rulepack)).toThrow(/no weighing ranges/);
  });

  it('falls back to the last band when a (malformed) rule pack defines no unbounded top band', () => {
    const boundedOnly = {
      ...rulepack,
      mpeBands: { ...rulepack.mpeBands, III: [{ upToE: 500, mpeE: '0.5' }] },
    };
    // m = 30000 / 5 = 6000, past the only (bounded) band → falls back to it anyway
    expect(mpe(goldenClassIII, '30000', boundedOnly).value).toBe('2.5');
  });

  it('throws when the rule pack has no MPE bands for the accuracy class', () => {
    const strippedBands = { ...rulepack.mpeBands };
    delete (strippedBands as Partial<typeof strippedBands>).III;
    const brokenRulepack = { ...rulepack, mpeBands: strippedBands };
    expect(() => mpe(goldenClassIII, '1000', brokenRulepack)).toThrow(/no MPE bands/);
  });
});
