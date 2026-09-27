/**
 * Verdict aggregation (implementation.md §4.9).
 *
 * A test's own verdict is decided by the evaluator that produced it
 * (`TestResult.verdict`); this module only rolls a completed set of tests up
 * into the evaluation-level verdict.
 */
import type { TestResult, Verdict } from './types.js';

export type EvaluationVerdict = 'CONFORMS' | 'DOES_NOT_CONFORM' | 'INCOMPLETE';

export interface EvaluationSummaryRow {
  code: string;
  verdict: Verdict;
}

export interface EvaluationResult {
  verdict: EvaluationVerdict;
  /** Powers the report's "Summary of results" table. */
  tests: EvaluationSummaryRow[];
}

/**
 * Roll a plan's completed tests up into one evaluation verdict.
 *
 * `CONFORMS` when every applicable test PASSes; `DOES_NOT_CONFORM` when any
 * FAILs; `INCOMPLETE` otherwise (a blocking issue, a test not yet run, or no
 * applicable tests at all).
 *
 * @param tests completed tests keyed by test code (`NOT_APPLICABLE` entries
 *   are recorded in the summary but excluded from the pass/fail roll-up)
 */
export function aggregateEvaluation(tests: Record<string, TestResult>): EvaluationResult {
  const rows: EvaluationSummaryRow[] = Object.entries(tests).map(([code, result]) => ({
    code,
    verdict: result.verdict,
  }));
  const applicable = rows.filter((row) => row.verdict !== 'NOT_APPLICABLE');

  let verdict: EvaluationVerdict;
  if (applicable.length > 0 && applicable.every((row) => row.verdict === 'PASS')) {
    verdict = 'CONFORMS';
  } else if (applicable.some((row) => row.verdict === 'FAIL')) {
    verdict = 'DOES_NOT_CONFORM';
  } else {
    verdict = 'INCOMPLETE';
  }

  return { verdict, tests: rows };
}
