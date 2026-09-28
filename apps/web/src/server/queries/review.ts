/**
 * Read queries for the review screen, the version timeline and the
 * "Needs your action" queue (implementation.md §7.5, §10 P7).
 *
 * Every one is scoped either to a `labId` the caller resolved from the active
 * lab, or to the signed-in user's own rows (§11: "every read query is scoped
 * to the user's labs").
 */

import type { Role } from '@tula/db';
import {
  approvals,
  comments,
  evaluations,
  evaluationTests,
  instrumentModels,
  labs,
  manufacturers,
  notifications,
  reports,
  reportVersions,
  user as userTable,
} from '@tula/db';
import type { CalcStep } from '@tula/engine';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { pendingTier, TIER_ROLE, toEvaluationStatus } from '@/server/workflow';

/** Default per §6.3 "each pending tier has a 48 h target (configurable per lab)". */
export const DEFAULT_SLA_HOURS = 48;

/** The lab's SLA target, from `labs.settings.slaHours` when an admin has set one. */
export async function labSlaHours(labId: string): Promise<number> {
  const [lab] = await db.select({ settings: labs.settings }).from(labs).where(eq(labs.id, labId));
  const configured = lab?.settings?.slaHours;
  return typeof configured === 'number' && configured > 0 ? configured : DEFAULT_SLA_HOURS;
}

/** The report, its current version and the whole version history for one evaluation. */
export async function getReportForEvaluation(evaluationId: string) {
  const [report] = await db.select().from(reports).where(eq(reports.evaluationId, evaluationId));
  if (!report) return null;

  const versions = await db
    .select({
      id: reportVersions.id,
      version: reportVersions.version,
      modelSha256: reportVersions.modelSha256,
      changeSummary: reportVersions.changeSummary,
      status: reportVersions.status,
      createdAt: reportVersions.createdAt,
      createdByName: userTable.name,
    })
    .from(reportVersions)
    .leftJoin(userTable, eq(reportVersions.createdBy, userTable.id))
    .where(eq(reportVersions.reportId, report.id))
    .orderBy(desc(reportVersions.createdAt));

  const current = versions.find((v) => v.id === report.currentVersionId) ?? versions[0] ?? null;
  return { report, versions, current };
}

/** One version's stored `ReportModel`, for the diff view. */
export async function getVersionModel(versionId: string) {
  const [row] = await db
    .select({
      id: reportVersions.id,
      version: reportVersions.version,
      model: reportVersions.model,
      reportId: reportVersions.reportId,
    })
    .from(reportVersions)
    .where(eq(reportVersions.id, versionId));
  return row ?? null;
}

/** The signatory chain: who signed which tier of this version, and when (§7.5). */
export async function listApprovals(reportVersionId: string) {
  return db
    .select({
      id: approvals.id,
      tier: approvals.tier,
      decision: approvals.decision,
      comment: approvals.comment,
      modelSha256: approvals.modelSha256,
      decidedAt: approvals.decidedAt,
      userId: approvals.userId,
      userName: userTable.name,
      userDesignation: userTable.designation,
    })
    .from(approvals)
    .innerJoin(userTable, eq(approvals.userId, userTable.id))
    .where(eq(approvals.reportVersionId, reportVersionId))
    .orderBy(asc(approvals.tier), asc(approvals.decidedAt));
}

/** Every comment thread on an evaluation, oldest first so replies read in order. */
export async function listComments(evaluationId: string) {
  return db
    .select({
      id: comments.id,
      testId: comments.testId,
      rowRef: comments.rowRef,
      parentId: comments.parentId,
      tier: comments.tier,
      body: comments.body,
      resolvedAt: comments.resolvedAt,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
      authorName: userTable.name,
    })
    .from(comments)
    .innerJoin(userTable, eq(comments.authorId, userTable.id))
    .where(eq(comments.evaluationId, evaluationId))
    .orderBy(asc(comments.createdAt));
}

/** Per-test verdict summary for the review screen's read-only workspace. */
export async function listTestsForReview(evaluationId: string) {
  const rows = await db
    .select({
      id: evaluationTests.id,
      testCode: evaluationTests.testCode,
      rangeIndex: evaluationTests.rangeIndex,
      sequence: evaluationTests.sequence,
      applicability: evaluationTests.applicability,
      naReason: evaluationTests.naReason,
      status: evaluationTests.status,
      verdict: evaluationTests.verdict,
      result: evaluationTests.result,
      completedAt: evaluationTests.completedAt,
      completedByName: userTable.name,
    })
    .from(evaluationTests)
    .leftJoin(userTable, eq(evaluationTests.completedBy, userTable.id))
    .where(eq(evaluationTests.evaluationId, evaluationId))
    .orderBy(asc(evaluationTests.sequence), asc(evaluationTests.rangeIndex));
  return rows.map((row) => ({ ...row, steps: stepsOf(row.result) }));
}

/**
 * `evaluation_tests.result` is `jsonb`, so Postgres does not enforce our TS
 * shape on it. This narrows on the one field the review table renders
 * (`CalcStep[]`) rather than casting the whole stored `TestResult` blind.
 */
function stepsOf(result: unknown): CalcStep[] {
  if (!result || typeof result !== 'object') return [];
  const steps = (result as { steps?: unknown }).steps;
  return Array.isArray(steps) ? (steps as CalcStep[]) : [];
}

export interface NeedsActionRow {
  evaluationId: string;
  refNo: string;
  status: string;
  modelName: string;
  manufacturerName: string;
  overallVerdict: string | null;
  /** Hours since the evaluation entered its current pending state. */
  ageHours: number;
  overdue: boolean;
  /** Where the primary button goes. */
  href: string;
}

/**
 * The dashboard's "Needs your action" list (§7.5), role-aware:
 *
 * - a tester sees evaluations returned to them and plans still to be run;
 * - tier 1/2/3 see exactly the evaluations waiting on *their* tier;
 * - an auditor and an admin see nothing here — neither decides anything.
 *
 * SLA age is measured from `updated_at`, which every transition bumps, so it
 * is the time this tier has been waiting rather than the evaluation's total age.
 */
export async function listNeedsYourAction(
  labId: string,
  userId: string,
  role: Role,
  slaHours: number,
): Promise<NeedsActionRow[]> {
  const tierStatus = (Object.entries(TIER_ROLE) as [string, Role][]).find(
    ([, tierRole]) => tierRole === role,
  );

  const statuses: string[] = [];
  if (tierStatus) statuses.push(`PENDING_T${tierStatus[0]}`);
  const isTester = role === 'TESTING_OFFICER' || role === 'SENIOR_TESTING_OFFICER';
  if (isTester) statuses.push('RETURNED', 'PLANNED', 'IN_TESTING');
  if (statuses.length === 0) return [];

  const rows = await db
    .select({
      evaluationId: evaluations.id,
      refNo: evaluations.refNo,
      status: evaluations.status,
      overallVerdict: evaluations.overallVerdict,
      updatedAt: evaluations.updatedAt,
      assignedTesterId: evaluations.assignedTesterId,
      modelName: instrumentModels.modelName,
      manufacturerName: manufacturers.name,
    })
    .from(evaluations)
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .where(and(eq(evaluations.labId, labId), inArray(evaluations.status, statuses)))
    .orderBy(asc(evaluations.updatedAt));

  const now = Date.now();
  return rows
    .filter((row) => {
      // A tester only sees their own assignments; a reviewer sees the lab's
      // whole queue for their tier, since any holder of that role may decide.
      if (pendingTier(toEvaluationStatus(row.status)) !== null) return true;
      return row.assignedTesterId === userId;
    })
    .map((row) => {
      const ageHours = (now - row.updatedAt.getTime()) / 3_600_000;
      const tier = pendingTier(toEvaluationStatus(row.status));
      return {
        evaluationId: row.evaluationId,
        refNo: row.refNo,
        status: row.status,
        modelName: row.modelName,
        manufacturerName: row.manufacturerName,
        overallVerdict: row.overallVerdict,
        ageHours: Math.floor(ageHours),
        overdue: tier !== null && ageHours > slaHours,
        href:
          tier !== null
            ? `/evaluations/${row.evaluationId}/review`
            : `/evaluations/${row.evaluationId}`,
      };
    });
}

/** The notification bell's unread list, newest first. */
export async function listMyNotifications(userId: string, limit = 20) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      payload: notifications.payload,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/** Unread count, for the bell's badge — a `count(*)`, never a fetch-and-length. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.total ?? 0;
}

/** KPI counts for the dashboard strip, scoped to one lab (§7.5 "Dashboard"). */
export async function countEvaluationsByStatus(labId: string) {
  const rows = await db
    .select({ status: evaluations.status, total: count() })
    .from(evaluations)
    .where(eq(evaluations.labId, labId))
    .groupBy(evaluations.status);
  return new Map(rows.map((row) => [row.status, Number(row.total)]));
}

/** How many pending-review evaluations in this lab are past their SLA target. */
export async function countOverdueReviews(labId: string, slaHours: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.labId, labId),
        inArray(evaluations.status, ['PENDING_T1', 'PENDING_T2', 'PENDING_T3']),
        sql`${evaluations.updatedAt} < now() - make_interval(hours => ${slaHours})`,
      ),
    );
  return row?.total ?? 0;
}
