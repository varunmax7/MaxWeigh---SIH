/**
 * `EXAM_CONSTRUCTION` — construction vs. documentation, sealing, and software
 * identification (R 76-1 clause 3.10, Annex A; implementation.md §4.6). A
 * checklist item, not a measurement.
 */
import type { EvaluatorContext, Issue, RowResult, TestResult } from '../types.js';
import type { ChecklistItem } from './examMarkings.js';
import { buildTestResult } from './shared.js';

export interface ExamConstructionObservation {
  items: ChecklistItem[];
}

export type ExamConstructionParams = Record<string, never>;

export function evaluateExamConstruction(
  obs: ExamConstructionObservation,
  ctx: EvaluatorContext<ExamConstructionParams>,
): TestResult {
  if (obs.items.length === 0) {
    const issues: Issue[] = [
      { code: 'OBS_MISSING', severity: 'error', clause: '3.10', params: { field: 'items' } },
    ];
    return buildTestResult(ctx.rulepack, [], issues, []);
  }

  const rows: RowResult[] = obs.items
    .filter((item) => item.status !== 'not_applicable')
    .map((item) => ({
      rowId: item.key,
      verdict: item.status === 'ok' ? 'PASS' : 'FAIL',
      issues:
        item.status === 'fail'
          ? [
              {
                code: 'EXAM_ITEM_FAIL',
                severity: 'error' as const,
                clause: '3.10',
                params: { key: item.key, note: item.note ?? '' },
              },
            ]
          : [],
    }));

  return buildTestResult(ctx.rulepack, rows, [], []);
}
