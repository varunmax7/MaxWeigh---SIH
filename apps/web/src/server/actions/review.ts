'use server';

import { evaluations, reports, reportVersions } from '@tula/db';
import { diffReportModels, nextVersion, type ReportModel, summarizeChanges } from '@tula/report';
import { submitForReviewInputSchema } from '@tula/schemas';
import { eq, sql } from 'drizzle-orm';
import { ActionError, action } from '@/server/action';
import { labMembersWithRole, notifyUsers } from '@/server/notify';
import { buildSnapshot } from '@/server/report-snapshot';
import {
  findOrCreateReport,
  guard,
  latestVersion,
  loadEvaluation,
  loadTests,
  toTestSummaries,
} from '@/server/review-core';
import {
  assertReadyToSubmit,
  assertTransition,
  TIER_ROLE,
  toEvaluationStatus,
} from '@/server/workflow';

/**
 * `IN_TESTING | RETURNED | AMENDING → PENDING_T1` (implementation.md §6.3).
 * Creates the report on first submit and a new `report_versions` row every
 * time: a resubmit after a return is v1.1, a post-issue amendment is v2.0.
 * The tests are locked in the same transaction — from here on they are
 * read-only until someone returns the report.
 */
export const submitForReviewAction = action(
  {
    schema: submitForReviewInputSchema,
    permission: 'evaluation.submit',
    audit: {
      action: 'evaluation.submit_for_review',
      entityType: 'evaluation',
      entityId: (i) => i.evaluationId,
      diff: (_input, result) => {
        const data = result as { version: string; modelSha256: string; verdict: string };
        return { version: data.version, modelSha256: data.modelSha256, verdict: data.verdict };
      },
    },
  },
  async ({ evaluationId }, { tx, assertLabAccess, session }) => {
    const evaluation = await loadEvaluation(tx, evaluationId);
    await assertLabAccess(evaluation.labId);

    const wasAmending = evaluation.status === 'AMENDING';
    // §6.3 has no RETURNED --> PENDING_T1 edge: the tester's reopened tests
    // move the evaluation back through IN_TESTING first. Submitting from
    // RETURNED without having touched a test is the same journey with no
    // stop, so it is walked explicitly rather than given an edge of its own.
    const from =
      evaluation.status === 'RETURNED' ? 'IN_TESTING' : toEvaluationStatus(evaluation.status);
    await guard(() => assertTransition(from, 'PENDING_T1'));

    const tests = await loadTests(tx, evaluationId);
    await guard(() => assertReadyToSubmit(toTestSummaries(tests)));

    const report = await findOrCreateReport(tx, evaluationId, evaluation.labId);
    const previous = await latestVersion(tx, report.id);
    const version = nextVersion(previous?.version ?? null, wasAmending ? 'major' : 'minor');

    const snapshot = await buildSnapshot(tx, evaluationId, report.reportNo, version);
    if (!snapshot) throw new ActionError('NOT_FOUND', 'Evaluation not found.');

    let changeSummary: string | null = null;
    if (previous) {
      const { changes, total } = diffReportModels(
        previous.model as unknown as ReportModel,
        snapshot.model,
      );
      changeSummary = summarizeChanges(changes, total);
      await tx
        .update(reportVersions)
        .set({ status: 'SUPERSEDED' })
        .where(eq(reportVersions.id, previous.id));
    }

    const [created] = await tx
      .insert(reportVersions)
      .values({
        reportId: report.id,
        version,
        model: snapshot.model as unknown as Record<string, unknown>,
        modelSha256: snapshot.sha256,
        changeSummary,
        createdBy: session.user.id,
      })
      .returning({ id: reportVersions.id });
    if (!created) throw new Error('report_versions insert returned no row');

    await tx
      .update(reports)
      .set({ currentVersionId: created.id, status: 'IN_REVIEW' })
      .where(eq(reports.id, report.id));

    await tx
      .update(evaluations)
      .set({
        status: 'PENDING_T1',
        overallVerdict: snapshot.model.summary.overallVerdict,
        submittedAt: evaluation.submittedAt ?? new Date(),
        lockedAt: new Date(),
        updatedAt: new Date(),
        rowVersion: sql`${evaluations.rowVersion} + 1`,
      })
      .where(eq(evaluations.id, evaluationId));

    await notifyUsers(tx, {
      userIds: await labMembersWithRole(tx, evaluation.labId, TIER_ROLE[1]),
      type: 'review.pending',
      payload: {
        evaluationId,
        refNo: evaluation.refNo,
        message: `${evaluation.refNo} is ready for tier 1 verification.`,
      },
      exceptUserId: session.user.id,
    });

    return {
      version,
      modelSha256: snapshot.sha256,
      verdict: snapshot.model.summary.overallVerdict,
    };
  },
);
