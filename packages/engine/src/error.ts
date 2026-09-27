/**
 * Error of indication — R 76-1 clause 4.5 worked method (implementation.md §4.5).
 *
 * `errorOfIndication` computes `P` and `E` and validates the row's own inputs
 * (`I` a multiple of `d`, `ΔL` in range). It does *not* know `E0` or `mpe(L)`
 * — those are supplied by the caller (an evaluator) so this stays a pure,
 * single-row calculation reusable by every load-based test.
 */
import { D, type Decimal, isMultipleOf, toDec } from './decimal.js';
import { step } from './explain.js';
import type { Rulepack } from './rulepack.js';
import type { CalcStep, Dec, Issue, WeighingRange } from './types.js';

export type ErrorMethod = 'change_point' | 'direct';

export interface WeighingObservation {
  /** Applied test load. */
  L: Dec;
  /** Indication shown by the instrument. */
  I: Dec;
  /** Change-point method only: additional small weights added until I increases by one e. */
  deltaL?: Dec;
  method?: ErrorMethod;
}

export interface ErrorResult {
  /** Indication prior to rounding. */
  P: Dec;
  /** P − L. */
  E: Dec;
  issues: Issue[];
  steps: CalcStep[];
}

function rowIssue(
  code: string,
  severity: Issue['severity'],
  clause: string,
  params: Record<string, string>,
): Issue {
  return { code, severity, clause, params };
}

/**
 * `P` and `E` for one observation, via the change-point method (`d = e`) or
 * the direct method (a high-resolution indication with `d ≤ 0.2 e`).
 */
export function errorOfIndication(
  obs: WeighingObservation,
  range: WeighingRange,
  rulepack: Rulepack,
): ErrorResult {
  const method = obs.method ?? 'change_point';
  const d = D(range.d);
  const e = D(range.e);
  const I = D(obs.I);
  const L = D(obs.L);
  const issues: Issue[] = [];
  const steps: CalcStep[] = [];

  if (!isMultipleOf(I, d)) {
    issues.push(rowIssue('OBS_NOT_MULTIPLE_OF_D', 'error', '4.5', { I: obs.I, d: range.d }));
  }

  let P: Decimal;
  if (method === 'change_point') {
    if (obs.deltaL === undefined) {
      issues.push(rowIssue('OBS_MISSING', 'error', '4.5', { field: 'deltaL' }));
    }
    const deltaL = D(obs.deltaL ?? 0);
    if (obs.deltaL !== undefined) {
      if (!(deltaL.gt(0) && deltaL.lte(e))) {
        issues.push(
          rowIssue('OBS_DELTA_L_RANGE', 'error', '4.5', { deltaL: obs.deltaL, e: range.e }),
        );
      }
      const s = D(rulepack.limits.deltaLStepFractionOfE).times(e);
      if (!isMultipleOf(deltaL, s)) {
        issues.push(
          rowIssue('OBS_DELTA_L_STEP', 'warning', '4.5', { deltaL: obs.deltaL, step: s.toFixed() }),
        );
      }
    }
    P = I.plus(e.dividedBy(2)).minus(deltaL);
    steps.push(
      step(
        'Indication prior to rounding',
        'P = I + ½e − ΔL',
        `P = ${I.toFixed()} + ${e.dividedBy(2).toFixed()} − ${deltaL.toFixed()} = ${P.toFixed()}`,
        P.toFixed(),
        '4.5',
      ),
    );
  } else {
    P = I;
    steps.push(
      step('Indication (direct method)', 'P = I', `P = ${I.toFixed()}`, P.toFixed(), '4.5'),
    );
  }

  const E = P.minus(L);
  steps.push(
    step(
      'Error',
      'E = P − L',
      `E = ${P.toFixed()} − ${L.toFixed()} = ${E.toFixed()}`,
      E.toFixed(),
      '4.5',
    ),
  );

  return { P: toDec(P), E: toDec(E), issues, steps };
}

/** Corrected error `Ec = E − E0` (implementation.md §4.5). */
export function correctedError(E: Dec | Decimal, E0: Dec | Decimal): Decimal {
  return D(E).minus(D(E0));
}
