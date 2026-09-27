/**
 * `ZERO_ACCURACY` — accuracy of zero-setting (R 76-1 clause 4.5.2;
 * implementation.md §4.6). Pass: `|E0| ≤ 0.25 e`.
 */
import { D } from '../decimal.js';
import type { ErrorMethod } from '../error.js';
import type { EvaluatorContext, Issue, TestResult } from '../types.js';
import { buildTestResult, computeZeroReference, fixedLimitRow } from './shared.js';

export interface ZeroAccuracyObservation {
  L: string;
  I: string;
  deltaL?: string;
  method?: ErrorMethod;
  rangeIndex?: number;
}

export type ZeroAccuracyParams = Record<string, never>;

export function evaluateZeroAccuracy(
  obs: ZeroAccuracyObservation,
  ctx: EvaluatorContext<ZeroAccuracyParams>,
): TestResult {
  const rangeIndex = obs.rangeIndex ?? 0;
  const range = ctx.instrument.ranges[rangeIndex];
  const issues: Issue[] = [];
  if (!range) {
    issues.push({
      code: 'LOAD_OUT_OF_RANGE',
      severity: 'error',
      params: { rangeIndex: String(rangeIndex) },
    });
    return buildTestResult(ctx.rulepack, [], issues, []);
  }

  const {
    E0,
    issues: zeroIssues,
    steps,
  } = computeZeroReference(obs, ctx.instrument, rangeIndex, ctx.rulepack);
  const limit = D(ctx.rulepack.limits.zeroSettingAccuracyE).times(D(range.e));
  const row = fixedLimitRow('zero', D(E0), limit, D(range.e), zeroIssues);

  return buildTestResult(ctx.rulepack, [row], [], steps);
}
