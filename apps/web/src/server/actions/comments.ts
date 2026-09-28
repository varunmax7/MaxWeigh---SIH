'use server';

import { comments, evaluations, evaluationTests, notifications } from '@tula/db';
import {
  commentInputSchema,
  markNotificationsReadInputSchema,
  resolveCommentInputSchema,
} from '@tula/schemas';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { ActionError, action } from '@/server/action';
import { notifyUsers } from '@/server/notify';
import { pendingTier, toEvaluationStatus } from '@/server/workflow';

/**
 * Comment threads anchored to a test or an observation row (implementation.md
 * §7.5 "comment threads anchored to a test or a row").
 *
 * `evaluation.read` is the permission: §6.2's matrix has no `comment`
 * permission and §11 forbids inventing one, and reading an evaluation is the
 * closest thing the matrix says about who may take part in its review.
 * AUDITOR is excluded in the handler — the matrix gives an auditor read and
 * export only, so letting one write into an evaluation's review record would
 * contradict the role. Logged as docs/QUESTIONS.md #32.
 */
export const addCommentAction = action(
  {
    schema: commentInputSchema,
    permission: 'evaluation.read',
    audit: {
      action: 'comment.create',
      entityType: 'evaluation',
      entityId: (i) => i.evaluationId,
      diff: (i) => ({ testId: i.testId ?? null, rowRef: i.rowRef ?? null }),
    },
  },
  async (input, { tx, assertLabAccess, session }) => {
    if (session.user.role === 'AUDITOR') {
      throw new ActionError('FORBIDDEN', 'Auditors have read-only access to evaluations.');
    }

    const [evaluation] = await tx
      .select({
        labId: evaluations.labId,
        refNo: evaluations.refNo,
        status: evaluations.status,
        assignedTesterId: evaluations.assignedTesterId,
      })
      .from(evaluations)
      .where(eq(evaluations.id, input.evaluationId));
    if (!evaluation) throw new ActionError('NOT_FOUND', 'Evaluation not found.');
    await assertLabAccess(evaluation.labId);

    if (input.testId) {
      const [test] = await tx
        .select({ id: evaluationTests.id })
        .from(evaluationTests)
        .where(
          and(
            eq(evaluationTests.id, input.testId),
            eq(evaluationTests.evaluationId, input.evaluationId),
          ),
        );
      if (!test) throw new ActionError('NOT_FOUND', 'That test is not part of this evaluation.');
    }

    if (input.parentId) {
      const [parent] = await tx
        .select({ id: comments.id })
        .from(comments)
        .where(and(eq(comments.id, input.parentId), eq(comments.evaluationId, input.evaluationId)));
      if (!parent)
        throw new ActionError('NOT_FOUND', 'That thread is not part of this evaluation.');
    }

    const [created] = await tx
      .insert(comments)
      .values({
        evaluationId: input.evaluationId,
        testId: input.testId ?? null,
        rowRef: input.rowRef ?? null,
        parentId: input.parentId ?? null,
        authorId: session.user.id,
        tier: pendingTier(toEvaluationStatus(evaluation.status)),
        body: input.body,
      })
      .returning({ id: comments.id });
    if (!created) throw new Error('comments insert returned no row');

    if (evaluation.assignedTesterId) {
      await notifyUsers(tx, {
        userIds: [evaluation.assignedTesterId],
        type: 'review.returned',
        payload: {
          evaluationId: input.evaluationId,
          refNo: evaluation.refNo,
          message: `${session.user.name} commented on ${evaluation.refNo}.`,
        },
        exceptUserId: session.user.id,
      });
    }

    return { id: created.id };
  },
);

/**
 * Marks a thread resolved. Resolving is what re-locks a test on the next
 * submit — §6.3's "unlock only the tests that carry unresolved comments" reads
 * `resolved_at`, so this is a workflow action and not just housekeeping.
 */
export const resolveCommentAction = action(
  {
    schema: resolveCommentInputSchema,
    permission: 'evaluation.read',
    audit: {
      action: 'comment.resolve',
      entityType: 'comment',
      entityId: (i) => i.commentId,
    },
  },
  async ({ commentId }, { tx, assertLabAccess, session }) => {
    if (session.user.role === 'AUDITOR') {
      throw new ActionError('FORBIDDEN', 'Auditors have read-only access to evaluations.');
    }

    const [row] = await tx
      .select({ id: comments.id, labId: evaluations.labId, resolvedAt: comments.resolvedAt })
      .from(comments)
      .innerJoin(evaluations, eq(comments.evaluationId, evaluations.id))
      .where(eq(comments.id, commentId));
    if (!row) throw new ActionError('NOT_FOUND', 'Comment not found.');
    await assertLabAccess(row.labId);
    if (row.resolvedAt) return { id: commentId };

    await tx.update(comments).set({ resolvedAt: new Date() }).where(eq(comments.id, commentId));
    return { id: commentId };
  },
);

/**
 * Clears the notification bell. It is a mutation, so it goes through
 * `action()` like every other one (§11) even though the interesting part is
 * the `user_id` predicate: that, not the ids in the input, is what stops one
 * user marking another's notifications read.
 */
export const markNotificationsReadAction = action(
  {
    schema: markNotificationsReadInputSchema,
    permission: 'evaluation.read',
    audit: { action: 'notification.read', entityType: 'notification' },
  },
  async ({ ids }, { tx, session }) => {
    const mine = and(
      eq(notifications.userId, session.user.id),
      isNull(notifications.readAt),
      ids.length > 0 ? inArray(notifications.id, ids) : undefined,
    );
    await tx.update(notifications).set({ readAt: new Date() }).where(mine);
    return { ok: true };
  },
);
