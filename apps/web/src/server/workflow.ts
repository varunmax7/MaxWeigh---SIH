/**
 * The evaluation state machine and the separation-of-duties rules
 * (implementation.md §6.2 "Separation of duties", §6.3, §10 P7).
 *
 * Pure functions over plain data — no database, no session, no Next.js — so
 * every transition and every SoD rule is unit-testable without a fixture, and
 * the server actions in `actions/review.ts` stay thin wrappers that fetch,
 * ask this module, then write.
 */
// Type-only imports: erased at compile time under `verbatimModuleSyntax`, so
// this module stays importable from a Client Component without dragging
// `@tula/db`'s live postgres connection into the browser bundle (see
// docs/PROGRESS.md P5 for the bug that established that rule).
import type { Role } from '@tula/db';
import { EVALUATION_STATUSES, type EvaluationStatus, type ReviewTier } from '@tula/schemas';

/**
 * `evaluations.status` is a `text` column with a CHECK constraint, so Drizzle
 * types it as `string`. This re-validates against the enum at the one place a
 * stored status enters the workflow — the same approach `server/session.ts`
 * takes for `user.role`, and the reason nothing below needs a blind cast.
 */
export function toEvaluationStatus(value: string): EvaluationStatus {
  if (!(EVALUATION_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`unrecognised evaluation status: ${value}`);
  }
  return value as EvaluationStatus;
}

/**
 * §6.3's diagram, as data. A transition absent from this table is not
 * "unimplemented", it is forbidden: `assertTransition` refuses it.
 */
export const EVALUATION_TRANSITIONS: Record<EvaluationStatus, readonly EvaluationStatus[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['IN_TESTING', 'CANCELLED'],
  IN_TESTING: ['PENDING_T1'],
  PENDING_T1: ['PENDING_T2', 'RETURNED'],
  PENDING_T2: ['PENDING_T3', 'RETURNED'],
  PENDING_T3: ['ISSUED', 'RETURNED'],
  RETURNED: ['IN_TESTING'],
  ISSUED: ['REVOKED', 'AMENDING'],
  AMENDING: ['PENDING_T1'],
  REVOKED: [],
  CANCELLED: [],
};

export function canTransition(from: EvaluationStatus, to: EvaluationStatus): boolean {
  return EVALUATION_TRANSITIONS[from].includes(to);
}

/** The statuses in which `evaluation_tests` rows may still be edited (§6.3 "Locking"). */
export const EDITABLE_TEST_STATUSES: readonly EvaluationStatus[] = [
  'PLANNED',
  'IN_TESTING',
  'RETURNED',
];

/** §6.3: "from PENDING_T1 onward all tests are read-only". */
export function testsAreLocked(status: EvaluationStatus): boolean {
  return !EDITABLE_TEST_STATUSES.includes(status);
}

/** Which tier is waiting on a decision, or null when nothing is pending review. */
export function pendingTier(status: EvaluationStatus): ReviewTier | null {
  if (status === 'PENDING_T1') return 1;
  if (status === 'PENDING_T2') return 2;
  if (status === 'PENDING_T3') return 3;
  return null;
}

/** Where an APPROVE by `tier` lands. Tier 3's approval is the seal itself (P8). */
export function statusAfterApproval(tier: ReviewTier): EvaluationStatus {
  if (tier === 1) return 'PENDING_T2';
  if (tier === 2) return 'PENDING_T3';
  return 'ISSUED';
}

/** The role that holds each tier, for messages and the signatory chain's labels (§6.2). */
export const TIER_ROLE: Record<ReviewTier, Role> = {
  1: 'SENIOR_TESTING_OFFICER',
  2: 'CHIEF_METROLOGY_OFFICER',
  3: 'CONTROLLER',
};

export const TIER_LABEL: Record<ReviewTier, string> = {
  1: 'Tier 1 — verification',
  2: 'Tier 2 — approval',
  3: 'Tier 3 — seal and issue',
};

/** The verb each tier's decision button uses, kept identical in button, toast and audit (§7.8). */
export const TIER_APPROVE_VERB: Record<ReviewTier, string> = {
  1: 'Verify',
  2: 'Approve',
  3: 'Seal and issue',
};

export type WorkflowViolation =
  | { code: 'TRANSITION'; message: string }
  | { code: 'TESTS_INCOMPLETE'; message: string }
  | { code: 'SOD_1'; message: string }
  | { code: 'SOD_2'; message: string }
  | { code: 'SOD_3'; message: string }
  | { code: 'STALE_MODEL'; message: string };

export class WorkflowError extends Error {
  constructor(readonly violation: WorkflowViolation) {
    super(violation.message);
    this.name = 'WorkflowError';
  }
}

function fail(violation: WorkflowViolation): never {
  throw new WorkflowError(violation);
}

export function assertTransition(from: EvaluationStatus, to: EvaluationStatus): void {
  if (!canTransition(from, to)) {
    fail({
      code: 'TRANSITION',
      message: `This evaluation is ${from.toLowerCase().replace('_', ' ')} — it cannot move to ${to
        .toLowerCase()
        .replace('_', ' ')}.`,
    });
  }
}

export interface TestSummaryForSubmit {
  testCode: string;
  applicability: string;
  status: string;
  /** Who pressed "Mark test complete" — the input to SoD-1. */
  completedBy: string | null;
}

/** §6.3: `IN_TESTING --> PENDING_T1` only once every applicable test is COMPLETED. */
export function assertReadyToSubmit(tests: readonly TestSummaryForSubmit[]): void {
  const applicable = tests.filter((t) => t.applicability === 'APPLICABLE');
  if (applicable.length === 0) {
    fail({
      code: 'TESTS_INCOMPLETE',
      message: 'This evaluation has no applicable tests to report on.',
    });
  }
  const open = applicable.filter((t) => t.status !== 'COMPLETED');
  if (open.length > 0) {
    fail({
      code: 'TESTS_INCOMPLETE',
      message: `${open.length} test${open.length === 1 ? '' : 's'} still need${
        open.length === 1 ? 's' : ''
      } to be marked complete: ${open.map((t) => t.testCode).join(', ')}.`,
    });
  }
}

/**
 * SoD-1: "anyone who completed a test on the evaluation cannot perform Tier 1
 * on it." Scoped to tier 1 exactly as §6.2 words it — a tier 2 or 3 approver
 * would never hold `test.execute` under the permission matrix anyway, so the
 * rule has nothing to add there.
 */
export function assertSod1(
  tier: ReviewTier,
  userId: string,
  tests: readonly TestSummaryForSubmit[],
): void {
  if (tier !== 1) return;
  if (tests.some((t) => t.completedBy === userId)) {
    fail({
      code: 'SOD_1',
      message:
        'You completed a test on this evaluation, so you cannot verify it at tier 1. Another senior testing officer must review it.',
    });
  }
}

export interface ApprovalForSod {
  tier: number;
  userId: string;
  decision: string;
  /** The model hash the approval was taken against — a decision on superseded data no longer counts. */
  modelSha256: string;
}

/**
 * SoD-2: "Tier 1, Tier 2 and Tier 3 approvers are three distinct users."
 * Only approvals bound to the *current* model hash are considered: once the
 * data changes the report is a new version and the chain starts over (§6.3
 * "Approvals bind to model_sha256").
 */
export function assertSod2(
  tier: ReviewTier,
  userId: string,
  approvals: readonly ApprovalForSod[],
  currentModelSha256: string,
): void {
  const live = approvals.filter(
    (a) => a.decision === 'APPROVED' && a.modelSha256 === currentModelSha256,
  );
  const clash = live.find((a) => a.userId === userId);
  if (clash) {
    fail({
      code: 'SOD_2',
      message: `You already signed this report at tier ${clash.tier}. Tiers 1, 2 and 3 must be three different people.`,
    });
  }
  if (live.some((a) => a.tier === tier)) {
    fail({
      code: 'SOD_2',
      message: `Tier ${tier} has already signed this version of the report.`,
    });
  }
}

/** SoD-3: a rule pack publish needs an ADMIN initiator and a *different* CONTROLLER confirmer. */
export function assertSod3(initiatorId: string, confirmerId: string): void {
  if (initiatorId === confirmerId) {
    fail({
      code: 'SOD_3',
      message:
        'Publishing a rule pack needs two people: the administrator who drafted it and a different controller to confirm.',
    });
  }
}

/** §6.3: a decision taken against a superseded snapshot is refused, never silently applied. */
export function assertModelCurrent(seen: string, current: string): void {
  if (seen !== current) {
    fail({
      code: 'STALE_MODEL',
      message:
        'The report changed while you were reviewing it. Reload to see the current version before deciding.',
    });
  }
}

/**
 * §6.3: "RETURNED unlocks only the tests that carry unresolved comments."
 * Returns the ids to move COMPLETED → REOPENED.
 */
export function testsToUnlock(
  tests: readonly { id: string; status: string }[],
  unresolvedCommentTestIds: readonly string[],
): string[] {
  const flagged = new Set(unresolvedCommentTestIds);
  return tests.filter((t) => flagged.has(t.id) && t.status === 'COMPLETED').map((t) => t.id);
}
