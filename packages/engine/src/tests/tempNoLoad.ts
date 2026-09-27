/**
 * `TEMP_NO_LOAD` — temperature effect on the no-load indication (R 76-1
 * clause 3.9.2.3; implementation.md §4.6). Reuses the TEMP_STATIC readings.
 * Pass, relative to the reference reading: class I `≤ 1 e per 1 °C` of
 * temperature change; classes II–IIII `≤ 1 e per 5 °C`.
 */
import { D } from '../decimal.js';
import type { EvaluatorContext, Issue, RowResult, TestResult } from '../types.js';
import { buildTestResult, fixedLimitRow } from './shared.js';

export interface TempNoLoadReading {
  tempC: number;
  i0: string;
}

export interface TempNoLoadObservation {
  rangeIndex?: number;
  /** Index into `readings` of the baseline (typically 20 °C); defaults to 0. */
  referenceIndex?: number;
  readings: TempNoLoadReading[];
}

export type TempNoLoadParams = Record<string, never>;

export function evaluateTempNoLoad(
  obs: TempNoLoadObservation,
  ctx: EvaluatorContext<TempNoLoadParams>,
): TestResult {
  const rangeIndex = obs.rangeIndex ?? 0;
  const range = ctx.instrument.ranges[rangeIndex];
  if (!range) {
    const issues: Issue[] = [
      { code: 'LOAD_OUT_OF_RANGE', severity: 'error', params: { rangeIndex: String(rangeIndex) } },
    ];
    return buildTestResult(ctx.rulepack, [], issues, []);
  }

  const refIndex = obs.referenceIndex ?? 0;
  const reference = obs.readings[refIndex];
  if (!reference) {
    const issues: Issue[] = [
      { code: 'ENV_MISSING', severity: 'error', params: { field: 'referenceIndex' } },
    ];
    return buildTestResult(ctx.rulepack, [], issues, []);
  }

  const e = D(range.e);
  const limit =
    ctx.instrument.accuracyClass === 'I'
      ? ctx.rulepack.limits.tempNoLoad.I
      : ctx.rulepack.limits.tempNoLoad.default;
  const maxEPerStep = D(limit.maxE);

  const rows: RowResult[] = obs.readings.map((reading, index) => {
    const deltaT = Math.abs(reading.tempC - reference.tempC);
    const deltaI0 = D(reading.i0).minus(D(reference.i0));
    const allowedLimit = maxEPerStep.times(deltaT / limit.perC).times(e);
    return fixedLimitRow(`temp-${index}-${reading.tempC}C`, deltaI0, allowedLimit, e);
  });

  return buildTestResult(ctx.rulepack, rows, [], [], { referenceTempC: String(reference.tempC) });
}
