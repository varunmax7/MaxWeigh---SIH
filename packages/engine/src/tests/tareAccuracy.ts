/**
 * `TARE_ACCURACY` — accuracy of the tare device (R 76-1 clause 4.6;
 * implementation.md §4.6). Applies when the instrument has a tare device.
 * Pass: `E ≤ 0.25 e` after tare balancing.
 */
import { D } from '../decimal.js';
import type { ErrorMethod } from '../error.js';
import type { EvaluatorContext, Issue, TestResult } from '../types.js';
import { buildTestResult, computeZeroReference, fixedLimitRow } from './shared.js';

export interface TareAccuracyObservation {
  /** The reading taken with the tare vessel on the receptor, balanced to zero. */
  L: string;
  I: string;
  deltaL?: string;
  method?: ErrorMethod;
  rangeIndex?: number;
}

export type TareAccuracyParams = Record<string, never>;

export function evaluateTareAccuracy(
  obs: TareAccuracyObservation,
  ctx: EvaluatorContext<TareAccuracyParams>,
): TestResult {
  const rangeIndex = obs.rangeIndex ?? 0;
  const range = ctx.instrument.ranges[rangeIndex];
  if (!range) {
    const issues: Issue[] = [
      { code: 'LOAD_OUT_OF_RANGE', severity: 'error', params: { rangeIndex: String(rangeIndex) } },
    ];
    return buildTestResult(ctx.rulepack, [], issues, []);
  }

  // The tare vessel is the "load", so E after balancing is itself the quantity
  // under test — computed the same way as any zero reference.
  const {
    E0: E,
    issues,
    steps,
  } = computeZeroReference(obs, ctx.instrument, rangeIndex, ctx.rulepack);
  const limit = D(ctx.rulepack.limits.tareAccuracyE).times(D(range.e));
  const row = fixedLimitRow('tare', D(E), limit, D(range.e), issues);

  return buildTestResult(ctx.rulepack, [row], [], steps);
}
