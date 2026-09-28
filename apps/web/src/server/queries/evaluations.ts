/**
 * Read queries for evaluations (implementation.md §5, §7.5, §10 P5). Every
 * query is scoped to a `labId` argument, matching §11's "every read query is
 * scoped to the user's labs" — the caller supplies it from
 * `server/active-lab.ts`, per docs/QUESTIONS.md #23.
 */
import {
  applicants,
  auditLog,
  evaluations,
  evaluationTests,
  instrumentModels,
  labMembers,
  manufacturers,
  user as userTable,
} from '@tula/db';
import { and, asc, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/server/db';

export interface EvaluationFilters {
  status?: string;
  accuracyClass?: string;
  testerId?: string;
  verdict?: string;
  createdFrom?: string;
  createdTo?: string;
  /** Due before now and not yet in a terminal state. */
  overdue?: boolean;
  page: number;
  pageSize: number;
}

const OPEN_STATUSES_FOR_OVERDUE = [
  'PLANNED',
  'IN_TESTING',
  'PENDING_T1',
  'PENDING_T2',
  'PENDING_T3',
  'RETURNED',
  'AMENDING',
];

const evaluationListColumns = {
  id: evaluations.id,
  refNo: evaluations.refNo,
  status: evaluations.status,
  priority: evaluations.priority,
  overallVerdict: evaluations.overallVerdict,
  accuracyClass: sql<string>`${evaluations.specSnapshot}->>'accuracyClass'`,
  modelName: instrumentModels.modelName,
  manufacturerName: manufacturers.name,
  applicantName: applicants.name,
  assignedTesterId: evaluations.assignedTesterId,
  assignedTesterName: userTable.name,
  dueAt: evaluations.dueAt,
  createdAt: evaluations.createdAt,
};

function evaluationFilterConditions(labId: string, filters: EvaluationFilters) {
  const conditions = [eq(evaluations.labId, labId)];
  if (filters.status) conditions.push(eq(evaluations.status, filters.status));
  if (filters.testerId) conditions.push(eq(evaluations.assignedTesterId, filters.testerId));
  if (filters.verdict) conditions.push(eq(evaluations.overallVerdict, filters.verdict));
  if (filters.accuracyClass) {
    conditions.push(sql`${evaluations.specSnapshot}->>'accuracyClass' = ${filters.accuracyClass}`);
  }
  if (filters.createdFrom)
    conditions.push(gte(evaluations.createdAt, new Date(filters.createdFrom)));
  if (filters.createdTo) conditions.push(lte(evaluations.createdAt, new Date(filters.createdTo)));
  if (filters.overdue) {
    conditions.push(
      lte(evaluations.dueAt, new Date()),
      sql`${evaluations.status} in (${sql.join(
        OPEN_STATUSES_FOR_OVERDUE.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }
  return and(...conditions);
}

/** Paginated, filtered evaluations list (implementation.md §7.5 "Evaluations list"). */
export async function listEvaluations(labId: string, filters: EvaluationFilters) {
  const where = evaluationFilterConditions(labId, filters);

  const [rows, totalRows] = await Promise.all([
    db
      .select(evaluationListColumns)
      .from(evaluations)
      .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
      .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
      .innerJoin(applicants, eq(evaluations.applicantId, applicants.id))
      .leftJoin(userTable, eq(evaluations.assignedTesterId, userTable.id))
      .where(where)
      .orderBy(desc(evaluations.createdAt))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db.select({ total: count() }).from(evaluations).where(where),
  ]);

  return { rows, total: totalRows[0]?.total ?? 0 };
}

/** Lab members who can execute tests — candidates for the wizard's assignment step. */
export async function listTesters(labId: string) {
  return db
    .select({ id: userTable.id, name: userTable.name, role: userTable.role })
    .from(labMembers)
    .innerJoin(userTable, eq(labMembers.userId, userTable.id))
    .where(
      and(
        eq(labMembers.labId, labId),
        sql`${userTable.role} in ('TESTING_OFFICER', 'SENIOR_TESTING_OFFICER')`,
      ),
    )
    .orderBy(asc(userTable.name));
}

/** A DRAFT evaluation, for the wizard's "resume draft" flow. */
export async function getEvaluationDraft(id: string) {
  const [row] = await db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.id, id), eq(evaluations.status, 'DRAFT')));
  return row ?? null;
}

/** Full evaluation overview: the row plus joined model/manufacturer/applicant/tester names. */
export async function getEvaluationOverview(id: string) {
  const [row] = await db
    .select({
      ...evaluationListColumns,
      labId: evaluations.labId,
      applicantId: evaluations.applicantId,
      manufacturerId: evaluations.manufacturerId,
      modelId: evaluations.modelId,
      sampleSerials: evaluations.sampleSerials,
      specSnapshot: evaluations.specSnapshot,
      rulepackId: evaluations.rulepackId,
      rulepackVersion: evaluations.rulepackVersion,
      engineVersion: evaluations.engineVersion,
      createdBy: evaluations.createdBy,
      submittedAt: evaluations.submittedAt,
      issuedAt: evaluations.issuedAt,
    })
    .from(evaluations)
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .innerJoin(applicants, eq(evaluations.applicantId, applicants.id))
    .leftJoin(userTable, eq(evaluations.assignedTesterId, userTable.id))
    .where(eq(evaluations.id, id));
  return row ?? null;
}

/** Test-plan rows for the Test plan tab, in planned sequence order. */
export async function listEvaluationTests(evaluationId: string) {
  return db
    .select()
    .from(evaluationTests)
    .where(eq(evaluationTests.evaluationId, evaluationId))
    .orderBy(asc(evaluationTests.sequence), asc(evaluationTests.rangeIndex));
}

/** Audit entries for the History tab (implementation.md §7.5: "History (audit entries for this evaluation)"). */
export async function listEvaluationHistory(evaluationId: string) {
  return db
    .select({
      id: auditLog.id,
      ts: auditLog.ts,
      actorId: auditLog.actorId,
      actorRole: auditLog.actorRole,
      action: auditLog.action,
      diff: auditLog.diff,
    })
    .from(auditLog)
    .where(and(eq(auditLog.entityType, 'evaluation'), eq(auditLog.entityId, evaluationId)))
    .orderBy(desc(auditLog.ts));
}
