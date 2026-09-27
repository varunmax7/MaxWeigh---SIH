/**
 * `WEIGHING` — weighing test, ascending and descending (R 76-1 clauses 3.5.1,
 * 3.5.3; implementation.md §4.6). Pass: every `|Ec| ≤ mpe(L)`.
 */
import type { ErrorMethod } from '../error.js';
import type { MpeContext } from '../mpe.js';
import type { EvaluatorContext, Issue, TestResult } from '../types.js';
import { buildTestResult, computeZeroReference, evaluateLoadRow, type LoadRow } from './shared.js';

export interface WeighingRowInput {
  rowId: string;
  L: string;
  I: string;
  deltaL?: string;
  method?: ErrorMethod;
  rangeIndex?: number;
}

export interface WeighingObservation {
  zeroRef: { L: string; I: string; deltaL?: string; method?: ErrorMethod; rangeIndex?: number };
  ascending: WeighingRowInput[];
  descending: WeighingRowInput[];
  mpeContext?: MpeContext;
}

export interface WeighingParams {
  minLoads: number;
  stepFractionOfE: string;
}

function toLoadRow(row: WeighingRowInput, direction: 'asc' | 'desc'): LoadRow {
  return {
    rowId: `${direction}-${row.rowId}`,
    L: row.L,
    I: row.I,
    ...(row.deltaL !== undefined ? { deltaL: row.deltaL } : {}),
    ...(row.method !== undefined ? { method: row.method } : {}),
    ...(row.rangeIndex !== undefined ? { rangeIndex: row.rangeIndex } : {}),
  };
}

export function evaluateWeighing(
  obs: WeighingObservation,
  ctx: EvaluatorContext<WeighingParams>,
): TestResult {
  const zeroRangeIndex = obs.zeroRef.rangeIndex ?? 0;
  const {
    E0,
    issues: zeroIssues,
    steps: zeroSteps,
  } = computeZeroReference(obs.zeroRef, ctx.instrument, zeroRangeIndex, ctx.rulepack);

  const extraIssues: Issue[] = [...zeroIssues];
  if (obs.ascending.length < ctx.params.minLoads) {
    extraIssues.push({
      code: 'OBS_MISSING',
      severity: 'warning',
      clause: '3.5.1',
      params: {
        field: 'ascending',
        minLoads: String(ctx.params.minLoads),
        got: String(obs.ascending.length),
      },
    });
  }

  const rowCtx = {
    instrument: ctx.instrument,
    rulepack: ctx.rulepack,
    e0: E0,
    ...(obs.mpeContext !== undefined ? { mpeContext: obs.mpeContext } : {}),
  };
  const rows = [
    ...obs.ascending.map((row) => evaluateLoadRow(toLoadRow(row, 'asc'), rowCtx)),
    ...obs.descending.map((row) => evaluateLoadRow(toLoadRow(row, 'desc'), rowCtx)),
  ];

  return buildTestResult(ctx.rulepack, rows, extraIssues, zeroSteps, { e0: E0 });
}
