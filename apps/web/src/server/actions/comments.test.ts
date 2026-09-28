import {
  applicants,
  comments,
  evaluations,
  evaluationTests,
  instrumentModels,
  labs,
  manufacturers,
  notifications,
  user as userTable,
} from '@tula/db';
import type { InstrumentMetrology } from '@tula/engine';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '@/server/session';
import { db, sql } from '../db.js';

vi.mock('@/server/session', () => ({ getSession: vi.fn() }));

const { getSession } = await import('@/server/session');
const { addCommentAction, markNotificationsReadAction } = await import('./comments.js');
const { saveDraftEvaluationAction, submitEvaluationAction } = await import('./evaluations.js');

let labId: string;
const createdManufacturerIds: string[] = [];
const createdApplicantIds: string[] = [];
const createdInstrumentModelIds: string[] = [];
const createdEvaluationIds: string[] = [];

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

async function setSession(email: string, role: AppSession['user']['role']) {
  const [found] = await db
    .select({ id: userTable.id, email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.email, email));
  if (!found) throw new Error(`seed data missing: ${email} not found`);
  vi.mocked(getSession).mockResolvedValue({
    session: {} as AppSession['session'],
    user: {
      id: found.id,
      email: found.email,
      name: found.name,
      role,
      designation: null,
      employeeId: null,
      isActive: true,
      twoFactorEnabled: false,
    },
  });
  return found.id;
}

async function plannedEvaluation(suffix: string) {
  await setSession('intake.officer@tula.test', 'INTAKE_OFFICER');
  const [mfr] = await db
    .insert(manufacturers)
    .values({ name: `Comment QA Manufacturer ${suffix}` })
    .returning({ id: manufacturers.id });
  const [applicant] = await db
    .insert(applicants)
    .values({ name: `Comment QA Applicant ${suffix}` })
    .returning({ id: applicants.id });
  if (!mfr || !applicant) throw new Error('setup insert failed');
  createdManufacturerIds.push(mfr.id);
  createdApplicantIds.push(applicant.id);

  const [model] = await db
    .insert(instrumentModels)
    .values({
      manufacturerId: mfr.id,
      modelName: `Comment QA Model ${suffix}`,
      instrumentType: 'bench',
      defaultSpec: goldenSpec as unknown as Record<string, unknown>,
    })
    .returning({ id: instrumentModels.id });
  if (!model) throw new Error('setup insert failed');
  createdInstrumentModelIds.push(model.id);

  const draft = await saveDraftEvaluationAction({
    labId,
    applicantId: applicant.id,
    manufacturerId: mfr.id,
    modelId: model.id,
    sampleSerials: [],
    defaultSpec: goldenSpec,
  });
  if (!draft.ok) throw new Error('draft creation failed');
  const evaluationId = draft.data.id;
  createdEvaluationIds.push(evaluationId);

  const planned = await submitEvaluationAction({ draftId: evaluationId, testOverrides: [] });
  if (!planned.ok) throw new Error('planning failed');
  return evaluationId;
}

beforeAll(async () => {
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;
});

afterAll(async () => {
  for (const id of createdEvaluationIds) {
    await db.delete(comments).where(eq(comments.evaluationId, id));
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
  await sql.end();
});

describe('addCommentAction', () => {
  it('refuses an AUDITOR, who has read-only access (implementation.md §6.2)', async () => {
    const evaluationId = await plannedEvaluation('auditor');
    await setSession('auditor@tula.test', 'AUDITOR');
    expect(
      await addCommentAction({ evaluationId, body: 'Auditors should not be able to post this.' }),
    ).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('rejects a testId that belongs to a different evaluation', async () => {
    const evaluationId = await plannedEvaluation('mismatch');
    const otherEvaluationId = await plannedEvaluation('mismatch-other');
    const [otherTest] = await db
      .select({ id: evaluationTests.id })
      .from(evaluationTests)
      .where(eq(evaluationTests.evaluationId, otherEvaluationId));

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    expect(
      await addCommentAction({
        evaluationId,
        testId: otherTest?.id,
        body: 'This test does not belong to this evaluation.',
      }),
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('posts a top-level comment and audits it', async () => {
    const evaluationId = await plannedEvaluation('post');
    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    const result = await addCommentAction({
      evaluationId,
      body: 'The markings examination photo is blurry — please retake.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [row] = await db.select().from(comments).where(eq(comments.id, result.data.id));
    expect(row?.body).toBe('The markings examination photo is blurry — please retake.');
    expect(row?.resolvedAt).toBeNull();
  });
});

describe('markNotificationsReadAction', () => {
  it("only clears the caller's own notifications, never another user's", async () => {
    const [me] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, 'senior.testing.officer@tula.test'));
    const [other] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, 'chief.metrology.officer@tula.test'));
    if (!me || !other) throw new Error('seed data missing');
    const meId = me.id;
    const otherId = other.id;
    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');

    // Both users are real seeded accounts that other test files (e.g.
    // review.test.ts) also send genuine notifications to while the suite
    // runs in parallel. Asserting "every unread row for this user" would
    // race against that unrelated traffic, so this pins the assertion to
    // the exact two rows this test created instead.
    const inserted = await db
      .insert(notifications)
      .values([
        {
          userId: meId,
          type: 'review.pending',
          payload: { evaluationId: 'x', refNo: 'x', message: 'x' },
        },
        {
          userId: otherId,
          type: 'review.pending',
          payload: { evaluationId: 'x', refNo: 'x', message: 'x' },
        },
      ])
      .returning({ id: notifications.id, userId: notifications.userId });
    const mineId = inserted.find((row) => row.userId === meId)?.id;
    const theirsId = inserted.find((row) => row.userId === otherId)?.id;
    if (!mineId || !theirsId) throw new Error('notification insert failed');

    const result = await markNotificationsReadAction({ ids: [mineId, theirsId] });
    expect(result.ok).toBe(true);

    const [mine] = await db
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(eq(notifications.id, mineId));
    expect(mine?.readAt).not.toBeNull();

    const [theirs] = await db
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(eq(notifications.id, theirsId));
    expect(theirs?.readAt).toBeNull();

    await db.delete(notifications).where(eq(notifications.id, mineId));
    await db.delete(notifications).where(eq(notifications.id, theirsId));
  });
});
