'use server';

import { type DbTx, evaluations, evaluationTests, labMembers, referenceWeightSets } from '@tula/db';
import {
  evaluateTest,
  type InstrumentMetrology,
  type Rulepack,
  standardsAdequacy,
  type TestResult,
  type WeightPiece,
} from '@tula/engine';
import { OIML_R76_1_2006, OIML_R111_WEIGHTS } from '@tula/rulepacks';
import {
  completeTestInputSchema,
  instrumentMetrologySchema,
  isImplementedTestCode,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_SCHEMAS,
  reopenTestInputSchema,
  saveObservationsInputSchema,
  startTestInputSchema,
} from '@tula/schemas';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { type CompletionBlocker, computeFastCompletionBlockers } from '@/lib/completion-blockers';
import { ActionError, action } from '@/server/action';
import { db } from '@/server/db';
import { listTestEvidence } from '@/server/queries/execution';
import { getSession } from '@/server/session';
import { presignGetUrl } from '@/server/storage';

async function loadTestAndEvaluation(tx: DbTx, testId: string) {
  const [row] = await tx
    .select({ test: evaluationTests, evaluation: evaluations })
    .from(evaluationTests)
    .innerJoin(evaluations, eq(evaluationTests.evaluationId, evaluations.id))
    .where(eq(evaluationTests.id, testId));
  return row ?? null;
}

function checkRowVersion(actual: number, expected: number) {
  if (actual !== expected) {
    throw new ActionError(
      'CONFLICT',
      'Someone else changed this test. Reload to see their changes.',
    );
  }
}

/** `evaluation_tests.status` PENDING/REOPENED → IN_PROGRESS; also starts the evaluation's clock on its first test. */
export const startTestAction = action(
  {
    schema: startTestInputSchema,
    permission: 'test.execute',
    audit: {
      action: 'evaluation_test.start',
      entityType: 'evaluation_test',
      entityId: (i) => i.testId,
    },
  },
  async ({ testId }, { tx, assertLabAccess }) => {
    const row = await loadTestAndEvaluation(tx, testId);
    if (!row) throw new ActionError('NOT_FOUND', 'Test not found.');
    await assertLabAccess(row.evaluation.labId);

    if (row.test.status === 'PENDING' || row.test.status === 'REOPENED') {
      await tx
        .update(evaluationTests)
        .set({
          status: 'IN_PROGRESS',
          startedAt: row.test.startedAt ?? new Date(),
          rowVersion: sql`${evaluationTests.rowVersion} + 1`,
        })
        .where(eq(evaluationTests.id, testId));
    }

    if (row.evaluation.status === 'PLANNED') {
      await tx
        .update(evaluations)
        .set({ status: 'IN_TESTING' })
        .where(eq(evaluations.id, row.evaluation.id));
    }

    return { id: testId };
  },
);

/**
 * Validates `observations` against `OBSERVATION_SCHEMAS[testCode]`, runs the
 * engine, and persists the result (implementation.md §10 P6: "schema
 * validate → engine evaluate → persist result → coalesced audit diff"). The
 * audit diff records the resulting verdict only, not the raw observation
 * payload — autosave fires every 800 ms, and a full dump every tick would
 * flood the ledger with near-duplicate rows; see docs/QUESTIONS.md.
 */
export const saveObservationsAction = action(
  {
    schema: saveObservationsInputSchema,
    permission: 'test.execute',
    audit: {
      action: 'evaluation_test.save_observations',
      entityType: 'evaluation_test',
      entityId: (i) => i.testId,
      diff: (_input, result) => ({ verdict: (result as { verdict: string }).verdict }),
    },
  },
  async (input, { tx, assertLabAccess }) => {
    const row = await loadTestAndEvaluation(tx, input.testId);
    if (!row) throw new ActionError('NOT_FOUND', 'Test not found.');
    await assertLabAccess(row.evaluation.labId);

    if (row.test.status === 'COMPLETED') {
      throw new ActionError(
        'CONFLICT',
        'This test is complete — reopen it to change observations.',
      );
    }
    checkRowVersion(row.test.rowVersion, input.rowVersion);

    if (!isImplementedTestCode(row.test.testCode)) {
      throw new ActionError(
        'RULE',
        `No observation form is implemented for ${row.test.testCode} yet.`,
      );
    }
    // `safeParse`, not `parse`: autosave fires continuously while the
    // tester is still mid-entry (e.g. a load row filled in before the
    // required zero-ref row is), so an incomplete-but-in-progress payload
    // is an expected, routine case here — not a bug to crash the action
    // over. `ActionError`'s code type excludes `'VALIDATION'` (reserved for
    // `action()`'s own top-level schema check, which can't see this far
    // in), so this uses `'RULE'` — the client's autosave hook treats a
    // save-time `RULE` from *this* action as "not enough entered yet,
    // wait" rather than an error to retry or report (see
    // `useAutosave.ts`).
    const parseResult = OBSERVATION_SCHEMAS[row.test.testCode].safeParse(input.observations);
    if (!parseResult.success) {
      throw new ActionError('RULE', 'Observations are not complete enough to save yet.');
    }
    const parsedObs = parseResult.data;
    const spec = instrumentMetrologySchema.parse(row.evaluation.specSnapshot);
    const rulepack: Rulepack = OIML_R76_1_2006;

    const result = evaluateTest(row.test.testCode, parsedObs, { instrument: spec, rulepack });

    await tx
      .update(evaluationTests)
      .set({
        status: row.test.status === 'PENDING' ? 'IN_PROGRESS' : row.test.status,
        startedAt: row.test.startedAt ?? new Date(),
        observations: { schemaVersion: OBSERVATION_SCHEMA_VERSION, ...parsedObs },
        result: result as unknown as Record<string, unknown>,
        verdict: result.verdict,
        ...(input.envStart ? { envStart: input.envStart } : {}),
        ...(input.envEnd ? { envEnd: input.envEnd } : {}),
        ...(input.weightSetIds ? { weightSetIds: input.weightSetIds } : {}),
        rowVersion: sql`${evaluationTests.rowVersion} + 1`,
      })
      .where(eq(evaluationTests.id, input.testId));

    return { verdict: result.verdict, rowVersion: row.test.rowVersion + 1 };
  },
);

/** A load extracted from an already-validated observation, for the standards-adequacy completion guard. */
function loadsRequiringStandards(testCode: string, obs: unknown): string[] {
  if (testCode === 'WEIGHING') {
    const o = obs as { ascending: { L: string }[]; descending: { L: string }[] };
    return [...o.ascending, ...o.descending].map((r) => r.L);
  }
  if (testCode === 'ECCENTRICITY') {
    const o = obs as { positions: { L: string }[] };
    return o.positions.map((p) => p.L);
  }
  return [];
}

async function checkCompletionBlockers(
  tx: Parameters<typeof loadTestAndEvaluation>[0],
  test: typeof evaluationTests.$inferSelect,
  evaluation: typeof evaluations.$inferSelect,
): Promise<CompletionBlocker[]> {
  const blockers: CompletionBlocker[] = computeFastCompletionBlockers({
    testCode: test.testCode,
    result: test.result as unknown as TestResult | null,
    envStart: test.envStart,
    envEnd: test.envEnd,
  });
  if (!test.result) return blockers;

  const loads = isImplementedTestCode(test.testCode)
    ? loadsRequiringStandards(test.testCode, stripSchemaVersion(test.observations))
    : [];
  if (loads.length > 0) {
    if (!test.weightSetIds || test.weightSetIds.length === 0) {
      blockers.push({
        code: 'STANDARDS_MISSING',
        message: 'Select the reference weight set(s) used.',
      });
    } else {
      const sets = await tx
        .select()
        .from(referenceWeightSets)
        .where(inArray(referenceWeightSets.id, test.weightSetIds));
      const today = new Date().toISOString().slice(0, 10);
      const inactiveOrExpired = sets.some(
        (s) => s.status !== 'active' || (s.dueOn !== null && s.dueOn < today),
      );
      if (sets.length !== test.weightSetIds.length || inactiveOrExpired) {
        blockers.push({
          code: 'STANDARDS_INVALID',
          message: 'One of the selected weight sets is retired or expired.',
        });
      } else {
        const spec = instrumentMetrologySchema.parse(evaluation.specSnapshot);
        const pool: WeightPiece[] = sets.flatMap((s) =>
          (s.items as { nominalG: string }[]).map((item) => ({
            nominal: item.nominalG,
            weightClass: s.oimlClass as WeightPiece['weightClass'],
            calibrationExpiresAt: s.dueOn ?? undefined,
          })),
        );
        const inadequate = loads.some(
          (load) =>
            !standardsAdequacy(
              load,
              pool,
              spec as InstrumentMetrology,
              OIML_R76_1_2006,
              OIML_R111_WEIGHTS,
            ).adequate,
        );
        if (inadequate) {
          blockers.push({
            code: 'STANDARDS_INADEQUATE',
            message: 'The selected standards are not adequate for every load used.',
          });
        }
      }
    }
  }

  return blockers;
}

function stripSchemaVersion(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const { schemaVersion: _schemaVersion, ...rest } = raw as Record<string, unknown>;
  return rest;
}

/** `evaluation_tests.status` → COMPLETED, once every blocker in §10 P6's guard list is clear. */
export const completeTestAction = action(
  {
    schema: completeTestInputSchema,
    permission: 'test.execute',
    audit: {
      action: 'evaluation_test.complete',
      entityType: 'evaluation_test',
      entityId: (i) => i.testId,
    },
  },
  async ({ testId, rowVersion }, { tx, assertLabAccess, session }) => {
    const row = await loadTestAndEvaluation(tx, testId);
    if (!row) throw new ActionError('NOT_FOUND', 'Test not found.');
    await assertLabAccess(row.evaluation.labId);
    checkRowVersion(row.test.rowVersion, rowVersion);

    const blockers = await checkCompletionBlockers(tx, row.test, row.evaluation);
    if (blockers.length > 0) {
      throw new ActionError('RULE', blockers.map((b) => b.message).join(' '));
    }

    await tx
      .update(evaluationTests)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy: session.user.id,
        rowVersion: sql`${evaluationTests.rowVersion} + 1`,
      })
      .where(eq(evaluationTests.id, testId));

    return { id: testId };
  },
);

/** COMPLETED → REOPENED, with a reason on record (implementation.md §7.7: destructive actions require a typed reason). */
export const reopenTestAction = action(
  {
    schema: reopenTestInputSchema,
    permission: 'test.reopen',
    audit: {
      action: 'evaluation_test.reopen',
      entityType: 'evaluation_test',
      entityId: (i) => i.testId,
      diff: (i) => ({ reason: i.reason }),
    },
  },
  async ({ testId }, { tx, assertLabAccess }) => {
    const row = await loadTestAndEvaluation(tx, testId);
    if (!row) throw new ActionError('NOT_FOUND', 'Test not found.');
    await assertLabAccess(row.evaluation.labId);
    if (row.test.status !== 'COMPLETED') {
      throw new ActionError('CONFLICT', 'Only a completed test can be reopened.');
    }

    await tx
      .update(evaluationTests)
      .set({ status: 'REOPENED', rowVersion: sql`${evaluationTests.rowVersion} + 1` })
      .where(eq(evaluationTests.id, testId));

    return { id: testId };
  },
);

/**
 * A read, not a mutation — same rationale as `getInstrumentModelSpecAction`
 * (P5): no `action()` wrapper, since that always writes an audit entry, and
 * reading the evidence gallery isn't an event worth auditing. Presigned URLs
 * are issued only after the session/lab checks pass (implementation.md §9:
 * "issued only after permission check").
 */
export async function listTestEvidenceAction(testId: string) {
  const session = await getSession();
  if (!session) return [];

  const row = await loadTestAndEvaluation(db, testId);
  if (!row) return [];

  const [membership] = await db
    .select({ userId: labMembers.userId })
    .from(labMembers)
    .where(and(eq(labMembers.userId, session.user.id), eq(labMembers.labId, row.evaluation.labId)));
  if (!membership) return [];

  const evidence = await listTestEvidence(testId);
  return Promise.all(
    evidence.map(async (a) => ({
      id: a.id,
      filename: a.filename,
      caption: a.caption,
      mime: a.mime,
      uploadedAt: a.uploadedAt,
      url: await presignGetUrl(a.storageKey),
      thumbUrl: a.thumbKey ? await presignGetUrl(a.thumbKey) : null,
    })),
  );
}
