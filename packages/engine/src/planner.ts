/**
 * Test plan and load planner (implementation.md §4.7).
 *
 * Everything here produces *suggestions* for the tester to review, not
 * pass/fail verdicts — ordinary decimal arithmetic (not exact-fraction
 * comparisons) is fine throughout this module.
 */
import { D, Decimal, roundToStep, toDec } from './decimal.js';
import { mpeBandBoundaries } from './mpe.js';
import type { Rulepack, RulepackApplicability } from './rulepack.js';
import type { WeightPiece } from './standards.js';
import { decomposeLoad } from './standards.js';
import type { Dec, InstrumentMetrology } from './types.js';

export interface PlannedTest {
  code: string;
  title: string;
  clause: string;
  applicable: boolean;
  reason: string;
  sequence: number;
  mvp: boolean;
}

function applicabilityHolds(
  applicability: RulepackApplicability,
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
): { applicable: boolean; reason: string } {
  if (applicability.classes && !applicability.classes.includes(instrument.accuracyClass)) {
    return {
      applicable: false,
      reason: `Applies only to classes ${applicability.classes.join(', ')}`,
    };
  }

  if (applicability.always) return { applicable: true, reason: 'Always applicable' };

  for (const requirement of applicability.requires ?? []) {
    const { ok, reason } = checkRequirement(requirement, instrument, rulepack);
    if (!ok) return { applicable: false, reason };
  }
  return { applicable: true, reason: describeRequirements(applicability.requires ?? []) };
}

function checkRequirement(
  requirement: NonNullable<RulepackApplicability['requires']>[number],
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
): { ok: boolean; reason: string } {
  switch (requirement) {
    case 'hasZeroTracking':
      return { ok: instrument.hasZeroTracking, reason: 'Instrument has no zero-tracking device' };
    case 'hasTareDevice':
      return { ok: instrument.hasTareDevice, reason: 'Instrument has no tare device' };
    case 'isElectronic':
      return { ok: instrument.isElectronic, reason: 'Instrument is not electronic' };
    case 'tiltSusceptible':
      return {
        ok: instrument.tiltSusceptible,
        reason: 'Fixed installation — not tilt-susceptible',
      };
    case 'modular':
      return {
        ok: false,
        reason: 'Modular-instrument compatibility checks are not yet implemented',
      };
    case 'initialZeroSettingExceeds20Pct': {
      const pct = instrument.initialZeroSettingRangePct ?? 0;
      const max = Number(rulepack.limits.initialZeroSettingMaxPct);
      return {
        ok: pct > max,
        reason: `Initial zero-setting range (${pct}%) does not exceed ${max}% of Max`,
      };
    }
    case 'maxAtMost100kg': {
      const firstRange = instrument.ranges[0];
      const maxKg = firstRange ? D(firstRange.max).dividedBy(1000) : new Decimal(0);
      const limitKg = D(rulepack.limits.durability.maxLoadKg);
      return {
        ok: maxKg.lte(limitKg),
        reason: `Max (${maxKg.toFixed()} kg) exceeds ${limitKg.toFixed()} kg`,
      };
    }
    default:
      return {
        ok: false,
        reason: `Unknown applicability requirement: ${requirement satisfies never}`,
      };
  }
}

function describeRequirements(requirements: readonly string[]): string {
  return requirements.length === 0 ? 'Always applicable' : `Requires: ${requirements.join(', ')}`;
}

/** Every catalog test with its applicability to `instrument` resolved. */
export function planTests(instrument: InstrumentMetrology, rulepack: Rulepack): PlannedTest[] {
  return rulepack.tests.map((test, index) => {
    const { applicable, reason } = applicabilityHolds(test.applicability, instrument, rulepack);
    return {
      code: test.code,
      title: test.title,
      clause: test.clause,
      applicable,
      reason,
      sequence: index + 1,
      mvp: test.mvp,
    };
  });
}

function dedupeAscending(values: Decimal[]): Decimal[] {
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const result: Decimal[] = [];
  for (const value of sorted) {
    const last = result[result.length - 1];
    if (!last?.eq(value)) result.push(value);
  }
  return result;
}

/** The instrument's declared `Min` as a `Decimal`. */
function minForRange(instrument: InstrumentMetrology): Decimal {
  return D(instrument.min);
}

export interface PlannedWeighingRow {
  L: Dec;
  weights?: { nominal: Dec; weightClass: WeightPiece['weightClass'] }[];
}

export interface PlannedWeighingRange {
  rangeIndex: number;
  zeroRef: Dec;
  ascending: PlannedWeighingRow[];
  descending: PlannedWeighingRow[];
}

/**
 * Suggested loads for the WEIGHING test, per range (implementation.md §4.7).
 *
 * 1. Zero reference at 10 e.
 * 2. Candidates: Min, every MPE band boundary inside `[Min, Max]`, ≈ ½ Max, Max.
 * 3. Fewer than 5 distinct loads → add ¼ Max and ¾ Max.
 * 4. Round to a multiple of e (and, if `weightSet` is given, to a value the
 *    set can compose without leaving the MPE band it targeted).
 * 5. Descending mirrors ascending in reverse.
 */
export function planWeighingLoads(
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
  weightSet?: readonly WeightPiece[],
): PlannedWeighingRange[] {
  const boundaries = mpeBandBoundaries(instrument, rulepack).map(D);
  const min = minForRange(instrument);

  return instrument.ranges.map((range, rangeIndex) => {
    const max = D(range.max);
    const e = D(range.e);
    const halfMax = max.dividedBy(2);

    const boundariesInRange = boundaries.filter((b) => b.gte(min) && b.lte(max));
    let candidates = dedupeAscending([min, ...boundariesInRange, halfMax, max]);

    if (candidates.length < 5) {
      candidates = dedupeAscending([...candidates, max.dividedBy(4), max.times(3).dividedBy(4)]);
    }

    const rounded = candidates.map((c) => roundToStep(c, e));
    const ascending: PlannedWeighingRow[] = rounded.map((load) => planRow(load, weightSet));

    return {
      rangeIndex,
      zeroRef: toDec(e.times(10)),
      ascending,
      descending: [...ascending].reverse(),
    };
  });
}

function planRow(load: Decimal, weightSet: readonly WeightPiece[] | undefined): PlannedWeighingRow {
  if (!weightSet || weightSet.length === 0) return { L: toDec(load) };

  const decomposition = decomposeLoad(load, weightSet);
  if (!decomposition) return { L: toDec(load) }; // fall back to the target itself; see docs/QUESTIONS.md

  return {
    L: toDec(load),
    weights: decomposition.map((piece) => ({
      nominal: piece.nominal,
      weightClass: piece.weightClass,
    })),
  };
}

export interface EccentricityPlan {
  load: Dec;
  positions: string[];
}

/**
 * ≤ 4 supports: load ≈ ⅓ (Max + T+) at the centre and 4 quarter positions.
 * > 4 supports: load ≈ (Max + T+) / (n − 1) at each support.
 */
export function planEccentricity(instrument: InstrumentMetrology): EccentricityPlan {
  const firstRange = instrument.ranges[instrument.ranges.length - 1];
  const max = firstRange ? D(firstRange.max) : new Decimal(0);
  const tarePlus = instrument.maxAdditiveTare ? D(instrument.maxAdditiveTare) : new Decimal(0);
  const supports = instrument.loadReceptor.supports;

  if (supports <= 4) {
    return {
      load: toDec(max.plus(tarePlus).dividedBy(3)),
      positions: ['centre', 'Q1', 'Q2', 'Q3', 'Q4'],
    };
  }
  return {
    load: toDec(max.plus(tarePlus).dividedBy(supports - 1)),
    positions: Array.from({ length: supports }, (_, i) => `support-${i + 1}`),
  };
}

export interface RepeatabilityPlan {
  loads: Dec[];
  readingsPerSeries: number;
}

/** Loads ≈ 50 % Max and ≈ Max; reading count from the rule pack's threshold. */
export function planRepeatability(
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
): RepeatabilityPlan {
  const lastRange = instrument.ranges[instrument.ranges.length - 1];
  const max = lastRange ? D(lastRange.max) : new Decimal(0);
  const maxKg = max.dividedBy(1000);
  const { repeatability } = rulepack.limits;
  const readingsPerSeries = maxKg.lte(D(repeatability.maxLoadKgForTenReadings))
    ? repeatability.readingsHigh
    : repeatability.readingsLow;

  return { loads: [toDec(max.dividedBy(2)), toDec(max)], readingsPerSeries };
}

export interface DiscriminationPlan {
  loads: Dec[];
  extraLoad: Dec;
}

/** Min, ½ Max, Max; extra load `1.4 d` (of the range that load falls in). */
export function planDiscrimination(
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
): DiscriminationPlan {
  const min = minForRange(instrument);
  const lastRange = instrument.ranges[instrument.ranges.length - 1];
  const max = lastRange ? D(lastRange.max) : new Decimal(0);
  const d = lastRange ? D(lastRange.d) : new Decimal(0);

  return {
    loads: [toDec(min), toDec(max.dividedBy(2)), toDec(max)],
    extraLoad: toDec(D(rulepack.limits.discriminationExtraD).times(d)),
  };
}

export interface CreepPlan {
  load: Dec;
  scheduleMin: number[];
}

/** Load ≈ Max (90–100 %); schedule from the rule pack (default 0/5/15/30 min). */
export function planCreep(instrument: InstrumentMetrology, rulepack: Rulepack): CreepPlan {
  const lastRange = instrument.ranges[instrument.ranges.length - 1];
  const max = lastRange ? D(lastRange.max) : new Decimal(0);
  return { load: toDec(max), scheduleMin: [...rulepack.limits.creepTimesMin] };
}

export interface TemperatureSequencePlan {
  sequenceC: number[];
}

/** 20 °C → high limit → low limit → 5 °C → 20 °C (limits from `tempRange`). */
export function planTemperatureSequence(instrument: InstrumentMetrology): TemperatureSequencePlan {
  const { lowC, highC } = instrument.tempRange;
  return { sequenceC: [20, highC, lowC, 5, 20] };
}
