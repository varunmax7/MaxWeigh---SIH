/**
 * The one place that calls `@tula/engine`'s classification check
 * (implementation.md §11: "All OIML logic lives in packages/engine. UI and
 * server code call it; they never re-implement a rule"). Pure and
 * side-effect free, so the exact same function runs client-side for the
 * live `ClassificationPanel` and server-side as the authoritative gate in
 * `server/actions/masterdata.ts` — never two implementations to drift apart.
 */
import { type InstrumentMetrology, type Issue, validateInstrument } from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';

export function classifyInstrument(spec: InstrumentMetrology): Issue[] {
  return validateInstrument(spec, OIML_R76_1_2006);
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}
