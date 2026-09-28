/**
 * Read queries for the test execution workspace (implementation.md §5, §7.5,
 * §10 P6). Scoped to a `labId` where the caller can supply one; a single
 * test's context is scoped implicitly through its evaluation's `lab_id`
 * (checked by the caller via `assertLabAccess`, same as every other action).
 */
import {
  applicants,
  attachments,
  evaluations,
  evaluationTests,
  instrumentModels,
  manufacturers,
  user as userTable,
} from '@tula/db';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db';

/** Everything the execution page needs for one test: the row, its evaluation, and the instrument spec. */
export async function getTestExecutionContext(testId: string) {
  const [row] = await db
    .select({
      test: evaluationTests,
      evaluation: {
        id: evaluations.id,
        refNo: evaluations.refNo,
        labId: evaluations.labId,
        status: evaluations.status,
        specSnapshot: evaluations.specSnapshot,
        rulepackId: evaluations.rulepackId,
        rulepackVersion: evaluations.rulepackVersion,
        assignedTesterId: evaluations.assignedTesterId,
      },
      modelName: instrumentModels.modelName,
      manufacturerName: manufacturers.name,
    })
    .from(evaluationTests)
    .innerJoin(evaluations, eq(evaluationTests.evaluationId, evaluations.id))
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .where(eq(evaluationTests.id, testId));
  return row ?? null;
}

/** Resolves the route's `(evaluationId, testCode, rangeIndex)` to a test id, for `getTestExecutionContext`. */
export async function findTestId(evaluationId: string, testCode: string, rangeIndex: number) {
  const [row] = await db
    .select({ id: evaluationTests.id })
    .from(evaluationTests)
    .where(
      and(
        eq(evaluationTests.evaluationId, evaluationId),
        eq(evaluationTests.testCode, testCode),
        eq(evaluationTests.rangeIndex, rangeIndex),
      ),
    );
  return row?.id ?? null;
}

/** The left-pane "test battery" — every planned test for this evaluation, in sequence order. */
export async function getTestBattery(evaluationId: string) {
  return db
    .select()
    .from(evaluationTests)
    .where(eq(evaluationTests.evaluationId, evaluationId))
    .orderBy(asc(evaluationTests.sequence), asc(evaluationTests.rangeIndex));
}

/** `/workspace` "My tests" (implementation.md §7.4): tests on evaluations assigned to `userId`, not yet completed. */
export async function listMyTests(userId: string) {
  return db
    .select({
      testId: evaluationTests.id,
      testCode: evaluationTests.testCode,
      rangeIndex: evaluationTests.rangeIndex,
      status: evaluationTests.status,
      verdict: evaluationTests.verdict,
      evaluationId: evaluations.id,
      refNo: evaluations.refNo,
      modelName: instrumentModels.modelName,
      manufacturerName: manufacturers.name,
      applicantName: applicants.name,
    })
    .from(evaluationTests)
    .innerJoin(evaluations, eq(evaluationTests.evaluationId, evaluations.id))
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .innerJoin(applicants, eq(evaluations.applicantId, applicants.id))
    .where(
      and(
        eq(evaluations.assignedTesterId, userId),
        eq(evaluationTests.applicability, 'APPLICABLE'),
        inArray(evaluationTests.status, ['PENDING', 'IN_PROGRESS', 'REOPENED']),
      ),
    )
    .orderBy(asc(evaluations.refNo), asc(evaluationTests.sequence));
}

/** Evidence (photos/documents) attached to a test, newest first. */
export async function listTestEvidence(testId: string) {
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.testId, testId))
    .orderBy(desc(attachments.uploadedAt));
}

/** Who completed a test, for the Inspector panel's byline. */
export async function getUserNames(userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(inArray(userTable.id, userIds));
}
