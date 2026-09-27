/**
 * Shared machinery for the load-based evaluators in this directory — not a
 * test code itself. Keeps every "row vs mpe(L)" evaluator (WEIGHING,
 * ECCENTRICITY, WEIGHING_TARE, TILTING, …) from re-deriving the same
 * P/E/Ec/verdict logic (implementation.md §4.5, §4.9).
 */
import { D, type Decimal, toDec } from '../decimal.js';
import { correctedError, type ErrorMethod, errorOfIndication } from '../error.js';
import { type MpeContext, mpe } from '../mpe.js';
import type { Rulepack } from '../rulepack.js';
import type {
  CalcStep,
  Dec,
  InstrumentMetrology,
  Issue,
  RowResult,
  TestResult,
  Verdict,
} from '../types.js';
import { ENGINE_VERSION } from '../version.js';

export interface LoadRow {
  rowId: string;
  L: Dec;
  I: Dec;
  deltaL?: Dec;
  method?: ErrorMethod;
  rangeIndex?: number;
}

export interface RowContext {
  instrument: InstrumentMetrology;
  rulepack: Rulepack;
  /** Zero (or near-zero) error established at the start of the test. */
  e0: Dec;
  mpeContext?: MpeContext;
}

/** Compute P, E, Ec, mpe(L) and the verdict for one load row. */
export function evaluateLoadRow(row: LoadRow, ctx: RowContext): RowResult {
  const rangeIndex = row.rangeIndex ?? 0;
  const range = ctx.instrument.ranges[rangeIndex];
  if (!range) {
    return {
      rowId: row.rowId,
      verdict: 'INCOMPLETE',
      issues: [
        {
          code: 'LOAD_OUT_OF_RANGE',
          severity: 'error',
          params: { rangeIndex: String(rangeIndex) },
        },
      ],
    };
  }

  const obs = {
    L: row.L,
    I: row.I,
    ...(row.deltaL !== undefined ? { deltaL: row.deltaL } : {}),
    ...(row.method !== undefined ? { method: row.method } : {}),
  };
  const { P, E, issues: rowIssues } = errorOfIndication(obs, range, ctx.rulepack);
  const Ec = correctedError(E, ctx.e0);
  const mpeResult = mpe(ctx.instrument, row.L, ctx.rulepack, {
    ...(ctx.mpeContext !== undefined ? { context: ctx.mpeContext } : {}),
    rangeIndex,
  });

  const issues: Issue[] = [...rowIssues];
  const mpeValue = D(mpeResult.value);
  const suspectMultiple = D(ctx.rulepack.limits.suspectReadingMpeMultiple);
  if (!mpeValue.isZero() && Ec.abs().gt(mpeValue.times(suspectMultiple))) {
    issues.push({
      code: 'OBS_SUSPECT_READING',
      severity: 'warning',
      clause: '4.5',
      params: { Ec: toDec(Ec), mpe: mpeResult.value },
    });
  }
  const L = D(row.L);
  if (L.isNegative() || L.gt(D(range.max))) {
    issues.push({
      code: 'LOAD_OUT_OF_RANGE',
      severity: 'error',
      params: { L: row.L, max: range.max },
    });
  }

  const blocking = issues.some((issue) => issue.severity === 'error');
  const withinMpe = Ec.abs().lte(mpeValue);
  const verdict: Verdict = blocking ? 'INCOMPLETE' : withinMpe ? 'PASS' : 'FAIL';

  return {
    rowId: row.rowId,
    P,
    E,
    Ec: toDec(Ec),
    EcInE: toDec(Ec.dividedBy(D(mpeResult.eUsed))),
    mpe: mpeResult.value,
    mpeInE: mpeResult.inE,
    verdict,
    issues,
  };
}

export interface ZeroReferenceObservation {
  L: Dec;
  I: Dec;
  deltaL?: Dec;
  method?: ErrorMethod;
}

/** `E0`: the error of indication at (near-)zero load, computed the same way as any other row. */
export function computeZeroReference(
  obs: ZeroReferenceObservation,
  instrument: InstrumentMetrology,
  rangeIndex: number,
  rulepack: Rulepack,
): { E0: Dec; issues: Issue[]; steps: CalcStep[] } {
  const range = instrument.ranges[rangeIndex];
  if (!range) {
    return {
      E0: '0',
      issues: [
        {
          code: 'LOAD_OUT_OF_RANGE',
          severity: 'error',
          params: { rangeIndex: String(rangeIndex) },
        },
      ],
      steps: [],
    };
  }
  const { E, issues, steps } = errorOfIndication(obs, range, rulepack);
  return { E0: E, issues, steps };
}

/**
 * A row for tests whose criterion is "value ≤ a fixed multiple of e"
 * (ZERO_ACCURACY, TARE_ACCURACY, ZERO_RETURN, …) rather than "≤ mpe(L)".
 * Reuses the `Ec`/`mpe` fields of {@link RowResult} for the value and the
 * limit it is judged against.
 */
export function fixedLimitRow(
  rowId: string,
  value: Decimal,
  limit: Decimal,
  e: Decimal,
  issues: Issue[] = [],
): RowResult {
  const blocking = issues.some((issue) => issue.severity === 'error');
  const withinLimit = value.abs().lte(limit);
  const verdict: Verdict = blocking ? 'INCOMPLETE' : withinLimit ? 'PASS' : 'FAIL';
  return {
    rowId,
    Ec: toDec(value),
    EcInE: toDec(value.dividedBy(e)),
    mpe: toDec(limit),
    mpeInE: toDec(limit.dividedBy(e)),
    verdict,
    issues,
  };
}

/** Roll a set of rows up to one test verdict, per §4.9: any blocking issue → INCOMPLETE, else any FAIL → FAIL. */
export function verdictFromRows(rows: readonly RowResult[]): Verdict {
  if (rows.length === 0) return 'INCOMPLETE';
  if (rows.some((row) => row.verdict === 'INCOMPLETE')) return 'INCOMPLETE';
  if (rows.some((row) => row.verdict === 'FAIL')) return 'FAIL';
  return 'PASS';
}

/** The greatest `|Ec|` among rows that have one, as a `Dec`, or `undefined` if none do. */
export function maxAbsEc(rows: readonly RowResult[]): Decimal | undefined {
  return rows.reduce<Decimal | undefined>((max, row) => {
    if (row.Ec === undefined) return max;
    const abs = D(row.Ec).abs();
    return max === undefined || abs.gt(max) ? abs : max;
  }, undefined);
}

/** Assemble a `TestResult` from evaluated rows, extra (non-row) issues, and calculation steps. */
export function buildTestResult(
  rulepack: Rulepack,
  rows: RowResult[],
  extraIssues: Issue[],
  steps: CalcStep[],
  extraSummary: Record<string, Dec | string> = {},
  /** Bypasses the automatic rows→verdict rollup — for tests with an alternate pass path (e.g. CREEP's 4 h fallback). */
  verdictOverride?: Verdict,
): TestResult {
  const worst = maxAbsEc(rows);
  const summary: Record<string, Dec | string> = { ...extraSummary };
  if (worst !== undefined) summary['maxAbsEc'] = toDec(worst);

  const rowVerdict = verdictOverride ?? verdictFromRows(rows);
  const verdict: Verdict = extraIssues.some((issue) => issue.severity === 'error')
    ? 'INCOMPLETE'
    : rowVerdict;

  return {
    verdict,
    rows,
    summary,
    issues: extraIssues,
    steps,
    engineVersion: ENGINE_VERSION,
    rulepack: { id: rulepack.id, version: rulepack.version },
  };
}

/** A `TestResult` for a test the plan marked not applicable — carries the reason as an info issue. */
export function notApplicable(rulepack: Rulepack, reason: string): TestResult {
  return {
    verdict: 'NOT_APPLICABLE',
    rows: [],
    summary: {},
    issues: [{ code: 'TEST_NOT_APPLICABLE', severity: 'info', params: { reason } }],
    steps: [],
    engineVersion: ENGINE_VERSION,
    rulepack: { id: rulepack.id, version: rulepack.version },
  };
}
