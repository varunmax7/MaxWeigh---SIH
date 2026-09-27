/**
 * `ZERO_RETURN` — zero return after a 30-minute load (R 76-1 clause 3.9.4.2;
 * implementation.md §4.6). Applies to classes II–IIII. Pass: `|ΔI0| ≤ 0.5 e`.
 */
import { D } from '../decimal.js';
import type { EvaluatorContext, Issue, TestResult } from '../types.js';
import { buildTestResult, fixedLimitRow } from './shared.js';

export interface ZeroReturnObservation {
  rangeIndex?: number;
  /** No-load indication before the 30-minute load is applied. */
  i0Before: string;
  /** No-load indication once the indication is stable after removing the load. */
  i0After: string;
}

export type ZeroReturnParams = Record<string, never>;

export function evaluateZeroReturn(
  obs: ZeroReturnObservation,
  ctx: EvaluatorContext<ZeroReturnParams>,
): TestResult {
  const rangeIndex = obs.rangeIndex ?? 0;
  const range = ctx.instrument.ranges[rangeIndex];
  if (!range) {
    const issues: Issue[] = [
      { code: 'LOAD_OUT_OF_RANGE', severity: 'error', params: { rangeIndex: String(rangeIndex) } },
    ];
    return buildTestResult(ctx.rulepack, [], issues, []);
  }

  const deltaI0 = D(obs.i0After).minus(D(obs.i0Before));
  const limit = D(ctx.rulepack.limits.zeroReturnMaxE).times(D(range.e));
  const row = fixedLimitRow('zero-return', deltaI0, limit, D(range.e));

  return buildTestResult(ctx.rulepack, [row], [], []);
}
