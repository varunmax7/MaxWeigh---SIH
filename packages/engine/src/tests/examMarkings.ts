/**
 * `EXAM_MARKINGS` — descriptive markings checklist (R 76-1 clause 7.1;
 * implementation.md §4.6). A checklist item, not a measurement: pass when
 * every mandatory item is present and legible.
 */
import type { EvaluatorContext, Issue, RowResult, TestResult } from '../types.js';
import { buildTestResult } from './shared.js';

export type ChecklistStatus = 'ok' | 'fail' | 'not_applicable';

export interface ChecklistItem {
  /** e.g. "manufacturer_mark", "accuracy_class", "max", "min", "e", "serial_no". */
  key: string;
  status: ChecklistStatus;
  note?: string;
}

export interface ExamMarkingsObservation {
  items: ChecklistItem[];
}

export type ExamMarkingsParams = Record<string, never>;

export function evaluateExamMarkings(
  obs: ExamMarkingsObservation,
  ctx: EvaluatorContext<ExamMarkingsParams>,
): TestResult {
  if (obs.items.length === 0) {
    const issues: Issue[] = [
      { code: 'OBS_MISSING', severity: 'error', clause: '7.1', params: { field: 'items' } },
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
                clause: '7.1',
                params: { key: item.key, note: item.note ?? '' },
              },
            ]
          : [],
    }));

  return buildTestResult(ctx.rulepack, rows, [], []);
}
