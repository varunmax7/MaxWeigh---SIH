/**
 * The "fast" completion blockers for a test (implementation.md §10 P6:
 * "completeTest (guards: no blocking issues, env start/end present, weight
 * sets valid and adequate)"; §7.7: "Mark test complete (button disabled
 * with reason)"). Pure and side-effect free so the client can disable the
 * button and list reasons live, without a round trip — the standards
 * valid/adequate guard needs a DB read (calibration status, R 111 MPE
 * lookup), so it lives only in `completeTestAction`'s server-side check and
 * surfaces as an error after a click rather than a pre-disabled reason.
 */
import type { Issue, TestResult } from '@tula/engine';

export interface CompletionBlocker {
  code: string;
  message: string;
}

/**
 * §4.6's "start and end temperature/RH are mandatory" is scoped to
 * "all load-based tests" — the ones judged against `mpe(L)` — not every
 * test code. A checklist (`EXAM_MARKINGS`), a pure time-drift test
 * (`CREEP`), or a test where temperature *is* the reading dimension
 * (`TEMP_NO_LOAD`) has no env-conditions field in its observation schema
 * at all, so blocking completion on one would be unsatisfiable, not
 * strict. Kept as an explicit allowlist rather than "every test except
 * checklists" so adding a new load-based evaluator is a deliberate,
 * visible one-line change here — see docs/QUESTIONS.md.
 */
const TESTS_REQUIRING_ENV_CONDITIONS = new Set(['WEIGHING', 'ECCENTRICITY']);

export function requiresEnvConditions(testCode: string): boolean {
  return TESTS_REQUIRING_ENV_CONDITIONS.has(testCode);
}

export function computeFastCompletionBlockers({
  testCode,
  result,
  envStart,
  envEnd,
}: {
  testCode: string;
  result: TestResult | null;
  envStart: unknown;
  envEnd: unknown;
}): CompletionBlocker[] {
  const blockers: CompletionBlocker[] = [];

  if (!result) {
    blockers.push({ code: 'NO_OBSERVATIONS', message: 'No observations have been saved yet.' });
    return blockers;
  }
  if (result.verdict === 'INCOMPLETE' || result.issues.some((i: Issue) => i.severity === 'error')) {
    blockers.push({
      code: 'BLOCKING_ISSUES',
      message: 'Fix the blocking issues in the observations.',
    });
  }

  if (requiresEnvConditions(testCode)) {
    if (!envStart)
      blockers.push({ code: 'ENV_START_MISSING', message: 'Start conditions are missing.' });
    if (!envEnd) blockers.push({ code: 'ENV_END_MISSING', message: 'End conditions are missing.' });
  }

  return blockers;
}
