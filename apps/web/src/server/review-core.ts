/**
 * Shared loads and refusals for the review actions (implementation.md §6.3,
 * §10 P7). Kept out of the `'use server'` action modules so both
 * `actions/review.ts` (submit) and `actions/tier-decision.ts` (the three tier
 * decisions) use the same ones without either importing the other's actions.
 */
import {
  allocateNumber,
  comments,
  type DbTx,
  evaluations,
  evaluationTests,
  labs,
  reports,
  reportVersions,
} from '@tula/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { ActionError } from '@/server/action';
import { WorkflowError } from '@/server/workflow';

/** A `WorkflowError` is a business-rule refusal, which is exactly `action()`'s `RULE` code. */
export async function guard<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof WorkflowError) throw new ActionError('RULE', error.message);
    throw error;
  }
}

export async function loadEvaluation(tx: DbTx, evaluationId: string) {
  const [row] = await tx.select().from(evaluations).where(eq(evaluations.id, evaluationId));
  if (!row) throw new ActionError('NOT_FOUND', 'Evaluation not found.');
  return row;
}

export async function loadTests(tx: DbTx, evaluationId: string) {
  return tx.select().from(evaluationTests).where(eq(evaluationTests.evaluationId, evaluationId));
}

/** The shape `workflow.ts`'s SoD-1 and submit guards take. */
export function toTestSummaries(tests: Awaited<ReturnType<typeof loadTests>>) {
  return tests.map((t) => ({
    testCode: t.testCode,
    applicability: t.applicability,
    status: t.status,
    completedBy: t.completedBy,
  }));
}

/** The report row for an evaluation, minting its number on first submit (implementation.md §5 `number_sequences`). */
export async function findOrCreateReport(tx: DbTx, evaluationId: string, labId: string) {
  const [existing] = await tx.select().from(reports).where(eq(reports.evaluationId, evaluationId));
  if (existing) return existing;

  const [lab] = await tx
    .select({ code: labs.code, reportPrefix: labs.reportPrefix })
    .from(labs)
    .where(eq(labs.id, labId));
  if (!lab) throw new ActionError('NOT_FOUND', 'Lab not found.');

  const year = new Date().getFullYear();
  const seq = await allocateNumber(tx, labId, year, 'REPORT');
  const reportNo = `${lab.reportPrefix ?? 'TR'}-${lab.code}-${year}-${String(seq).padStart(4, '0')}`;

  const [created] = await tx.insert(reports).values({ evaluationId, reportNo }).returning();
  if (!created) throw new Error('reports insert returned no row');
  return created;
}

export async function latestVersion(tx: DbTx, reportId: string) {
  const [row] = await tx
    .select()
    .from(reportVersions)
    .where(eq(reportVersions.reportId, reportId))
    .orderBy(desc(reportVersions.createdAt))
    .limit(1);
  return row ?? null;
}

/** The report and its current version, or a refusal if there is nothing to review. */
export async function loadCurrentVersion(tx: DbTx, evaluationId: string) {
  const [report] = await tx.select().from(reports).where(eq(reports.evaluationId, evaluationId));
  if (!report?.currentVersionId) {
    throw new ActionError('NOT_FOUND', 'This evaluation has no report version to review.');
  }
  const [current] = await tx
    .select()
    .from(reportVersions)
    .where(eq(reportVersions.id, report.currentVersionId));
  if (!current) throw new ActionError('NOT_FOUND', 'Report version not found.');
  return { report, current };
}

/** The tests carrying at least one unresolved comment — the only ones a return unlocks (§6.3). */
export async function unresolvedCommentTestIds(tx: DbTx, evaluationId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ testId: comments.testId })
    .from(comments)
    .where(and(eq(comments.evaluationId, evaluationId), isNull(comments.resolvedAt)));
  return rows.flatMap((row) => (row.testId ? [row.testId] : []));
}
