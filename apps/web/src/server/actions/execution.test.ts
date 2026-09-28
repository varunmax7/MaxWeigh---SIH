import {
  applicants,
  attachments,
  evaluations,
  evaluationTests,
  instrumentModels,
  manufacturers,
  referenceWeightSets,
  user as userTable,
} from '@tula/db';
import type { InstrumentMetrology } from '@tula/engine';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '@/server/session';
import { db, sql } from '../db.js';

// A real TESTING_OFFICER session (test.execute) — see the same rationale as
// masterdata.test.ts and evaluations.test.ts: exercises permission checks,
// lab-membership checks, the real engine, and the real audit ledger.
vi.mock('@/server/session', () => ({ getSession: vi.fn() }));

const { getSession } = await import('@/server/session');
const { startTestAction, saveObservationsAction, completeTestAction, reopenTestAction } =
  await import('./execution.js');
const { saveDraftEvaluationAction, submitEvaluationAction } = await import('./evaluations.js');
const { createReferenceWeightSetAction } = await import('./masterdata.js');

let labId: string;
const createdManufacturerIds: string[] = [];
const createdApplicantIds: string[] = [];
const createdInstrumentModelIds: string[] = [];
const createdEvaluationIds: string[] = [];
const createdWeightSetIds: string[] = [];

/** Class III, Max 30 kg, e = d = 5 g, 4 supports — the §4.5/§4.7 golden fixture. */
const goldenSpec: InstrumentMetrology = {
  accuracyClass: 'III',
  kind: 'single',
  ranges: [{ max: '30000', e: '5', d: '5' }],
  min: '100',
  tempRange: { lowC: -10, highC: 40 },
  isElectronic: true,
  hasTareDevice: false,
  hasZeroTracking: false,
  loadReceptor: { kind: 'platform', supports: 4 },
  levelIndicator: true,
  tiltSusceptible: false,
  powerSupply: { mains: { vNom: 230, fNomHz: 50 } },
  displayUnit: 'g',
};
const goldenSpecJson = goldenSpec as unknown as Record<string, unknown>;

const envSample = {
  tempC: 22.3,
  rhPct: 54,
  source: 'manual' as const,
  ts: new Date().toISOString(),
};

async function setSession(email: string, role: AppSession['user']['role']) {
  const [user] = await db
    .select({ id: userTable.id, email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, email));
  if (!user) throw new Error(`seed data missing: ${email} not found`);
  const session: AppSession = {
    session: {} as AppSession['session'],
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      designation: null,
      employeeId: null,
      isActive: true,
      twoFactorEnabled: false,
    },
  };
  vi.mocked(getSession).mockResolvedValue(session);
  return user.id;
}

/** Plans a fresh evaluation for the golden instrument, returning its id and its WEIGHING test row id. */
async function planGoldenEvaluation(suffix: string) {
  const [mfr] = await db
    .insert(manufacturers)
    .values({ name: `Exec QA Manufacturer ${suffix}` })
    .returning({ id: manufacturers.id });
  if (!mfr) throw new Error('setup insert failed');
  createdManufacturerIds.push(mfr.id);

  const [applicant] = await db
    .insert(applicants)
    .values({ name: `Exec QA Applicant ${suffix}` })
    .returning({ id: applicants.id });
  if (!applicant) throw new Error('setup insert failed');
  createdApplicantIds.push(applicant.id);

  const [model] = await db
    .insert(instrumentModels)
    .values({
      manufacturerId: mfr.id,
      modelName: `Exec QA Model ${suffix}`,
      instrumentType: 'bench',
      defaultSpec: goldenSpecJson,
    })
    .returning({ id: instrumentModels.id });
  if (!model) throw new Error('setup insert failed');
  createdInstrumentModelIds.push(model.id);

  const draftResult = await saveDraftEvaluationAction({
    labId,
    applicantId: applicant.id,
    manufacturerId: mfr.id,
    modelId: model.id,
    sampleSerials: [],
    defaultSpec: goldenSpec,
  });
  if (!draftResult.ok) throw new Error('draft creation failed');
  createdEvaluationIds.push(draftResult.data.id);

  const submitResult = await submitEvaluationAction({
    draftId: draftResult.data.id,
    testOverrides: [],
  });
  if (!submitResult.ok) throw new Error('submit failed');

  const rows = await db
    .select()
    .from(evaluationTests)
    .where(
      and(
        eq(evaluationTests.evaluationId, draftResult.data.id),
        eq(evaluationTests.testCode, 'WEIGHING'),
      ),
    );
  const weighingTest = rows[0];
  if (!weighingTest) throw new Error('WEIGHING test row not planned');

  return { evaluationId: draftResult.data.id, testId: weighingTest.id };
}

beforeAll(async () => {
  const { labs } = await import('@tula/db');
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;
});

afterAll(async () => {
  for (const id of createdEvaluationIds) {
    await db.delete(attachments).where(eq(attachments.evaluationId, id));
    await db.delete(evaluationTests).where(eq(evaluationTests.evaluationId, id));
    await db.delete(evaluations).where(eq(evaluations.id, id));
  }
  for (const id of createdInstrumentModelIds) {
    await db.delete(instrumentModels).where(eq(instrumentModels.id, id));
  }
  for (const id of createdApplicantIds) {
    await db.delete(applicants).where(eq(applicants.id, id));
  }
  for (const id of createdManufacturerIds) {
    await db.delete(manufacturers).where(eq(manufacturers.id, id));
  }
  for (const id of createdWeightSetIds) {
    await db.delete(referenceWeightSets).where(eq(referenceWeightSets.id, id));
  }
  await sql.end();
});

describe('test execution — golden WEIGHING fixture (implementation.md §4.5)', () => {
  it('startTest → saveObservations reproduces the golden PASS/PASS/FAIL rows and persists the engine verdict', async () => {
    await setSession('intake.officer@tula.test', 'INTAKE_OFFICER');
    const { testId } = await planGoldenEvaluation('golden-1');

    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    const startResult = await startTestAction({ testId });
    expect(startResult.ok).toBe(true);

    const [started] = await db.select().from(evaluationTests).where(eq(evaluationTests.id, testId));
    expect(started?.status).toBe('IN_PROGRESS');
    if (!started) throw new Error('test row missing after start');

    const [evaluation] = await db
      .select({ status: evaluations.status })
      .from(evaluations)
      .where(eq(evaluations.id, started.evaluationId));
    expect(evaluation?.status).toBe('IN_TESTING');

    // A load row filled in before the required zero-ref row — the exact
    // shape autosave sends mid-typing if the tester works out of order.
    // Must fail gracefully (RULE), never throw a raw ZodError server-side.
    const incompleteResult = await saveObservationsAction({
      testId,
      observations: {
        zeroRef: { L: '50', I: '', deltaL: '' },
        ascending: [{ rowId: 'r1', L: '10000', I: '10000', deltaL: '1.5' }],
        descending: [],
      },
      rowVersion: started.rowVersion,
    });
    expect(incompleteResult).toEqual({ ok: false, code: 'RULE' });

    // The exact §4.5 golden worked example: zero ref E0 = -0.5 g; 10 kg and
    // 30 kg PASS (Ec = +1.5 g ≤ 5.0 g, +7.5 g ≤ 7.5 g inclusive boundary);
    // 2.5 kg FAILs (Ec = +3.5 g > 2.5 g).
    const observations = {
      zeroRef: { L: '50', I: '50', deltaL: '3.0' },
      ascending: [
        { rowId: 'r1', L: '10000', I: '10000', deltaL: '1.5' },
        { rowId: 'r2', L: '30000', I: '30005', deltaL: '0.5' },
        { rowId: 'r3', L: '2500', I: '2505', deltaL: '4.5' },
      ],
      descending: [],
    };

    const saveResult = await saveObservationsAction({
      testId,
      observations,
      envStart: envSample,
      rowVersion: started?.rowVersion ?? 0,
    });
    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) return;
    expect(saveResult.data.verdict).toBe('FAIL');

    const [saved] = await db.select().from(evaluationTests).where(eq(evaluationTests.id, testId));
    expect(saved?.verdict).toBe('FAIL');
    const result = saved?.result as {
      rows: { rowId: string; Ec: string; verdict: string }[];
      engineVersion: string;
      rulepack: { id: string; version: string };
    };
    const byRow = new Map(result.rows.map((r) => [r.rowId, r]));
    expect(byRow.get('asc-r1')?.Ec).toBe('1.5');
    expect(byRow.get('asc-r1')?.verdict).toBe('PASS');
    expect(byRow.get('asc-r2')?.Ec).toBe('7.5');
    expect(byRow.get('asc-r2')?.verdict).toBe('PASS');
    expect(byRow.get('asc-r3')?.Ec).toBe('3.5');
    expect(byRow.get('asc-r3')?.verdict).toBe('FAIL');
    expect(result.engineVersion).toBeTruthy();
    expect(result.rulepack).toEqual({ id: 'oiml-r76-1-2006', version: '1.0.0' });

    const observations2 = saved?.observations as Record<string, unknown>;
    expect(observations2.schemaVersion).toBe(1);
  });

  it('rejects saveObservations with a stale row_version (optimistic concurrency)', async () => {
    await setSession('intake.officer@tula.test', 'INTAKE_OFFICER');
    const { testId } = await planGoldenEvaluation('golden-2');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    await startTestAction({ testId });

    const result = await saveObservationsAction({
      testId,
      observations: {
        zeroRef: { L: '50', I: '50', deltaL: '3.0' },
        ascending: [],
        descending: [],
      },
      rowVersion: 9999,
    });
    expect(result).toEqual({ ok: false, code: 'CONFLICT' });
  });

  it('completeTestAction blocks with specific reasons until every guard clears, then succeeds', async () => {
    await setSession('intake.officer@tula.test', 'INTAKE_OFFICER');
    const { testId } = await planGoldenEvaluation('golden-3');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    await startTestAction({ testId });

    // No observations yet — blocked.
    const [beforeAny] = await db
      .select()
      .from(evaluationTests)
      .where(eq(evaluationTests.id, testId));
    const blockedNoObs = await completeTestAction({
      testId,
      rowVersion: beforeAny?.rowVersion ?? 0,
    });
    expect(blockedNoObs).toEqual({ ok: false, code: 'RULE' });

    // A fully-PASSing observation, but missing env conditions and standards.
    const passingObservations = {
      zeroRef: { L: '50', I: '50', deltaL: '3.0' },
      ascending: [{ rowId: 'r1', L: '10000', I: '10000', deltaL: '1.5' }],
      descending: [],
    };
    const save1 = await saveObservationsAction({
      testId,
      observations: passingObservations,
      rowVersion: beforeAny?.rowVersion ?? 0,
    });
    expect(save1.ok).toBe(true);
    if (!save1.ok) return;

    const blockedNoEnv = await completeTestAction({ testId, rowVersion: save1.data.rowVersion });
    expect(blockedNoEnv).toEqual({ ok: false, code: 'RULE' });

    // Add env + an adequate F2 weight set (10 kg load; F2 10kg = 160 mg per
    // the §4.8 R111 table — comfortably under mpe(10kg)/3 for class III).
    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    const weightSetResult = await createReferenceWeightSetAction({
      labId,
      setCode: `EXEC-QA-WS-${Date.now()}`,
      oimlClass: 'F2',
      items: [{ id: 'w1', nominalG: '10000' }],
    });
    expect(weightSetResult.ok).toBe(true);
    if (!weightSetResult.ok) return;
    createdWeightSetIds.push(weightSetResult.data.id);

    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    const save2 = await saveObservationsAction({
      testId,
      observations: passingObservations,
      envStart: envSample,
      envEnd: { ...envSample, tempC: 22.5 },
      weightSetIds: [weightSetResult.data.id],
      rowVersion: save1.data.rowVersion,
    });
    expect(save2.ok).toBe(true);
    if (!save2.ok) return;

    const completeResult = await completeTestAction({
      testId,
      rowVersion: save2.data.rowVersion,
    });
    expect(completeResult.ok).toBe(true);

    const [completed] = await db
      .select()
      .from(evaluationTests)
      .where(eq(evaluationTests.id, testId));
    expect(completed?.status).toBe('COMPLETED');
    expect(completed?.completedBy).toBeTruthy();
    expect(completed?.completedAt).toBeTruthy();

    // Reopening requires test.reopen — TESTING_OFFICER doesn't hold it.
    const forbiddenReopen = await reopenTestAction({
      testId,
      reason: 'Should be forbidden for this role.',
    });
    expect(forbiddenReopen).toEqual({ ok: false, code: 'FORBIDDEN' });

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    const reopenResult = await reopenTestAction({
      testId,
      reason: 'Re-checking the 10 kg reading after a calibration query.',
    });
    expect(reopenResult.ok).toBe(true);

    const [reopened] = await db
      .select()
      .from(evaluationTests)
      .where(eq(evaluationTests.id, testId));
    expect(reopened?.status).toBe('REOPENED');
  });
});
