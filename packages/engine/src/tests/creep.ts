/**
 * `CREEP` — variation of indication with time (R 76-1 clause 3.9.4.1;
 * implementation.md §4.6). Applies to classes II–IIII, load near Max.
 *
 * Pass: `|I(t≤30) − I0| ≤ 0.5 e` at every reading up to 30 min AND
 * `|I30 − I15| ≤ 0.2 e`. Failing that, a 4-hour reading still passes the test
 * if `|I240 − I0| ≤ |mpe(L)|`.
 */
import { D } from '../decimal.js';
import { mpe } from '../mpe.js';
import type { EvaluatorContext, Issue, RowResult, TestResult, Verdict } from '../types.js';
import { buildTestResult, fixedLimitRow } from './shared.js';

export interface CreepReading {
  tMin: number;
  i: string;
}

export interface CreepObservation {
  rangeIndex?: number;
  L: string;
  /** Must include t = 0 and the rule pack's scheduled times; t = 240 (4 h) is optional. */
  readings: CreepReading[];
}

export type CreepParams = Record<string, never>;

export function evaluateCreep(
  obs: CreepObservation,
  ctx: EvaluatorContext<CreepParams>,
): TestResult {
  const rangeIndex = obs.rangeIndex ?? 0;
  const range = ctx.instrument.ranges[rangeIndex];
  if (!range) {
    const issues: Issue[] = [
      { code: 'LOAD_OUT_OF_RANGE', severity: 'error', params: { rangeIndex: String(rangeIndex) } },
    ];
    return buildTestResult(ctx.rulepack, [], issues, []);
  }

  const byTime = new Map(obs.readings.map((r) => [r.tMin, D(r.i)]));
  const i0 = byTime.get(0);
  const extraIssues: Issue[] = [];
  if (i0 === undefined) {
    extraIssues.push({
      code: 'OBS_MISSING',
      severity: 'error',
      clause: '3.9.4.1',
      params: { field: 't=0' },
    });
    return buildTestResult(ctx.rulepack, [], extraIssues, []);
  }

  const e = D(range.e);
  const limit30 = D(ctx.rulepack.limits.creep30MinMaxE).times(e);
  const limit15to30 = D(ctx.rulepack.limits.creep15to30MaxE).times(e);
  const scheduledTimes = ctx.rulepack.limits.creepTimesMin.filter((t) => t > 0);

  const rows: RowResult[] = [];
  let within30MinCriteria = true;

  for (const t of scheduledTimes) {
    const reading = byTime.get(t);
    if (reading === undefined) {
      // A missing scheduled point means the 30-min criteria cannot be
      // evaluated at all; blocks the verdict rather than allowing a partial
      // (and possibly misleadingly passing) row set through.
      extraIssues.push({
        code: 'OBS_MISSING',
        severity: 'error',
        clause: '3.9.4.1',
        params: { field: `t=${t}` },
      });
      within30MinCriteria = false;
      continue;
    }
    const drift = reading.minus(i0);
    const row = fixedLimitRow(`t${t}`, drift, limit30, e);
    if (row.verdict !== 'PASS') within30MinCriteria = false;
    rows.push(row);
  }

  const i15 = byTime.get(15);
  const i30 = byTime.get(30);
  if (i15 !== undefined && i30 !== undefined) {
    const drift15to30 = i30.minus(i15);
    const row = fixedLimitRow('t15-30', drift15to30, limit15to30, e);
    if (row.verdict !== 'PASS') within30MinCriteria = false;
    rows.push(row);
  } else {
    within30MinCriteria = false;
  }

  if (within30MinCriteria) {
    return buildTestResult(ctx.rulepack, rows, extraIssues, []);
  }

  // Fallback: a 4-hour reading within mpe(L) still passes the test overall.
  const extendedT = ctx.rulepack.limits.creepExtendedTimeMin;
  const extendedReading = byTime.get(extendedT);
  if (extendedReading === undefined) {
    return buildTestResult(ctx.rulepack, rows, extraIssues, []);
  }

  const mpeResult = mpe(ctx.instrument, obs.L, ctx.rulepack, { rangeIndex });
  const mpeValue = D(mpeResult.value);
  const extendedDrift = extendedReading.minus(i0);
  const extendedRow = fixedLimitRow(`t${extendedT}`, extendedDrift, mpeValue, D(mpeResult.eUsed));
  rows.push(extendedRow);

  const overrideVerdict: Verdict = extendedRow.verdict;
  return buildTestResult(ctx.rulepack, rows, extraIssues, [], {}, overrideVerdict);
}
