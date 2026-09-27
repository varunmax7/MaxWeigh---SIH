/**
 * `REPEATABILITY` — repeatability (R 76-1 clause 3.6.1; implementation.md
 * §4.6). Two series (≈ 50 % Max, ≈ Max); pass per series when
 * `max(P) − min(P) ≤ |mpe(L)|`.
 */
import { D } from '../decimal.js';
import { type ErrorMethod, errorOfIndication } from '../error.js';
import { mpe } from '../mpe.js';
import type { EvaluatorContext, Issue, RowResult, TestResult } from '../types.js';
import { buildTestResult } from './shared.js';

export interface RepeatabilityReadingInput {
  rowId: string;
  I: string;
  deltaL?: string;
  method?: ErrorMethod;
}

export interface RepeatabilitySeriesInput {
  L: string;
  rangeIndex?: number;
  readings: RepeatabilityReadingInput[];
}

export interface RepeatabilityObservation {
  series: RepeatabilitySeriesInput[];
}

export type RepeatabilityParams = Record<string, never>;

/**
 * Required reading count per series, from the rule pack's threshold on the
 * *instrument's* Max — not the series' own load (the rule pack names it
 * `maxLoadKgForTenReadings`, and the planner applies the same instrument-Max
 * test in `planRepeatability`; kept consistent here).
 */
function requiredReadingCount(
  instrumentMaxGrams: string,
  ctx: EvaluatorContext<RepeatabilityParams>,
): number {
  const { repeatability } = ctx.rulepack.limits;
  const maxKg = D(instrumentMaxGrams).dividedBy(1000);
  return maxKg.lte(D(repeatability.maxLoadKgForTenReadings))
    ? repeatability.readingsHigh
    : repeatability.readingsLow;
}

export function evaluateRepeatability(
  obs: RepeatabilityObservation,
  ctx: EvaluatorContext<RepeatabilityParams>,
): TestResult {
  const extraIssues: Issue[] = [];
  const rows: RowResult[] = [];

  obs.series.forEach((series, seriesIndex) => {
    const rangeIndex = series.rangeIndex ?? 0;
    const range = ctx.instrument.ranges[rangeIndex];
    const rowId = `series-${seriesIndex}`;
    if (!range) {
      rows.push({
        rowId,
        verdict: 'INCOMPLETE',
        issues: [
          {
            code: 'LOAD_OUT_OF_RANGE',
            severity: 'error',
            params: { rangeIndex: String(rangeIndex) },
          },
        ],
      });
      return;
    }

    const required = requiredReadingCount(range.max, ctx);
    if (series.readings.length < required) {
      extraIssues.push({
        code: 'OBS_MISSING',
        severity: 'warning',
        clause: '3.6.1',
        params: {
          series: String(seriesIndex),
          required: String(required),
          got: String(series.readings.length),
        },
      });
    }

    const computed = series.readings.map((reading) =>
      errorOfIndication(
        {
          L: series.L,
          I: reading.I,
          ...(reading.deltaL !== undefined ? { deltaL: reading.deltaL } : {}),
          ...(reading.method !== undefined ? { method: reading.method } : {}),
        },
        range,
        ctx.rulepack,
      ),
    );
    const rowIssues = computed.flatMap((c) => c.issues);
    const pValues = computed.map((c) => D(c.P));

    if (pValues.length === 0) {
      rows.push({
        rowId,
        verdict: 'INCOMPLETE',
        issues: [
          ...rowIssues,
          { code: 'OBS_MISSING', severity: 'error', params: { series: String(seriesIndex) } },
        ],
      });
      return;
    }

    const maxP = pValues.reduce((a, b) => (b.gt(a) ? b : a));
    const minP = pValues.reduce((a, b) => (b.lt(a) ? b : a));
    const spread = maxP.minus(minP);

    const mpeResult = mpe(ctx.instrument, series.L, ctx.rulepack, { rangeIndex });
    const mpeValue = D(mpeResult.value);
    const blocking = rowIssues.some((issue) => issue.severity === 'error');
    const verdict = blocking ? 'INCOMPLETE' : spread.lte(mpeValue) ? 'PASS' : ('FAIL' as const);

    rows.push({
      rowId,
      Ec: spread.toFixed(),
      EcInE: spread.dividedBy(D(mpeResult.eUsed)).toFixed(),
      mpe: mpeResult.value,
      mpeInE: mpeResult.inE,
      verdict,
      issues: rowIssues,
    });
  });

  return buildTestResult(ctx.rulepack, rows, extraIssues, []);
}
