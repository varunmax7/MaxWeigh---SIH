import { describe, expect, it } from 'vitest';
import { goldenClassIII, makeInstrument } from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import { Decimal } from './decimal.js';
import type { WeightTable } from './rulepack.js';
import {
  decomposeLoad,
  standardsAdequacy,
  substitutionCheck,
  type WeightPiece,
} from './standards.js';

const rulepack = getRulepack();

// A slice of the R 111 seed table (implementation.md §4.8) — enough for these fixtures.
const weightTable: WeightTable = {
  id: 'test-fixture',
  title: 'R 111 fixture slice',
  unit: 'mg',
  rows: [
    {
      nominal: '20000',
      mpeMg: { E2: '30', F1: '100', F2: '300', M1: '1000', M2: '3000', M3: '10000' },
    },
    {
      nominal: '10000',
      mpeMg: { E2: '16', F1: '50', F2: '160', M1: '500', M2: '1600', M3: '5000' },
    },
    { nominal: '200', mpeMg: { E2: '0.3', F1: '1', F2: '3', M1: '10', M2: '30', M3: '100' } },
  ],
};

describe('standardsAdequacy — clause 3.7.1 (§4.8)', () => {
  it('is adequate: F2 20 kg + 10 kg (460 mg) for class III 30 kg (limit 2.5 g)', () => {
    const weightSet: WeightPiece[] = [
      { nominal: '20000', weightClass: 'F2' },
      { nominal: '10000', weightClass: 'F2' },
    ];
    const result = standardsAdequacy('30000', weightSet, goldenClassIII, rulepack, weightTable);
    expect(result.decomposition).toEqual([
      { nominal: '20000', weightClass: 'F2' },
      { nominal: '10000', weightClass: 'F2' },
    ]);
    expect(result.sumOfMpe).toBe('0.46'); // 460 mg in grams
    expect(result.limit).toBe('2.5'); // mpe(30000) = 7.5 g / 3
    expect(result.adequate).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('is inadequate: a single M1 200 g weight (10 mg) for class II at 200 g (limit 3.33 mg)', () => {
    const classII = makeInstrument({ accuracyClass: 'II', max: '3000', e: '0.01', min: '1' });
    const weightSet: WeightPiece[] = [{ nominal: '200', weightClass: 'M1' }];

    const result = standardsAdequacy('200', weightSet, classII, rulepack, weightTable);
    expect(result.sumOfMpe).toBe('0.01'); // 10 mg in grams
    // mpe(200g, class II, e=0.01g): m = 20000 → 1.0e = 0.01g; limit = 0.01/3
    expect(new Decimal(result.limit).toDecimalPlaces(5).toFixed()).toBe(
      new Decimal('0.01').dividedBy(3).toDecimalPlaces(5).toFixed(),
    );
    expect(result.adequate).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('STD_INADEQUATE');
  });

  it('flags a decomposed nominal that is not in the weight table', () => {
    const weightSet: WeightPiece[] = [{ nominal: '999', weightClass: 'F2' }];
    const result = standardsAdequacy('999', weightSet, goldenClassIII, rulepack, weightTable);
    expect(result.adequate).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('STD_INADEQUATE');
  });

  it('flags a load that cannot be decomposed from the given weight set', () => {
    const weightSet: WeightPiece[] = [{ nominal: '20000', weightClass: 'F2' }];
    const result = standardsAdequacy('25000', weightSet, goldenClassIII, rulepack, weightTable);
    expect(result.decomposition).toBeNull();
    expect(result.issues.map((i) => i.code)).toContain('STD_INADEQUATE');
  });

  it('flags an expired calibration', () => {
    const weightSet: WeightPiece[] = [
      { nominal: '20000', weightClass: 'F2', calibrationExpiresAt: '2020-01-01' },
      { nominal: '10000', weightClass: 'F2' },
    ];
    const result = standardsAdequacy('30000', weightSet, goldenClassIII, rulepack, weightTable, {
      asOf: new Date('2025-01-01'),
    });
    expect(result.issues.map((i) => i.code)).toContain('STD_EXPIRED');
    expect(result.adequate).toBe(false);
  });
});

describe('decomposeLoad', () => {
  it('greedily uses the largest pieces first', () => {
    const weightSet: WeightPiece[] = [
      { nominal: '10000', weightClass: 'F2', count: 3 },
      { nominal: '5000', weightClass: 'F2', count: 2 },
      { nominal: '1000', weightClass: 'F2' },
    ];
    const result = decomposeLoad(new Decimal(26000), weightSet);
    expect(result?.map((p) => p.nominal)).toEqual(['10000', '10000', '5000', '1000']);
  });

  it('returns null when the set cannot reach the exact load', () => {
    const weightSet: WeightPiece[] = [{ nominal: '10000', weightClass: 'F2' }];
    expect(decomposeLoad(new Decimal(15000), weightSet)).toBeNull();
  });
});

describe('substitutionCheck — clause 3.7.3 (§4.8)', () => {
  it('is adequate at ≥ 50 % share regardless of repeatability', () => {
    expect(substitutionCheck('50', '1', rulepack).adequate).toBe(true);
  });

  it('is adequate at ≥ 35 % share only if repeatability ≤ 0.3 e', () => {
    expect(substitutionCheck('35', '0.3', rulepack).adequate).toBe(true);
    expect(substitutionCheck('35', '0.31', rulepack).adequate).toBe(false);
  });

  it('is adequate at ≥ 20 % share only if repeatability ≤ 0.2 e', () => {
    expect(substitutionCheck('20', '0.2', rulepack).adequate).toBe(true);
    expect(substitutionCheck('20', '0.21', rulepack).adequate).toBe(false);
  });

  it('is inadequate below 20 % regardless of repeatability', () => {
    const result = substitutionCheck('19', '0.1', rulepack);
    expect(result.adequate).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain('SUB_SHARE_LOW');
  });
});
