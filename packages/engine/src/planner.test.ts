import { describe, expect, it } from 'vitest';
import { goldenClassIII, makeInstrument } from './__fixtures__/instruments.js';
import { getRulepack } from './__fixtures__/rulepack.js';
import {
  planCreep,
  planDiscrimination,
  planEccentricity,
  planRepeatability,
  planTemperatureSequence,
  planTests,
  planWeighingLoads,
} from './planner.js';

const rulepack = getRulepack();

describe('golden plan — class III, Max 30 kg, e = d = 5 g, 4 supports (§4.7)', () => {
  it('plans WEIGHING loads [100 g, 2.5 kg, 10 kg, 15 kg, 30 kg] with a 50 g zero reference', () => {
    const [plan] = planWeighingLoads(goldenClassIII, rulepack);
    expect(plan?.zeroRef).toBe('50');
    expect(plan?.ascending.map((row) => row.L)).toEqual(['100', '2500', '10000', '15000', '30000']);
    expect(plan?.descending.map((row) => row.L)).toEqual([
      '30000',
      '15000',
      '10000',
      '2500',
      '100',
    ]);
  });

  it('plans ECCENTRICITY at 10 kg across 5 positions', () => {
    const plan = planEccentricity(goldenClassIII);
    expect(plan.load).toBe('10000');
    expect(plan.positions).toEqual(['centre', 'Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('plans REPEATABILITY at 15 kg and 30 kg', () => {
    const plan = planRepeatability(goldenClassIII, rulepack);
    expect(plan.loads).toEqual(['15000', '30000']);
    expect(plan.readingsPerSeries).toBe(10); // Max 30 kg ≤ 1000 kg threshold
  });

  it('plans DISCRIMINATION at 100 g, 15 kg, 30 kg with an extra load of 7 g', () => {
    const plan = planDiscrimination(goldenClassIII, rulepack);
    expect(plan.loads).toEqual(['100', '15000', '30000']);
    expect(plan.extraLoad).toBe('7');
  });

  it('plans CREEP at 30 kg with the rule pack schedule', () => {
    const plan = planCreep(goldenClassIII, rulepack);
    expect(plan.load).toBe('30000');
    expect(plan.scheduleMin).toEqual([0, 5, 15, 30]);
  });
});

describe('planWeighingLoads — fewer than 5 natural candidates', () => {
  it('pads with ¼ Max and ¾ Max when the natural candidates collapse to fewer than 5', () => {
    // Min = ½ Max and no MPE boundary falls in [Min, Max] → only {Min, ½Max, Max} = 2 distinct values.
    const instrument = makeInstrument({ accuracyClass: 'III', max: '1000', e: '5', min: '500' });
    const [plan] = planWeighingLoads(instrument, rulepack);
    expect(plan?.ascending.map((row) => row.L)).toEqual(['250', '500', '750', '1000']);
  });
});

describe('planWeighingLoads — with a weight set', () => {
  it('attaches a decomposition when the set can compose the load', () => {
    const weightSet = [
      { nominal: '20000', weightClass: 'F2' as const },
      { nominal: '10000', weightClass: 'F2' as const },
      { nominal: '5000', weightClass: 'F2' as const, count: 6 },
      { nominal: '100', weightClass: 'F2' as const, count: 20 },
    ];
    const [plan] = planWeighingLoads(goldenClassIII, rulepack, weightSet);
    const maxRow = plan?.ascending.find((row) => row.L === '30000');
    expect(maxRow?.weights).toBeDefined();
    expect(maxRow?.weights?.length).toBeGreaterThan(0);
  });

  it('falls back to the target load when the set cannot compose it exactly', () => {
    const weightSet = [{ nominal: '7', weightClass: 'F2' as const }]; // can't make 100 g from 7 g pieces
    const [plan] = planWeighingLoads(goldenClassIII, rulepack, weightSet);
    const firstRow = plan?.ascending[0];
    expect(firstRow?.L).toBe('100');
    expect(firstRow?.weights).toBeUndefined();
  });
});

describe('planEccentricity — more than 4 supports', () => {
  it('plans one position per support at Max / (n − 1)', () => {
    const instrument = {
      ...goldenClassIII,
      loadReceptor: { kind: 'vehicle' as const, supports: 6 },
    };
    const plan = planEccentricity(instrument);
    expect(plan.load).toBe('6000'); // 30000 / 5
    expect(plan.positions).toHaveLength(6);
  });
});

describe('planTemperatureSequence', () => {
  it('sequences 20 °C, high, low, 5 °C, 20 °C', () => {
    const instrument = { ...goldenClassIII, tempRange: { lowC: -10, highC: 40 } };
    expect(planTemperatureSequence(instrument).sequenceC).toEqual([20, 40, -10, 5, 20]);
  });
});

describe('planTests — applicability resolution', () => {
  it('marks always-applicable tests applicable regardless of instrument', () => {
    const plan = planTests(goldenClassIII, rulepack);
    const weighing = plan.find((t) => t.code === 'WEIGHING');
    expect(weighing?.applicable).toBe(true);
  });

  it('gates TARE_ACCURACY on hasTareDevice', () => {
    const withoutTare = planTests(goldenClassIII, rulepack).find((t) => t.code === 'TARE_ACCURACY');
    expect(withoutTare?.applicable).toBe(false);

    const withTare = planTests({ ...goldenClassIII, hasTareDevice: true }, rulepack).find(
      (t) => t.code === 'TARE_ACCURACY',
    );
    expect(withTare?.applicable).toBe(true);
  });

  it('gates CREEP and ZERO_RETURN to classes II–IIII, excluding class I', () => {
    const classI = makeInstrument({ accuracyClass: 'I', max: '220', e: '0.001', min: '0.1' });
    const plan = planTests(classI, rulepack);
    expect(plan.find((t) => t.code === 'CREEP')?.applicable).toBe(false);
    expect(plan.find((t) => t.code === 'ZERO_RETURN')?.applicable).toBe(false);
  });

  it('gates DURABILITY on classes II–IIII and Max ≤ 100 kg', () => {
    const heavy = { ...goldenClassIII, ranges: [{ max: '200000', e: '5', d: '5' }] };
    expect(planTests(heavy, rulepack).find((t) => t.code === 'DURABILITY')?.applicable).toBe(false);
    expect(
      planTests(goldenClassIII, rulepack).find((t) => t.code === 'DURABILITY')?.applicable,
    ).toBe(true);
  });

  it('gates WEIGHING_SUPPL on the initial zero-setting range exceeding 20 %', () => {
    const plain = planTests(goldenClassIII, rulepack).find((t) => t.code === 'WEIGHING_SUPPL');
    expect(plain?.applicable).toBe(false);

    const wideZero = planTests(
      { ...goldenClassIII, initialZeroSettingRangePct: 25 },
      rulepack,
    ).find((t) => t.code === 'WEIGHING_SUPPL');
    expect(wideZero?.applicable).toBe(true);
  });

  it('lists every catalog test exactly once', () => {
    const plan = planTests(goldenClassIII, rulepack);
    expect(plan).toHaveLength(rulepack.tests.length);
  });
});
