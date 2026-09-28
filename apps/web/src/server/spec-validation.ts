import type { InstrumentMetrology } from '@tula/engine';
import { classifyInstrument, hasBlockingIssues } from '@/lib/classify';
import { ActionError } from '@/server/action';

/**
 * Validates an `InstrumentMetrology` against `@tula/engine` before ever
 * touching the database — implementation.md §10 P4 acceptance: "An invalid
 * spec shows engine issues with clause references; errors block saving the
 * default spec", reused as-is by P5's evaluation `spec_snapshot`. The live
 * panel runs the same check client-side (`lib/classify.ts`); this is the
 * authoritative, server-side one — kept server-only (imports `ActionError`,
 * which pulls in `@tula/db`) so it can never leak into a client bundle the
 * way `@tula/rulepacks` once did (see docs/PROGRESS.md P4).
 */
export function assertSpecClassifies(spec: InstrumentMetrology | undefined): void {
  if (!spec) return;
  const issues = classifyInstrument(spec);
  if (hasBlockingIssues(issues)) {
    throw new ActionError(
      'RULE',
      `Spec has ${issues.filter((i) => i.severity === 'error').length} blocking classification issue(s).`,
    );
  }
}
