/**
 * `ECCENTRICITY` — eccentric loading (R 76-1 clause 3.6.2; implementation.md
 * §4.6). Pass: every `|Ec| ≤ mpe(L)` across the loaded positions.
 */
import type { ErrorMethod } from '../error.js';
import type { EvaluatorContext, TestResult } from '../types.js';
import { buildTestResult, computeZeroReference, evaluateLoadRow } from './shared.js';

export interface EccentricityPositionInput {
  /** e.g. "centre", "Q1"..."Q4", or a support index for > 4 supports. */
  position: string;
  L: string;
  I: string;
  deltaL?: string;
  method?: ErrorMethod;
  rangeIndex?: number;
}

export interface EccentricityObservation {
  zeroRef: { L: string; I: string; deltaL?: string; method?: ErrorMethod; rangeIndex?: number };
  positions: EccentricityPositionInput[];
}

export type EccentricityParams = Record<string, never>;

export function evaluateEccentricity(
  obs: EccentricityObservation,
  ctx: EvaluatorContext<EccentricityParams>,
): TestResult {
  const zeroRangeIndex = obs.zeroRef.rangeIndex ?? 0;
  const {
    E0,
    issues: zeroIssues,
    steps,
  } = computeZeroReference(obs.zeroRef, ctx.instrument, zeroRangeIndex, ctx.rulepack);

  const rowCtx = { instrument: ctx.instrument, rulepack: ctx.rulepack, e0: E0 };
  const rows = obs.positions.map((position) =>
    evaluateLoadRow(
      {
        rowId: position.position,
        L: position.L,
        I: position.I,
        ...(position.deltaL !== undefined ? { deltaL: position.deltaL } : {}),
        ...(position.method !== undefined ? { method: position.method } : {}),
        ...(position.rangeIndex !== undefined ? { rangeIndex: position.rangeIndex } : {}),
      },
      rowCtx,
    ),
  );

  return buildTestResult(ctx.rulepack, rows, zeroIssues, steps, { e0: E0 });
}
