/**
 * `DISCRIMINATION` — discrimination (R 76-1 clause 3.8; implementation.md
 * §4.6). At Min, ½ Max and Max: adding `1.4 d` must move the indication by
 * exactly one `d`.
 */
import { D } from '../decimal.js';
import type { EvaluatorContext, Issue, RowResult, TestResult } from '../types.js';
import { buildTestResult } from './shared.js';

export interface DiscriminationRowInput {
  rowId: string;
  iBefore: string;
  /** Indication after adding `1.4 d` of extra small weight. */
  iAfter: string;
  rangeIndex?: number;
}

export interface DiscriminationObservation {
  rows: DiscriminationRowInput[];
}

export type DiscriminationParams = Record<string, never>;

export function evaluateDiscrimination(
  obs: DiscriminationObservation,
  ctx: EvaluatorContext<DiscriminationParams>,
): TestResult {
  const rows: RowResult[] = obs.rows.map((input) => {
    const rangeIndex = input.rangeIndex ?? 0;
    const range = ctx.instrument.ranges[rangeIndex];
    if (!range) {
      const issues: Issue[] = [
        {
          code: 'LOAD_OUT_OF_RANGE',
          severity: 'error',
          params: { rangeIndex: String(rangeIndex) },
        },
      ];
      return { rowId: input.rowId, verdict: 'INCOMPLETE', issues };
    }
    const d = D(range.d);
    const change = D(input.iAfter).minus(D(input.iBefore));
    const verdict = change.eq(d) ? 'PASS' : ('FAIL' as const);
    return {
      rowId: input.rowId,
      Ec: change.toFixed(),
      EcInE: change.dividedBy(d).toFixed(),
      mpe: d.toFixed(),
      mpeInE: '1',
      verdict,
      issues: [],
    };
  });

  return buildTestResult(ctx.rulepack, rows, [], []);
}
