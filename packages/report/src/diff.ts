/**
 * Field-level diff between two `ReportModel` snapshots (implementation.md
 * §7.5 "version history with change summaries and diff link", §10 P7).
 *
 * Works on the canonical JSON tree rather than on the typed shape, so a
 * change anywhere in the snapshot — an indication, a weight set, a spec
 * field — shows up without this module having to enumerate the model's
 * fields and drift from it.
 */
import type { ReportModel } from './model.js';

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface FieldChange {
  /** Dotted JSON path, e.g. `tests.2.observations.ascending.1.I`. */
  path: string;
  kind: ChangeKind;
  before: string | null;
  after: string | null;
}

/** Leaf values are rendered for display, never for further comparison. */
function render(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value) ?? String(value);
}

function isLeaf(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function walk(before: unknown, after: unknown, path: string, out: FieldChange[]): void {
  if (before === undefined && after === undefined) return;
  if (before === undefined) {
    out.push({ path, kind: 'added', before: null, after: render(after) });
    return;
  }
  if (after === undefined) {
    out.push({ path, kind: 'removed', before: render(before), after: null });
    return;
  }

  if (isLeaf(before) || isLeaf(after)) {
    if (render(before) !== render(after)) {
      out.push({ path, kind: 'changed', before: render(before), after: render(after) });
    }
    return;
  }

  if (Array.isArray(before) !== Array.isArray(after)) {
    out.push({ path, kind: 'changed', before: render(before), after: render(after) });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    for (let i = 0; i < Math.max(before.length, after.length); i += 1) {
      walk(before[i], after[i], join(path, String(i)), out);
    }
    return;
  }

  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    walk(left[key], right[key], join(path, key), out);
  }
}

/**
 * Every leaf that differs between two snapshots, in stable path order.
 *
 * `limit` caps the list — a diff across a whole re-run of the test battery
 * can be thousands of leaves, and a review screen only ever shows the first
 * screenful. The count of what was cut is the caller's to report.
 */
export function diffReportModels(
  before: ReportModel,
  after: ReportModel,
  limit = 200,
): { changes: FieldChange[]; total: number } {
  const all: FieldChange[] = [];
  walk(before, after, '', all);
  return { changes: all.slice(0, limit), total: all.length };
}

/**
 * A one-line `report_versions.change_summary`. Deliberately coarse: it names
 * how many fields moved and which tests they were in, because the precise
 * list is a click away in the diff view.
 */
export function summarizeChanges(changes: FieldChange[], total: number): string {
  if (total === 0) return 'No data changes.';
  const testIndexes = new Set<string>();
  for (const change of changes) {
    const match = /^tests\.(\d+)\./.exec(change.path);
    if (match?.[1]) testIndexes.add(match[1]);
  }
  const fields = `${total} field${total === 1 ? '' : 's'} changed`;
  if (testIndexes.size === 0) return `${fields}.`;
  return `${fields} across ${testIndexes.size} test${testIndexes.size === 1 ? '' : 's'}.`;
}
