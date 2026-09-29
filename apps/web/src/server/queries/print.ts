/**
 * Reads for the print route (implementation.md §8.2). Deliberately not
 * lab-scoped like every other query (§11) — this route's authorization is
 * the short-lived print token, checked before any of these run, not lab
 * membership (the worker rendering a PDF has no session to be a member
 * with). Every read here is by `report_version_id`, i.e. one immutable
 * snapshot, never a live table that could have moved on since sealing
 * (implementation.md's P8 kickoff: "never query live tables while
 * rendering").
 */
import { approvals, reports, reportVersions, user as userTable } from '@tula/db';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/server/db';

export async function getPrintReportVersion(reportVersionId: string) {
  const [row] = await db
    .select({ report: reports, version: reportVersions })
    .from(reportVersions)
    .innerJoin(reports, eq(reportVersions.reportId, reports.id))
    .where(eq(reportVersions.id, reportVersionId));
  return row ?? null;
}

export async function getPrintSignatories(reportVersionId: string) {
  const rows = await db
    .select({
      tier: approvals.tier,
      decidedAt: approvals.decidedAt,
      userName: userTable.name,
      userDesignation: userTable.designation,
    })
    .from(approvals)
    .innerJoin(userTable, eq(approvals.userId, userTable.id))
    .where(and(eq(approvals.reportVersionId, reportVersionId), eq(approvals.decision, 'APPROVED')));
  return rows.filter((r) => r.tier === 1 || r.tier === 2 || r.tier === 3) as {
    tier: 1 | 2 | 3;
    decidedAt: Date;
    userName: string;
    userDesignation: string | null;
  }[];
}

export async function getPrintVersionHistory(reportId: string) {
  return db
    .select({
      version: reportVersions.version,
      status: reportVersions.status,
      changeSummary: reportVersions.changeSummary,
    })
    .from(reportVersions)
    .where(eq(reportVersions.reportId, reportId))
    .orderBy(asc(reportVersions.createdAt));
}
