/**
 * Classification checks — R 76-1 Table 3 and clause 3.4 (implementation.md §4.3).
 *
 * `validateInstrument` never touches the network or a database; it is pure
 * data in, `Issue[]` out. Constants (band tables, the aux-indication rule)
 * live in the rule pack, never here.
 */

import { D, type Decimal } from './decimal.js';
import type { Rulepack } from './rulepack.js';
import { classificationBandsFor } from './rulepack.js';
import type { InstrumentMetrology, Issue, WeighingRange } from './types.js';

function issue(
  code: string,
  severity: Issue['severity'],
  clause: string,
  params: Record<string, string>,
  path?: string,
): Issue {
  return path !== undefined
    ? { code, severity, clause, params, path }
    : { code, severity, clause, params };
}

/** Reduce `value` to its significand in `[1, 10)` — exact for decimal powers of ten. */
function significand(value: Decimal): Decimal {
  let v = value.abs();
  if (v.isZero()) return v;
  while (v.gte(10)) v = v.dividedBy(10);
  while (v.lt(1)) v = v.times(10);
  return v;
}

/** True when `value` is `multiplier × 10^k` for one of `multipliers` (any integer k). */
function hasScaleForm(value: Decimal, multipliers: readonly number[]): boolean {
  const sig = significand(value);
  return multipliers.some((m) => sig.eq(m));
}

/** True when `value` is an exact power of ten (10^k, any integer k, including negative). */
function isPowerOfTen(value: Decimal): boolean {
  return significand(value).eq(1);
}

function findBand(bands: ReturnType<typeof classificationBandsFor>, e: Decimal) {
  return bands?.find((band) => {
    const withinMin = e.gte(D(band.eMin));
    const withinMax = band.eMax === undefined || e.lte(D(band.eMax));
    return withinMin && withinMax;
  });
}

function checkScaleForm(
  range: WeighingRange,
  index: number,
  rulepack: Rulepack,
  issues: Issue[],
): void {
  const multipliers = rulepack.limits.eFormMultipliers;
  if (!hasScaleForm(D(range.e), multipliers)) {
    issues.push(
      issue(
        'CLS_E_FORM',
        'error',
        '3.4',
        { range: String(index), e: range.e },
        `ranges[${index}].e`,
      ),
    );
  }
  if (!hasScaleForm(D(range.d), multipliers)) {
    issues.push(
      issue(
        'CLS_E_FORM',
        'error',
        '3.4',
        { range: String(index), d: range.d },
        `ranges[${index}].d`,
      ),
    );
  }
}

function checkAuxiliaryIndication(
  range: WeighingRange,
  index: number,
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
  issues: Issue[],
): void {
  const e = D(range.e);
  const d = D(range.d);
  const path = `ranges[${index}]`;

  if (d.gt(e)) {
    issues.push(
      issue(
        'CLS_D_EXCEEDS_E',
        'error',
        '3.4',
        { range: String(index), d: range.d, e: range.e },
        path,
      ),
    );
    return;
  }
  if (d.eq(e)) return; // no auxiliary indication — nothing further to check

  const aux = rulepack.limits.auxiliaryIndication;
  if (!aux.allowedClasses.includes(instrument.accuracyClass)) {
    issues.push(
      issue('CLS_AUX_NOT_ALLOWED', 'error', '3.4', { class: instrument.accuracyClass }, path),
    );
  }
  if (aux.eMustBePowerOfTenInKg && !isPowerOfTen(e.dividedBy(1000))) {
    issues.push(issue('CLS_AUX_E_FORM', 'error', '3.4', { e: range.e }, path));
  }
  if (e.dividedBy(d).gt(aux.maxDToERatio)) {
    issues.push(
      issue(
        'CLS_AUX_RATIO',
        'error',
        '3.4',
        { e: range.e, d: range.d, maxRatio: String(aux.maxDToERatio) },
        path,
      ),
    );
  }
}

function checkBandAndN(
  range: WeighingRange,
  index: number,
  instrument: InstrumentMetrology,
  rulepack: Rulepack,
  issues: Issue[],
): void {
  const bands = classificationBandsFor(rulepack, instrument.accuracyClass);
  const band = findBand(bands, D(range.e));
  const path = `ranges[${index}]`;

  if (!band) {
    issues.push(
      issue(
        'CLS_E_RANGE',
        'error',
        'Table 3',
        { class: instrument.accuracyClass, e: range.e },
        path,
      ),
    );
    return;
  }

  const n = D(range.max).dividedBy(D(range.e));
  if (n.lt(band.nMin)) {
    issues.push(
      issue('CLS_N_LOW', 'error', 'Table 3', { n: n.toFixed(), nMin: String(band.nMin) }, path),
    );
  }
  if (band.nMax !== undefined && n.gt(band.nMax)) {
    issues.push(
      issue('CLS_N_HIGH', 'error', 'Table 3', { n: n.toFixed(), nMax: String(band.nMax) }, path),
    );
  }
}

function checkMin(instrument: InstrumentMetrology, rulepack: Rulepack, issues: Issue[]): void {
  const firstRange = instrument.ranges[0];
  if (!firstRange) return;
  const bands = classificationBandsFor(rulepack, instrument.accuracyClass);
  // Table 3's Min is evaluated against e of the first range (§4.3 rule 4), even
  // when that range carries an auxiliary (d < e) indication — see docs/QUESTIONS.md.
  const band = findBand(bands, D(firstRange.e));
  if (!band) return; // already reported as CLS_E_RANGE

  const lowerLimit = D(band.minE).times(D(firstRange.e));
  if (D(instrument.min).lt(lowerLimit)) {
    issues.push(
      issue('CLS_MIN_LOW', 'error', 'Table 3', {
        min: instrument.min,
        lowerLimit: lowerLimit.toFixed(),
      }),
    );
  }
}

function checkRangeOrdering(instrument: InstrumentMetrology, issues: Issue[]): void {
  let previous: WeighingRange | undefined;
  instrument.ranges.forEach((range, index) => {
    if (previous) {
      if (!D(range.e).gt(D(previous.e))) {
        issues.push(
          issue(
            'CLS_RANGE_E_NOT_INCREASING',
            'error',
            '2.1',
            { range: String(index) },
            `ranges[${index}].e`,
          ),
        );
      }
      if (!D(range.max).gt(D(previous.max))) {
        issues.push(
          issue(
            'CLS_RANGE_MAX_NOT_ASCENDING',
            'error',
            '2.1',
            { range: String(index) },
            `ranges[${index}].max`,
          ),
        );
      }
    }
    previous = range;
  });
}

/**
 * Validate an instrument's declared metrology against R 76-1 Table 3 and the
 * auxiliary-indication rule (clause 3.4). Feeds the intake wizard's live
 * validation, the instrument spec editor, and the report's "Instrument
 * characteristics" section.
 */
export function validateInstrument(instrument: InstrumentMetrology, rulepack: Rulepack): Issue[] {
  const issues: Issue[] = [];

  instrument.ranges.forEach((range, index) => {
    checkScaleForm(range, index, rulepack, issues);
    checkAuxiliaryIndication(range, index, instrument, rulepack, issues);
    checkBandAndN(range, index, instrument, rulepack, issues);
  });

  checkMin(instrument, rulepack, issues);
  checkRangeOrdering(instrument, issues);

  if (
    instrument.initialZeroSettingRangePct !== undefined &&
    instrument.initialZeroSettingRangePct > Number(rulepack.limits.initialZeroSettingMaxPct)
  ) {
    issues.push(
      issue('CLS_ZERO_RANGE_SUPPL', 'info', 'Annex A', {
        pct: String(instrument.initialZeroSettingRangePct),
      }),
    );
  }

  return issues;
}
