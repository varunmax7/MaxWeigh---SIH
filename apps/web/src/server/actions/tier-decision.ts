'use server';

import {
  allocateNumber,
  approvals,
  comments,
  type DbTx,
  evaluations,
  evaluationTests,
  labs,
  reports,
} from '@tula/db';
import type { EvaluationStatus } from '@tula/schemas';
import { type ReviewTier, reviewDecisionInputSchema } from '@tula/schemas';
import { eq, inArray, sql } from 'drizzle-orm';
import { ActionError, action } from '@/server/action';
import { enqueue } from '@/server/jobs';
import { labMembersWithRole, notifyUsers } from '@/server/notify';
import { QUEUES } from '@/server/queues';
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

  // Tier 3's approval *is* the seal (§6.3: "Seals (signed PDF generated)").
  // A certificate number is only minted for CONFORMS (§8.1) — the overall
  // verdict was already fixed at submit time (`submitForReviewAction`
  // stores `overallVerdict` from that same snapshot), so there is nothing
  // left to compute here, only to mint. The PDF/DOCX themselves are the
  // worker's job from here — enqueued by the caller once this transaction
  // has actually committed (see the Decision note below `applyApprove`).
  if (tier === 3 && evaluation.overallVerdict === 'CONFORMS') {
    const [lab] = await tx
      .select({ code: labs.code })
      .from(labs)
      .where(eq(labs.id, evaluation.labId));
    if (lab) {
      const year = new Date().getFullYear();
      const seq = await allocateNumber(tx, evaluation.labId, year, 'CERT');
      const certificateNo = `IN-R76-${lab.code}-${year}-${String(seq).padStart(4, '0')}`;
      await tx
        .update(reports)
        .set({ certificateNo })
        .where(eq(reports.currentVersionId, currentVersionId));
    }
  }

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

  return { status: next, tier, reopenedTests: 0, reportVersionId: currentVersionId };
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

  return {
    status: 'RETURNED' as const,
    tier,
    reopenedTests: toReopen.length,
    reportVersionId: currentVersionId,
  };
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
function makeTierDecisionAction({ tier, permission }: TierActionOptions) {
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
export const decideTier1Action = makeTierDecisionAction({ tier: 1, permission: 'review.tier1' });

/** Tier 2 — Chief metrology officer approves (§6.2 `review.tier2`). */
export const decideTier2Action = makeTierDecisionAction({ tier: 2, permission: 'review.tier2' });

const decideTier3ActionInner = makeTierDecisionAction({ tier: 3, permission: 'report.seal' });

/**
 * Tier 3 — the Controller's seal (§6.2 `report.seal`). Wraps the shared
 * handler only to enqueue `report.render` *after* it returns — `action()`'s
 * transaction has committed by the time the awaited call resolves, so this
 * is provably post-commit, unlike enqueueing from inside the handler itself
 * (`server/notify.ts`'s docstring covers why that would be wrong: a job
 * sent from inside a transaction survives that transaction's rollback).
 */
export async function decideTier3Action(
  ...args: Parameters<typeof decideTier3ActionInner>
): ReturnType<typeof decideTier3ActionInner> {
  const result = await decideTier3ActionInner(...args);
  if (result.ok && result.data.status === 'ISSUED') {
    await enqueue(QUEUES.reportRender, { reportVersionId: result.data.reportVersionId });
  }
  return result;
}
