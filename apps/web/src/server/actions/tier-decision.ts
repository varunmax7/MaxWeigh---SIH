'use server';

import { approvals, comments, type DbTx, evaluations, evaluationTests } from '@tula/db';
import type { EvaluationStatus } from '@tula/schemas';
import { type ReviewTier, reviewDecisionInputSchema } from '@tula/schemas';
import { eq, inArray, sql } from 'drizzle-orm';
import { ActionError, action } from '@/server/action';
import { labMembersWithRole, notifyUsers } from '@/server/notify';
import type { Permission } from '@/server/rbac';
import { buildSnapshot } from '@/server/report-snapshot';
import {
  guard,
  loadCurrentVersion,
  loadEvaluation,
  loadTests,
  toTestSummaries,
  unresolvedCommentTestIds,
} from '@/server/review-core';
import type { AppSession } from '@/server/session';
import { assertStepUp } from '@/server/step-up';
import {
  assertModelCurrent,
  assertSod1,
  assertSod2,
  assertTransition,
  pendingTier,
  statusAfterApproval,
  TIER_ROLE,
  toEvaluationStatus,
} from '@/server/workflow';

interface TierActionOptions {
  tier: ReviewTier;
  permission: Permission;
  /** Tier 3's approval *is* the seal, which needs the signed-PDF pipeline of P8. */
  allowApprove: boolean;
}

interface DecisionContext {
  tx: DbTx;
  session: AppSession;
  tier: ReviewTier;
  evaluationId: string;
  evaluation: typeof evaluations.$inferSelect;
  status: EvaluationStatus;
  currentVersionId: string;
  currentModelSha256: string;
  comment: string | null;
}

/** APPROVE: SoD-1/2, the transition, the approval row, and notifying the next tier. */
async function applyApprove(ctx: DecisionContext) {
  const {
    tx,
    session,
    tier,
    evaluationId,
    evaluation,
    status,
    currentVersionId,
    currentModelSha256,
  } = ctx;
  const tests = await loadTests(tx, evaluationId);
  const existing = await tx
    .select({
      tier: approvals.tier,
      userId: approvals.userId,
      decision: approvals.decision,
      modelSha256: approvals.modelSha256,
    })
    .from(approvals)
    .where(eq(approvals.reportVersionId, currentVersionId));

  await guard(() => {
    assertSod1(tier, session.user.id, toTestSummaries(tests));
    assertSod2(tier, session.user.id, existing, currentModelSha256);
  });

  const next = statusAfterApproval(tier);
  await guard(() => assertTransition(status, next));

  await tx.insert(approvals).values({
    reportVersionId: currentVersionId,
    tier,
    decision: 'APPROVED',
    userId: session.user.id,
    comment: ctx.comment,
    modelSha256: currentModelSha256,
    stepUpVerified: true,
  });

  await tx
    .update(evaluations)
    .set({ status: next, updatedAt: new Date(), rowVersion: sql`${evaluations.rowVersion} + 1` })
    .where(eq(evaluations.id, evaluationId));

  const nextTier = pendingTier(next);
  if (nextTier) {
    await notifyUsers(tx, {
      userIds: await labMembersWithRole(tx, evaluation.labId, TIER_ROLE[nextTier]),
      type: 'review.pending',
      payload: {
        evaluationId,
        refNo: evaluation.refNo,
        message: `${evaluation.refNo} is ready for tier ${nextTier} review.`,
      },
      exceptUserId: session.user.id,
    });
  }

  return { status: next, tier, reopenedTests: 0 };
}

/** RETURN: the transition, the approval + comment record, reopening flagged tests, and notifying the tester. */
async function applyReturn(ctx: DecisionContext) {
  const {
    tx,
    session,
    tier,
    evaluationId,
    evaluation,
    status,
    currentVersionId,
    currentModelSha256,
  } = ctx;
  await guard(() => assertTransition(status, 'RETURNED'));

  await tx.insert(approvals).values({
    reportVersionId: currentVersionId,
    tier,
    decision: 'RETURNED',
    userId: session.user.id,
    comment: ctx.comment,
    modelSha256: currentModelSha256,
    stepUpVerified: true,
  });

  // The decision's own note is a comment thread too, so the tester reads one
  // list rather than a summary in one place and anchors in another.
  await tx.insert(comments).values({
    evaluationId,
    authorId: session.user.id,
    tier,
    body: ctx.comment ?? '',
  });

  const tests = await loadTests(tx, evaluationId);
  const flagged = new Set(await unresolvedCommentTestIds(tx, evaluationId));
  const toReopen = tests
    .filter((t) => flagged.has(t.id) && t.status === 'COMPLETED')
    .map((t) => t.id);
  if (toReopen.length > 0) {
    await tx
      .update(evaluationTests)
      .set({ status: 'REOPENED', rowVersion: sql`${evaluationTests.rowVersion} + 1` })
      .where(inArray(evaluationTests.id, toReopen));
  }

  await tx
    .update(evaluations)
    .set({
      status: 'RETURNED',
      lockedAt: null,
      updatedAt: new Date(),
      rowVersion: sql`${evaluations.rowVersion} + 1`,
    })
    .where(eq(evaluations.id, evaluationId));

  if (evaluation.assignedTesterId) {
    await notifyUsers(tx, {
      userIds: [evaluation.assignedTesterId],
      type: 'review.returned',
      payload: {
        evaluationId,
        refNo: evaluation.refNo,
        message: `${evaluation.refNo} was returned from tier ${tier} with comments.`,
      },
      exceptUserId: session.user.id,
    });
  }

  return { status: 'RETURNED' as const, tier, reopenedTests: toReopen.length };
}

/**
 * One decision action per tier (implementation.md §6.3, §7.5 "decision
 * block"), because `action()` takes a single static permission and §6.2 gives
 * each tier its own: `review.tier1`, `review.tier2`, `report.seal`. They share
 * this handler so the guard order is identical for all three:
 *
 *   is this tier even pending → is the reviewer deciding on the current
 *   snapshot → does that snapshot still match the data → fresh TOTP →
 *   SoD (approve only) → apply.
 *
 * Step-up comes after the cheap refusals and before any write, so a reviewer
 * is never asked for a code only to be told the report moved on.
 */
function makeTierDecisionAction({ tier, permission, allowApprove }: TierActionOptions) {
  return action(
    {
      schema: reviewDecisionInputSchema,
      permission,
      audit: {
        action: `report.tier${tier}_decision`,
        entityType: 'evaluation',
        entityId: (i) => i.evaluationId,
        diff: (i) => ({ tier, decision: i.decision, modelSha256: i.modelSha256 }),
      },
    },
    async (input, { tx, assertLabAccess, session }) => {
      const evaluation = await loadEvaluation(tx, input.evaluationId);
      await assertLabAccess(evaluation.labId);
      const status = toEvaluationStatus(evaluation.status);

      if (pendingTier(status) !== tier) {
        throw new ActionError(
          'CONFLICT',
          `This evaluation is not waiting on tier ${tier} — reload to see where it is now.`,
        );
      }
      if (input.decision === 'APPROVE' && !allowApprove) {
        throw new ActionError(
          'RULE',
          'Sealing and issuing the certificate is not available yet. Return the report with comments, or wait for the signing release.',
        );
      }
      if (input.decision === 'RETURN' && !input.comment) {
        throw new ActionError('RULE', 'Say what needs to change before returning the report.');
      }

      const { report, current } = await loadCurrentVersion(tx, input.evaluationId);
      await guard(() => assertModelCurrent(input.modelSha256, current.modelSha256));

      // Approval invalidation (§6.3): the stored snapshot must still describe
      // the evaluation's data. Locking should make a mismatch impossible, so
      // this is what catches any path that slipped past it rather than
      // signing data nobody reviewed.
      const rebuilt = await buildSnapshot(tx, input.evaluationId, report.reportNo, current.version);
      if (rebuilt && rebuilt.sha256 !== current.modelSha256) {
        throw new ActionError(
          'RULE',
          'This evaluation changed after the report version was created, so the pending approvals no longer apply. Submit it for review again.',
        );
      }

      await assertStepUp(input.totpCode);

      const ctx: DecisionContext = {
        tx,
        session,
        tier,
        evaluationId: input.evaluationId,
        evaluation,
        status,
        currentVersionId: current.id,
        currentModelSha256: current.modelSha256,
        comment: input.comment ?? null,
      };

      return input.decision === 'APPROVE' ? applyApprove(ctx) : applyReturn(ctx);
    },
  );
}

/** Tier 1 — Senior testing officer verifies (§6.2 `review.tier1`). */
export const decideTier1Action = makeTierDecisionAction({
  tier: 1,
  permission: 'review.tier1',
  allowApprove: true,
});

/** Tier 2 — Chief metrology officer approves (§6.2 `review.tier2`). */
export const decideTier2Action = makeTierDecisionAction({
  tier: 2,
  permission: 'review.tier2',
  allowApprove: true,
});

/**
 * Tier 3 — the Controller's seal issues the certificate, which needs the
 * signed-PDF pipeline of P8. Until then this action exists so a Controller can
 * still return a report that should not be sealed.
 */
export const decideTier3Action = makeTierDecisionAction({
  tier: 3,
  permission: 'report.seal',
  allowApprove: false,
});
