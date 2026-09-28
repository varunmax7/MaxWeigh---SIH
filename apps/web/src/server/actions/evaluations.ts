'use server';

import {
  allocateNumber,
  evaluations,
  evaluationTests,
  labs,
  type NumberSequenceKind,
} from '@tula/db';
import {
  ENGINE_VERSION,
  type InstrumentMetrology,
  planCreep,
  planDiscrimination,
  planEccentricity,
  planRepeatability,
  planTemperatureSequence,
  planTests,
  planWeighingLoads,
  type Rulepack,
} from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import {
  evaluationCancelInputSchema,
  evaluationDraftInputSchema,
  evaluationSubmitInputSchema,
  instrumentMetrologySchema,
} from '@tula/schemas';
import { eq, sql } from 'drizzle-orm';
import { ActionError, action } from '@/server/action';
import { getInstrumentModel } from '@/server/queries/masterdata';
import { getSession } from '@/server/session';
import { assertSpecClassifies } from '@/server/spec-validation';

const EVAL_SEQUENCE_KIND: NumberSequenceKind = 'EVAL';

/**
 * A read, not a mutation — no `action()` wrapper (that requires a
 * `permission` and always writes an audit entry, neither of which applies
 * to "the wizard's step 2 needs this model's spec to prefill step 3").
 * Every signed-in user can already read instrument models (§10 P4); this
 * only exists because a Client Component cannot call a query function
 * directly (`server/queries/*` import `@tula/db`).
 */
export async function getInstrumentModelSpecAction(modelId: string) {
  const session = await getSession();
  if (!session) return null;
  const model = await getInstrumentModel(modelId);
  return model?.defaultSpec ?? null;
}

/**
 * Create-or-update a DRAFT evaluation (implementation.md §10 P5: "DRAFT
 * autosave, resume draft"). Called once the wizard's step 3 spec classifies
 * cleanly — `evaluations` has no nullable column a bare "started the wizard"
 * row could satisfy before that point (applicant/manufacturer/model/spec are
 * all NOT NULL), so there is nothing earlier to autosave. A reference number
 * is allocated the first time (step 4/5 changes update the same row instead
 * of minting a second one).
 */
export const saveDraftEvaluationAction = action(
  {
    schema: evaluationDraftInputSchema,
    permission: 'evaluation.create',
    audit: {
      action: 'evaluation.save_draft',
      entityType: 'evaluation',
      entityId: (i) => i.id ?? null,
      labId: (i) => i.labId,
      diff: (_input, result) => ({ id: (result as { id: string }).id }),
    },
  },
  async (input, { tx, assertLabAccess, session }) => {
    await assertLabAccess(input.labId);
    assertSpecClassifies(input.defaultSpec);

    if (input.id) {
      const [existing] = await tx
        .select({ status: evaluations.status, labId: evaluations.labId })
        .from(evaluations)
        .where(eq(evaluations.id, input.id));
      if (!existing) throw new ActionError('NOT_FOUND', 'Draft not found.');
      if (existing.labId !== input.labId) throw new ActionError('FORBIDDEN', 'Wrong lab.');
      if (existing.status !== 'DRAFT') {
        throw new ActionError('CONFLICT', 'This evaluation is no longer a draft.');
      }

      await tx
        .update(evaluations)
        .set({
          applicantId: input.applicantId,
          manufacturerId: input.manufacturerId,
          modelId: input.modelId,
          sampleSerials: input.sampleSerials,
          specSnapshot: input.defaultSpec,
          updatedAt: new Date(),
          rowVersion: sql`${evaluations.rowVersion} + 1`,
        })
        .where(eq(evaluations.id, input.id));
      return { id: input.id };
    }

    const [lab] = await tx.select({ code: labs.code }).from(labs).where(eq(labs.id, input.labId));
    if (!lab) throw new ActionError('NOT_FOUND', 'Lab not found.');

    const year = new Date().getFullYear();
    const seq = await allocateNumber(tx, input.labId, year, EVAL_SEQUENCE_KIND);
    const refNo = `EV-${lab.code}-${year}-${String(seq).padStart(4, '0')}`;

    const [row] = await tx
      .insert(evaluations)
      .values({
        refNo,
        labId: input.labId,
        applicantId: input.applicantId,
        manufacturerId: input.manufacturerId,
        modelId: input.modelId,
        sampleSerials: input.sampleSerials,
        specSnapshot: input.defaultSpec,
        rulepackId: OIML_R76_1_2006.id,
        rulepackVersion: OIML_R76_1_2006.version,
        engineVersion: ENGINE_VERSION,
        status: 'DRAFT',
        createdBy: session.user.id,
      })
      .returning({ id: evaluations.id, refNo: evaluations.refNo });
    if (!row) throw new Error('evaluations insert returned no row');
    return row;
  },
);

/** Params for the test codes with a dedicated planner (implementation.md §4.7); everything else plans nothing. */
function plannedParamsFor(
  code: string,
  spec: InstrumentMetrology,
  rulepack: Rulepack,
): Record<string, unknown> | null {
  switch (code) {
    case 'ECCENTRICITY': {
      const p = planEccentricity(spec);
      return { load: p.load, positions: p.positions };
    }
    case 'REPEATABILITY': {
      const p = planRepeatability(spec, rulepack);
      return { loads: p.loads, readingsPerSeries: p.readingsPerSeries };
    }
    case 'DISCRIMINATION': {
      const p = planDiscrimination(spec, rulepack);
      return { loads: p.loads, extraLoad: p.extraLoad };
    }
    case 'CREEP': {
      const p = planCreep(spec, rulepack);
      return { load: p.load, scheduleMin: p.scheduleMin };
    }
    // TEMP_NO_LOAD reuses TEMP_STATIC's readings (implementation.md §4.6).
    case 'TEMP_STATIC':
    case 'TEMP_NO_LOAD': {
      const p = planTemperatureSequence(spec);
      return { sequenceC: p.sequenceC };
    }
    default:
      return null;
  }
}

/**
 * One `evaluation_tests` row per planned WEIGHING range (it is the only
 * per-range test — implementation.md §4.7) plus a zero-ref/ascending/
 * descending `params` payload.
 */
function buildWeighingRows(
  evaluationId: string,
  sequence: number,
  spec: InstrumentMetrology,
  rulepack: Rulepack,
  naReason: string | undefined,
): (typeof evaluationTests.$inferInsert)[] {
  return planWeighingLoads(spec, rulepack).map((range) => ({
    evaluationId,
    testCode: 'WEIGHING',
    rangeIndex: range.rangeIndex,
    sequence,
    applicability: naReason ? ('NOT_APPLICABLE' as const) : ('APPLICABLE' as const),
    naReason: naReason ?? null,
    params: { zeroRef: range.zeroRef, ascending: range.ascending, descending: range.descending },
  }));
}

/** Builds every `evaluation_tests` row for a freshly-planned evaluation. */
function buildEvaluationTestRows(
  evaluationId: string,
  spec: InstrumentMetrology,
  rulepack: Rulepack,
  naReasonByCode: Map<string, string>,
): (typeof evaluationTests.$inferInsert)[] {
  const rows: (typeof evaluationTests.$inferInsert)[] = [];

  for (const test of planTests(spec, rulepack)) {
    const override = naReasonByCode.get(test.code);

    if (test.code === 'WEIGHING' && test.applicable) {
      rows.push(...buildWeighingRows(evaluationId, test.sequence, spec, rulepack, override));
      continue;
    }

    rows.push({
      evaluationId,
      testCode: test.code,
      rangeIndex: 0,
      sequence: test.sequence,
      applicability: test.applicable && !override ? 'APPLICABLE' : 'NOT_APPLICABLE',
      naReason: !test.applicable ? test.reason : (override ?? null),
      params: test.applicable ? plannedParamsFor(test.code, spec, rulepack) : null,
    });
  }

  return rows;
}

/**
 * Generates the test plan and transitions a DRAFT evaluation to PLANNED
 * (implementation.md §6.3: "DRAFT --> PLANNED: spec valid, plan generated,
 * tester assigned"; §10 P5: "run planTests(), insert evaluation_tests with
 * params, applicability and reasons").
 */
export const submitEvaluationAction = action(
  {
    schema: evaluationSubmitInputSchema,
    permission: 'evaluation.create',
    audit: {
      action: 'evaluation.submit_plan',
      entityType: 'evaluation',
      entityId: (i) => i.draftId,
      diff: (input) => ({ testOverrideCount: input.testOverrides.length }),
    },
  },
  async (input, { tx, assertLabAccess }) => {
    const [draft] = await tx.select().from(evaluations).where(eq(evaluations.id, input.draftId));
    if (!draft) throw new ActionError('NOT_FOUND', 'Draft not found.');
    if (draft.status !== 'DRAFT') {
      throw new ActionError('CONFLICT', 'This evaluation has already been planned.');
    }
    await assertLabAccess(draft.labId);

    // `specSnapshot` is jsonb — re-parsed here rather than cast, since
    // Postgres does not enforce our TS shape on data read back out of it.
    const spec = instrumentMetrologySchema.parse(draft.specSnapshot);
    assertSpecClassifies(spec);

    const rulepack = OIML_R76_1_2006;
    const naReasonByCode = new Map(input.testOverrides.map((o) => [o.code, o.naReason]));
    const rows = buildEvaluationTestRows(draft.id, spec, rulepack, naReasonByCode);

    // Idempotent: re-running submit on the same draft (e.g. a retried
    // request) replaces the plan rather than duplicating them, since the
    // UNIQUE (evaluation_id, test_code, range_index) constraint would
    // otherwise reject the second attempt outright.
    await tx.delete(evaluationTests).where(eq(evaluationTests.evaluationId, draft.id));
    await tx.insert(evaluationTests).values(rows);

    await tx
      .update(evaluations)
      .set({
        status: 'PLANNED',
        assignedTesterId: input.assignedTesterId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        priority: input.priority,
        updatedAt: new Date(),
        rowVersion: sql`${evaluations.rowVersion} + 1`,
      })
      .where(eq(evaluations.id, draft.id));

    return { id: draft.id, refNo: draft.refNo };
  },
);

/** DRAFT or PLANNED → CANCELLED (implementation.md §6.3). */
export const cancelEvaluationAction = action(
  {
    schema: evaluationCancelInputSchema,
    permission: 'evaluation.create',
    audit: {
      action: 'evaluation.cancel',
      entityType: 'evaluation',
      entityId: (i) => i.id,
      diff: (i) => ({ reason: i.reason }),
    },
  },
  async ({ id }, { tx, assertLabAccess }) => {
    const [row] = await tx
      .select({ labId: evaluations.labId, status: evaluations.status })
      .from(evaluations)
      .where(eq(evaluations.id, id));
    if (!row) throw new ActionError('NOT_FOUND', 'Evaluation not found.');
    await assertLabAccess(row.labId);
    if (row.status !== 'DRAFT' && row.status !== 'PLANNED') {
      throw new ActionError('CONFLICT', 'Only draft or planned evaluations can be cancelled.');
    }

    await tx
      .update(evaluations)
      .set({
        status: 'CANCELLED',
        updatedAt: new Date(),
        rowVersion: sql`${evaluations.rowVersion} + 1`,
      })
      .where(eq(evaluations.id, id));
    return { id };
  },
);
