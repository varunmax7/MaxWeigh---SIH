import {
  applicants,
  evaluations,
  evaluationTests,
  instrumentModels,
  labs,
  manufacturers,
  user as userTable,
} from '@tula/db';
import type { InstrumentMetrology } from '@tula/engine';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '@/server/session';
import { db, sql } from '../db.js';

// A real INTAKE_OFFICER session (evaluation.create) — see the same rationale
// as apps/web/src/server/actions/masterdata.test.ts.
vi.mock('@/server/session', () => ({ getSession: vi.fn() }));

const { getSession } = await import('@/server/session');
const { saveDraftEvaluationAction, submitEvaluationAction } = await import('./evaluations.js');

let labId: string;
const createdManufacturerIds: string[] = [];
const createdApplicantIds: string[] = [];
const createdInstrumentModelIds: string[] = [];
const createdEvaluationIds: string[] = [];

/** Class III, Max 30 kg, e = d = 5 g, 4 supports — the §4.7 golden fixture. */
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

/** For the raw `instrumentModels` seed inserts below — `defaultSpec` is jsonb, typed loosely at the schema layer. */
const goldenSpecJson = goldenSpec as unknown as Record<string, unknown>;

beforeAll(async () => {
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;

  const [intakeOfficer] = await db
    .select({ id: userTable.id, email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, 'intake.officer@tula.test'));
  if (!intakeOfficer) throw new Error('seed data missing: intake.officer@tula.test not found');

  const session: AppSession = {
    session: {} as AppSession['session'],
    user: {
      id: intakeOfficer.id,
      email: intakeOfficer.email,
      name: intakeOfficer.name,
      role: 'INTAKE_OFFICER',
      designation: null,
      employeeId: null,
      isActive: true,
      twoFactorEnabled: false,
    },
  };
  vi.mocked(getSession).mockResolvedValue(session);
});

afterAll(async () => {
  for (const id of createdEvaluationIds) {
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
  // The `number_sequences` row this test advances is the same counter real
  // evaluation creation uses (lab RRSL-BLR, this calendar year, kind EVAL) —
  // deliberately left alone, not reset, matching "never reuse a number".
  await sql.end();
});

describe('evaluation intake — golden plan (implementation.md §4.7)', () => {
  it('planTests() through submitEvaluationAction produces exactly the golden plan in DB rows', async () => {
    const [mfr] = await db
      .insert(manufacturers)
      .values({ name: 'Golden Fixture Manufacturer QA' })
      .returning({ id: manufacturers.id });
    if (!mfr) throw new Error('setup insert failed');
    createdManufacturerIds.push(mfr.id);

    const [applicant] = await db
      .insert(applicants)
      .values({ name: 'Golden Fixture Applicant QA', manufacturerId: mfr.id })
      .returning({ id: applicants.id });
    if (!applicant) throw new Error('setup insert failed');
    createdApplicantIds.push(applicant.id);

    const [model] = await db
      .insert(instrumentModels)
      .values({
        manufacturerId: mfr.id,
        modelName: 'Golden Fixture Model QA',
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
      sampleSerials: ['SN-QA-1'],
      defaultSpec: goldenSpec,
    });
    expect(draftResult.ok).toBe(true);
    if (!draftResult.ok) return;
    createdEvaluationIds.push(draftResult.data.id);

    const [draftRow] = await db
      .select({ status: evaluations.status, refNo: evaluations.refNo })
      .from(evaluations)
      .where(eq(evaluations.id, draftResult.data.id));
    expect(draftRow?.status).toBe('DRAFT');
    expect(draftRow?.refNo).toMatch(/^EV-RRSL-BLR-\d{4}-\d{4}$/);

    const submitResult = await submitEvaluationAction({
      draftId: draftResult.data.id,
      testOverrides: [],
      priority: 'normal',
    });
    expect(submitResult.ok).toBe(true);

    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, draftResult.data.id));
    expect(evaluation?.status).toBe('PLANNED');
    expect(evaluation?.rulepackId).toBe('oiml-r76-1-2006');
    expect(evaluation?.rulepackVersion).toBe('1.0.0');
    expect(evaluation?.engineVersion).toBeTruthy();

    const tests = await db
      .select()
      .from(evaluationTests)
      .where(eq(evaluationTests.evaluationId, draftResult.data.id));
    const byCode = new Map(tests.map((t) => [t.testCode, t]));

    const weighing = byCode.get('WEIGHING');
    expect(weighing?.applicability).toBe('APPLICABLE');
    const weighingParams = weighing?.params as {
      zeroRef: string;
      ascending: { L: string }[];
      descending: { L: string }[];
    };
    expect(weighingParams.zeroRef).toBe('50');
    expect(weighingParams.ascending.map((r) => r.L)).toEqual([
      '100',
      '2500',
      '10000',
      '15000',
      '30000',
    ]);
    expect(weighingParams.descending.map((r) => r.L)).toEqual([
      '30000',
      '15000',
      '10000',
      '2500',
      '100',
    ]);

    const eccentricity = byCode.get('ECCENTRICITY');
    expect(eccentricity?.params).toEqual({
      load: '10000',
      positions: ['centre', 'Q1', 'Q2', 'Q3', 'Q4'],
    });

    const repeatability = byCode.get('REPEATABILITY');
    expect(repeatability?.params).toEqual({ loads: ['15000', '30000'], readingsPerSeries: 10 });

    const discrimination = byCode.get('DISCRIMINATION');
    expect(discrimination?.params).toEqual({ loads: ['100', '15000', '30000'], extraLoad: '7' });

    const creep = byCode.get('CREEP');
    expect(creep?.params).toEqual({ load: '30000', scheduleMin: [0, 5, 15, 30] });

    // A test the engine itself marks NOT_APPLICABLE for this instrument
    // (no zero-tracking device) — auto-reasoned, not user-overridden.
    const zeroTracking = byCode.get('ZERO_TRACKING');
    expect(zeroTracking?.applicability).toBe('NOT_APPLICABLE');
    expect(zeroTracking?.naReason).toBeTruthy();

    // A checklist test with no dedicated planner — applicable, no params.
    const examMarkings = byCode.get('EXAM_MARKINGS');
    expect(examMarkings?.applicability).toBe('APPLICABLE');
    expect(examMarkings?.params).toBeNull();
  });

  it('rejects submitting the same draft twice (already PLANNED)', async () => {
    const [mfr] = await db
      .insert(manufacturers)
      .values({ name: 'Golden Fixture Manufacturer QA 2' })
      .returning({ id: manufacturers.id });
    if (!mfr) throw new Error('setup insert failed');
    createdManufacturerIds.push(mfr.id);
    const [applicant] = await db
      .insert(applicants)
      .values({ name: 'Golden Fixture Applicant QA 2' })
      .returning({ id: applicants.id });
    if (!applicant) throw new Error('setup insert failed');
    createdApplicantIds.push(applicant.id);
    const [model] = await db
      .insert(instrumentModels)
      .values({
        manufacturerId: mfr.id,
        modelName: 'Golden Fixture Model QA 2',
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

    const first = await submitEvaluationAction({ draftId: draftResult.data.id, testOverrides: [] });
    expect(first.ok).toBe(true);

    const second = await submitEvaluationAction({
      draftId: draftResult.data.id,
      testOverrides: [],
    });
    expect(second).toEqual({ ok: false, code: 'CONFLICT' });
  });

  it('lets a user override an APPLICABLE test to N/A with a reason', async () => {
    const [mfr] = await db
      .insert(manufacturers)
      .values({ name: 'Golden Fixture Manufacturer QA 3' })
      .returning({ id: manufacturers.id });
    if (!mfr) throw new Error('setup insert failed');
    createdManufacturerIds.push(mfr.id);
    const [applicant] = await db
      .insert(applicants)
      .values({ name: 'Golden Fixture Applicant QA 3' })
      .returning({ id: applicants.id });
    if (!applicant) throw new Error('setup insert failed');
    createdApplicantIds.push(applicant.id);
    const [model] = await db
      .insert(instrumentModels)
      .values({
        manufacturerId: mfr.id,
        modelName: 'Golden Fixture Model QA 3',
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

    const result = await submitEvaluationAction({
      draftId: draftResult.data.id,
      testOverrides: [{ code: 'CREEP', naReason: 'Not required for this batch — see memo 12.' }],
    });
    expect(result.ok).toBe(true);

    const tests = await db
      .select()
      .from(evaluationTests)
      .where(eq(evaluationTests.evaluationId, draftResult.data.id));
    const creepRow = tests.find((t) => t.testCode === 'CREEP');
    expect(creepRow?.applicability).toBe('NOT_APPLICABLE');
    expect(creepRow?.naReason).toBe('Not required for this batch — see memo 12.');
  });
});
