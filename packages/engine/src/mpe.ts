/**
 * Maximum permissible errors — R 76-1 Table 6 (implementation.md §4.4).
 *
 * `mpe()` is purely a lookup: it does not know whether `load` sits inside the
 * instrument's declared range. A load beyond `Max` is the caller's concern
 * (evaluators raise `LOAD_OUT_OF_RANGE` on the row that used it) — see
 * docs/QUESTIONS.md for why that check does not live here.
 */
import { D, Decimal, toDec } from './decimal.js';
import { step } from './explain.js';
import type { Rulepack } from './rulepack.js';
import { mpeBandsFor } from './rulepack.js';
import type { CalcStep, Dec, InstrumentMetrology } from './types.js';

export type MpeContext = 'initial' | 'in_service';

export interface MpeOptions {
  /** Default `'initial'`; `'in_service'` multiplies the result by `rulepack.inServiceFactor`. */
  context?: MpeContext;
  /** Required when `instrument.kind === 'multi_range'`. */
  rangeIndex?: number;
}

export interface MpeResult {
  value: Dec;
  inE: Dec;
  band: '0.5' | '1.0' | '1.5';
  eUsed: Dec;
  steps: CalcStep[];
}

/** Which range (and its `e`) governs `load`, given the instrument's range kind. */
function selectRange(
  instrument: InstrumentMetrology,
  load: Decimal,
  rangeIndex: number | undefined,
): { e: Decimal; index: number } {
  const { ranges } = instrument;
  const first = ranges[0];
  if (!first) throw new RangeError('mpe: instrument declares no weighing ranges');

  if (instrument.kind === 'multi_range') {
    if (rangeIndex === undefined) {
      throw new RangeError('mpe: multi_range instruments require opts.rangeIndex');
    }
    const range = ranges[rangeIndex];
    if (!range) throw new RangeError(`mpe: no range at index ${rangeIndex}`);
    return { e: D(range.e), index: rangeIndex };
  }

  if (instrument.kind === 'multi_interval') {
    // Ranges are ascending, so the first Max_i the load doesn't exceed is its
    // partial interval; falling through to the last range extrapolates.
    for (const [i, range] of ranges.entries()) {
      if (load.lte(D(range.max)) || i === ranges.length - 1) {
        return { e: D(range.e), index: i };
      }
    }
  }

  return { e: D(first.e), index: 0 };
}

/**
 * Maximum permissible error at `load` (R 76-1 Table 6, initial verification;
 * doubled for `context: 'in_service'` per clause 3.5.2).
 */
export function mpe(
  instrument: InstrumentMetrology,
  load: Dec,
  rulepack: Rulepack,
  opts: MpeOptions = {},
): MpeResult {
  const context = opts.context ?? 'initial';
  const L = D(load);
  const { e: eUsed, index } = selectRange(instrument, L, opts.rangeIndex);
  const m = L.dividedBy(eUsed);

  const bands = mpeBandsFor(rulepack, instrument.accuracyClass);
  if (!bands || bands.length === 0) {
    throw new RangeError(`mpe: rule pack has no MPE bands for class ${instrument.accuracyClass}`);
  }
  const found = bands.find((band) => band.upToE === null || m.lte(band.upToE));
  // The last band always has upToE: null, so `found` only misses when `bands`
  // itself is empty — already excluded above.
  // biome-ignore lint/style/noNonNullAssertion: bands.length > 0 is checked above.
  const matched = found ?? bands[bands.length - 1]!;

  const factor = context === 'in_service' ? rulepack.inServiceFactor : 1;
  const inE = D(matched.mpeE).times(factor);
  const value = inE.times(eUsed);

  const steps: CalcStep[] = [
    step(
      'Load in multiples of e',
      'm = L / e',
      `m = ${L.toFixed()} / ${eUsed.toFixed()} = ${m.toFixed()}`,
      `${m.toFixed()} e (range ${index})`,
    ),
    step(
      'Select MPE band',
      'Table 6',
      `class ${instrument.accuracyClass}, m = ${m.toFixed()}`,
      `±${matched.mpeE} e`,
      'Table 6',
    ),
    ...(context === 'in_service'
      ? [
          step(
            'In-service factor',
            `MPE_service = MPE_initial × ${rulepack.inServiceFactor}`,
            `${matched.mpeE} × ${rulepack.inServiceFactor} = ${inE.toFixed()}`,
            `±${inE.toFixed()} e`,
            '3.5.2',
          ),
        ]
      : []),
    step(
      'MPE in mass units',
      'MPE = inE × e',
      `${inE.toFixed()} × ${eUsed.toFixed()} = ${value.toFixed()}`,
      toDec(value),
    ),
  ];

  return {
    value: toDec(value),
    inE: toDec(inE),
    band: matched.mpeE as '0.5' | '1.0' | '1.5',
    eUsed: toDec(eUsed),
    steps,
  };
}

/**
 * MPE band boundaries in grams for `instrument` — the load planner and the
 * envelope chart use these directly (e.g. class III, e = 5 g → `[2500, 10000]`).
 */
export function mpeBandBoundaries(instrument: InstrumentMetrology, rulepack: Rulepack): Dec[] {
  const bands = mpeBandsFor(rulepack, instrument.accuracyClass);
  if (!bands) return [];
  const boundariesInE = bands
    .map((band) => band.upToE)
    .filter((upToE): upToE is number => upToE !== null);

  const results: Dec[] = [];
  let prevMax = new Decimal(0);
  for (const range of instrument.ranges) {
    const max = D(range.max);
    const e = D(range.e);
    for (const boundary of boundariesInE) {
      const grams = D(boundary).times(e);
      if (grams.gt(prevMax) && grams.lte(max)) results.push(toDec(grams));
    }
    prevMax = max;
  }
  return results;
}
