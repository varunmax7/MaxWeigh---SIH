import {
  applicants,
  approvals,
  attachments,
  comments as commentsTable,
  evaluations,
  evaluationTests,
  instrumentModels,
  labMembers,
  labs as labsTable,
  manufacturers,
  notifications,
  reports,
  reportVersions,
  user as userTable,
} from '@tula/db';
import type { InstrumentMetrology } from '@tula/engine';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '@/server/session';
import { db, sql } from '../db.js';

// Real DB, real engine, real audit ledger, real `action()` wrapper — the same
// rationale as execution.test.ts. Only two seams are mocked:
//   * the session, so one test can act as four different officers;
//   * `assertStepUp`, because a genuine TOTP would mean enrolling an
//     authenticator for each of them. The step-up behaviour itself is pinned
//     separately in `server/step-up.test.ts`.
vi.mock('@/server/session', () => ({ getSession: vi.fn() }));
vi.mock('@/server/step-up', () => ({ assertStepUp: vi.fn(async () => {}) }));

const { getSession } = await import('@/server/session');
const { assertStepUp } = await import('@/server/step-up');
const { submitForReviewAction } = await import('./review.js');
const { decideTier1Action, decideTier2Action, decideTier3Action } = await import(
  './tier-decision.js'
);
const { addCommentAction, resolveCommentAction } = await import('./comments.js');
const { saveDraftEvaluationAction, submitEvaluationAction } = await import('./evaluations.js');
const { saveObservationsAction, completeTestAction } = await import('./execution.js');

let labId: string;
/** A second CMO-capable identity, so SoD-2 can be exercised with one *person* across two tiers. */
let dualUserId: string;
const createdManufacturerIds: string[] = [];
const createdApplicantIds: string[] = [];
const createdInstrumentModelIds: string[] = [];
const createdEvaluationIds: string[] = [];
const createdUserIds: string[] = [];

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
      twoFactorEnabled: true,
    },
  });
  return found.id;
}

/**
 * Plans the golden evaluation, then brings every applicable test to COMPLETED.
 * WEIGHING goes through the real save/complete actions so the stored verdict
 * is the engine's; the rest are stamped directly, because this suite is about
 * the workflow and execution.test.ts already covers that path per test code.
 */
async function completedEvaluation(suffix: string, completerEmail = 'testing.officer@tula.test') {
  await setSession('intake.officer@tula.test', 'INTAKE_OFFICER');

  const [mfr] = await db
    .insert(manufacturers)
    .values({ name: `Review QA Manufacturer ${suffix}` })
    .returning({ id: manufacturers.id });
  const [applicant] = await db
    .insert(applicants)
    .values({ name: `Review QA Applicant ${suffix}` })
    .returning({ id: applicants.id });
  if (!mfr || !applicant) throw new Error('setup insert failed');
  createdManufacturerIds.push(mfr.id);
  createdApplicantIds.push(applicant.id);

  const [model] = await db
    .insert(instrumentModels)
    .values({
      manufacturerId: mfr.id,
      modelName: `Review QA Model ${suffix}`,
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
    sampleSerials: ['SN-1'],
    defaultSpec: goldenSpec,
  });
  if (!draft.ok) throw new Error('draft creation failed');
  const evaluationId = draft.data.id;
  createdEvaluationIds.push(evaluationId);

  const testerId = await setSession(completerEmail, 'TESTING_OFFICER');
  const planned = await submitEvaluationAction({
    draftId: evaluationId,
    testOverrides: [],
    assignedTesterId: testerId,
  });
  if (!planned.ok) throw new Error('planning failed');

  const [weighing] = await db
    .select()
    .from(evaluationTests)
    .where(
      and(eq(evaluationTests.evaluationId, evaluationId), eq(evaluationTests.testCode, 'WEIGHING')),
    );
  if (!weighing) throw new Error('WEIGHING row not planned');

  // The §4.5 golden zero reference plus one comfortably-passing 10 kg row.
  const saved = await saveObservationsAction({
    testId: weighing.id,
    observations: {
      zeroRef: { L: '50', I: '50', deltaL: '3.0' },
      ascending: [{ rowId: 'r1', L: '10000', I: '10000', deltaL: '1.5' }],
      descending: [],
    },
    envStart: { tempC: 22.3, rhPct: 54, source: 'manual', ts: new Date().toISOString() },
    envEnd: { tempC: 22.5, rhPct: 54, source: 'manual', ts: new Date().toISOString() },
    rowVersion: weighing.rowVersion,
  });
  if (!saved.ok) throw new Error('saving the golden observation failed');

  await db
    .update(evaluationTests)
    .set({
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: testerId,
      verdict: 'PASS',
      result: { verdict: 'PASS', rows: [], summary: {}, issues: [], steps: [] },
    })
    .where(
      and(
        eq(evaluationTests.evaluationId, evaluationId),
        eq(evaluationTests.applicability, 'APPLICABLE'),
      ),
    );
  await db
    .update(evaluations)
    .set({ status: 'IN_TESTING' })
    .where(eq(evaluations.id, evaluationId));

  return { evaluationId, weighingTestId: weighing.id, testerId };
}

async function statusOf(evaluationId: string) {
  const [row] = await db
    .select({ status: evaluations.status, verdict: evaluations.overallVerdict })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId));
  return row;
}

async function currentVersion(evaluationId: string) {
  const [row] = await db
    .select({
      version: reportVersions.version,
      modelSha256: reportVersions.modelSha256,
      status: reportVersions.status,
      changeSummary: reportVersions.changeSummary,
      reportNo: reports.reportNo,
    })
    .from(reports)
    .innerJoin(reportVersions, eq(reports.currentVersionId, reportVersions.id))
    .where(eq(reports.evaluationId, evaluationId));
  if (!row) throw new Error('no current report version');
  return row;
}

beforeAll(async () => {
  const [lab] = await db
    .select({ id: labsTable.id })
    .from(labsTable)
    .where(eq(labsTable.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;

  const [dual] = await db
    .insert(userTable)
    .values({
      name: 'Review QA Dual-Role Officer',
      email: `p7-dual-${Date.now()}@tula.test`,
      emailVerified: true,
      role: 'SENIOR_TESTING_OFFICER',
    })
    .returning({ id: userTable.id });
  if (!dual) throw new Error('dual-role user insert failed');
  dualUserId = dual.id;
  createdUserIds.push(dual.id);
  await db.insert(labMembers).values({ userId: dual.id, labId });
});

afterAll(async () => {
  for (const id of createdEvaluationIds) {
    const reportRows = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.evaluationId, id));
    for (const report of reportRows) {
      const versions = await db
        .select({ id: reportVersions.id })
        .from(reportVersions)
        .where(eq(reportVersions.reportId, report.id));
      if (versions.length > 0) {
        await db.delete(approvals).where(
          inArray(
            approvals.reportVersionId,
            versions.map((v) => v.id),
          ),
        );
      }
      await db.update(reports).set({ currentVersionId: null }).where(eq(reports.id, report.id));
      await db.delete(reportVersions).where(eq(reportVersions.reportId, report.id));
      await db.delete(reports).where(eq(reports.id, report.id));
    }
    await db.delete(commentsTable).where(eq(commentsTable.evaluationId, id));
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
  // The dual-role user cannot be deleted: it is now permanently referenced by
  // the append-only audit ledger (implementation.md §9 "audit_log is
  // append-only") — the same reason evaluations/applicants/manufacturers
  // above are cleaned up but audit_log rows never are. Notifications and lab
  // membership are still cleared so the fixture leaves no dangling queue
  // entries for a re-run.
  for (const id of createdUserIds) {
    await db.delete(notifications).where(eq(notifications.userId, id));
    await db.delete(labMembers).where(eq(labMembers.userId, id));
  }
  await sql.end();
});

describe('tiered review chain (implementation.md §6.3)', () => {
  it('runs submit → tier 1 → tier 2 with three distinct users and lands in PENDING_T3', async () => {
    const { evaluationId } = await completedEvaluation('chain');

    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    const submitted = await submitForReviewAction({ evaluationId });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.data.version).toBe('1.0');
    expect(submitted.data.verdict).toBe('CONFORMS');
    expect(await statusOf(evaluationId)).toMatchObject({
      status: 'PENDING_T1',
      verdict: 'CONFORMS',
    });

    const v1 = await currentVersion(evaluationId);
    expect(v1.modelSha256).toBe(submitted.data.modelSha256);
    expect(v1.reportNo).toMatch(/^TR-RRSL-BLR-\d{4}-\d{4}$/);

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    const tier1 = await decideTier1Action({
      evaluationId,
      modelSha256: v1.modelSha256,
      decision: 'APPROVE',
      totpCode: '123456',
    });
    expect(tier1.ok).toBe(true);
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T2' });
    expect(vi.mocked(assertStepUp)).toHaveBeenCalledWith('123456');

    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const tier2 = await decideTier2Action({
      evaluationId,
      modelSha256: v1.modelSha256,
      decision: 'APPROVE',
      totpCode: '654321',
    });
    expect(tier2.ok).toBe(true);
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T3' });

    const signed = await db
      .select({ tier: approvals.tier, userId: approvals.userId, stepUp: approvals.stepUpVerified })
      .from(approvals)
      .innerJoin(reportVersions, eq(approvals.reportVersionId, reportVersions.id))
      .innerJoin(reports, eq(reportVersions.reportId, reports.id))
      .where(eq(reports.evaluationId, evaluationId));
    expect(signed.map((s) => s.tier).sort()).toEqual([1, 2]);
    expect(new Set(signed.map((s) => s.userId)).size).toBe(2);
    expect(signed.every((s) => s.stepUp)).toBe(true);
  });

  it('locks every test from PENDING_T1 onward (§6.3 "Locking")', async () => {
    const { evaluationId, weighingTestId } = await completedEvaluation('locking');

    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);

    const [row] = await db
      .select()
      .from(evaluationTests)
      .where(eq(evaluationTests.id, weighingTestId));
    const blocked = await saveObservationsAction({
      testId: weighingTestId,
      observations: {
        zeroRef: { L: '50', I: '50', deltaL: '3.0' },
        ascending: [{ rowId: 'r1', L: '10000', I: '10090', deltaL: '1.5' }],
        descending: [],
      },
      rowVersion: row?.rowVersion ?? 0,
    });
    expect(blocked).toEqual({ ok: false, code: 'CONFLICT' });

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    expect(
      await completeTestAction({ testId: weighingTestId, rowVersion: row?.rowVersion ?? 0 }),
    ).toEqual({ ok: false, code: 'CONFLICT' });
  });

  it('refuses to submit while an applicable test is still open', async () => {
    const { evaluationId } = await completedEvaluation('incomplete');
    const [anyTest] = await db
      .select({ id: evaluationTests.id })
      .from(evaluationTests)
      .where(
        and(
          eq(evaluationTests.evaluationId, evaluationId),
          eq(evaluationTests.applicability, 'APPLICABLE'),
        ),
      );
    await db
      .update(evaluationTests)
      .set({ status: 'IN_PROGRESS' })
      .where(eq(evaluationTests.id, anyTest?.id ?? ''));

    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect(await submitForReviewAction({ evaluationId })).toEqual({ ok: false, code: 'RULE' });
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'IN_TESTING' });
  });

  it('refuses a decision taken against a superseded snapshot hash', async () => {
    const { evaluationId } = await completedEvaluation('stale');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    expect(
      await decideTier1Action({
        evaluationId,
        modelSha256: 'f'.repeat(64),
        decision: 'APPROVE',
        totpCode: '123456',
      }),
    ).toEqual({ ok: false, code: 'RULE' });
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T1' });
  });

  it('refuses the decision when the step-up code does not verify', async () => {
    const { evaluationId } = await completedEvaluation('stepup');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);
    const version = await currentVersion(evaluationId);

    const { ActionError } = await import('../action.js');
    vi.mocked(assertStepUp).mockRejectedValueOnce(
      new ActionError('FORBIDDEN', 'That code was not accepted.'),
    );

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    expect(
      await decideTier1Action({
        evaluationId,
        modelSha256: version.modelSha256,
        decision: 'APPROVE',
        totpCode: '000000',
      }),
    ).toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T1' });
  });
});

describe('separation of duties, enforced server-side (implementation.md §6.2)', () => {
  it('SoD-1: the officer who completed a test cannot verify it at tier 1', async () => {
    const { evaluationId } = await completedEvaluation('sod1', 'senior.testing.officer@tula.test');

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);
    const version = await currentVersion(evaluationId);

    expect(
      await decideTier1Action({
        evaluationId,
        modelSha256: version.modelSha256,
        decision: 'APPROVE',
        totpCode: '123456',
      }),
    ).toEqual({ ok: false, code: 'RULE' });
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T1' });
  });

  it('SoD-2: one person cannot sign two tiers of the same report version', async () => {
    const { evaluationId } = await completedEvaluation('sod2');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);
    const version = await currentVersion(evaluationId);

    // The same user, twice — first holding tier 1's role, then tier 2's. A
    // role change is the realistic way one person ends up eligible for both
    // (§9 "revoke-all on role change"), and SoD-2 is what stops them signing
    // the same report at two tiers regardless.
    const asDual = (role: AppSession['user']['role']) =>
      vi.mocked(getSession).mockResolvedValue({
        session: {} as AppSession['session'],
        user: {
          id: dualUserId,
          email: 'p7-dual@tula.test',
          name: 'Review QA Dual-Role Officer',
          role,
          designation: null,
          employeeId: null,
          isActive: true,
          twoFactorEnabled: true,
        },
      });

    asDual('SENIOR_TESTING_OFFICER');
    expect(
      (
        await decideTier1Action({
          evaluationId,
          modelSha256: version.modelSha256,
          decision: 'APPROVE',
          totpCode: '123456',
        })
      ).ok,
    ).toBe(true);

    asDual('CHIEF_METROLOGY_OFFICER');
    expect(
      await decideTier2Action({
        evaluationId,
        modelSha256: version.modelSha256,
        decision: 'APPROVE',
        totpCode: '123456',
      }),
    ).toEqual({ ok: false, code: 'RULE' });
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T2' });
  });

  it('ADMIN can neither verify nor approve nor seal', async () => {
    const { evaluationId } = await completedEvaluation('admin');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);
    const version = await currentVersion(evaluationId);

    await setSession('admin@tula.test', 'ADMIN');
    for (const decide of [decideTier1Action, decideTier2Action, decideTier3Action]) {
      expect(
        await decide({
          evaluationId,
          modelSha256: version.modelSha256,
          decision: 'APPROVE',
          totpCode: '123456',
        }),
      ).toEqual({ ok: false, code: 'FORBIDDEN' });
    }
  });
});

describe('return with comments and versioning (implementation.md §6.3, §10 P7)', () => {
  it('unlocks only the commented test, then resubmits as v1.1 with a fresh hash that invalidates tier 1', async () => {
    const { evaluationId, weighingTestId } = await completedEvaluation('return');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);
    const v1 = await currentVersion(evaluationId);

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    const commented = await addCommentAction({
      evaluationId,
      testId: weighingTestId,
      rowRef: 'asc:1',
      body: 'The 10 kg indication needs re-reading — the additional load looks transposed.',
    });
    expect(commented.ok).toBe(true);
    if (!commented.ok) return;

    const returned = await decideTier1Action({
      evaluationId,
      modelSha256: v1.modelSha256,
      decision: 'RETURN',
      totpCode: '123456',
      comment: 'Re-read the 10 kg row and resubmit.',
    });
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    expect(returned.data).toMatchObject({ status: 'RETURNED', reopenedTests: 1 });
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'RETURNED' });

    const testRows = await db
      .select({ id: evaluationTests.id, status: evaluationTests.status })
      .from(evaluationTests)
      .where(
        and(
          eq(evaluationTests.evaluationId, evaluationId),
          eq(evaluationTests.applicability, 'APPLICABLE'),
        ),
      );
    expect(testRows.find((t) => t.id === weighingTestId)?.status).toBe('REOPENED');
    expect(testRows.filter((t) => t.status === 'REOPENED')).toHaveLength(1);

    // Resolve the thread, re-complete the test, resubmit.
    expect((await resolveCommentAction({ commentId: commented.data.id })).ok).toBe(true);
    await db
      .update(evaluationTests)
      .set({ status: 'COMPLETED' })
      .where(eq(evaluationTests.id, weighingTestId));

    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    const resubmitted = await submitForReviewAction({ evaluationId });
    expect(resubmitted.ok).toBe(true);
    if (!resubmitted.ok) return;
    expect(resubmitted.data.version).toBe('1.1');
    expect(resubmitted.data.modelSha256).not.toBe(v1.modelSha256);

    const v11 = await currentVersion(evaluationId);
    expect(v11.version).toBe('1.1');
    expect(v11.changeSummary).toBeTruthy();

    // Tier 1's earlier decision was bound to v1.0's hash, so the same officer
    // may — and must — sign again on v1.1.
    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    expect(
      (
        await decideTier1Action({
          evaluationId,
          modelSha256: v11.modelSha256,
          decision: 'APPROVE',
          totpCode: '123456',
        })
      ).ok,
    ).toBe(true);
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T2' });
  });

  it('refuses to seal at tier 3 until the signing pipeline exists, but still lets the Controller return', async () => {
    const { evaluationId } = await completedEvaluation('tier3');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);
    const version = await currentVersion(evaluationId);

    await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    expect(
      (
        await decideTier1Action({
          evaluationId,
          modelSha256: version.modelSha256,
          decision: 'APPROVE',
          totpCode: '123456',
        })
      ).ok,
    ).toBe(true);
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    expect(
      (
        await decideTier2Action({
          evaluationId,
          modelSha256: version.modelSha256,
          decision: 'APPROVE',
          totpCode: '123456',
        })
      ).ok,
    ).toBe(true);

    await setSession('controller@tula.test', 'CONTROLLER');
    expect(
      await decideTier3Action({
        evaluationId,
        modelSha256: version.modelSha256,
        decision: 'APPROVE',
        totpCode: '123456',
      }),
    ).toEqual({ ok: false, code: 'RULE' });
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'PENDING_T3' });

    expect(
      (
        await decideTier3Action({
          evaluationId,
          modelSha256: version.modelSha256,
          decision: 'RETURN',
          totpCode: '123456',
          comment: 'The applicant address is wrong on the cover.',
        })
      ).ok,
    ).toBe(true);
    expect(await statusOf(evaluationId)).toMatchObject({ status: 'RETURNED' });
  });

  it('notifies the tier that now has to act, and never the person who acted', async () => {
    const { evaluationId, testerId } = await completedEvaluation('notify');
    await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
    expect((await submitForReviewAction({ evaluationId })).ok).toBe(true);

    const stoId = await setSession('senior.testing.officer@tula.test', 'SENIOR_TESTING_OFFICER');
    const forSto = await db
      .select({ payload: notifications.payload, type: notifications.type })
      .from(notifications)
      .where(and(eq(notifications.userId, stoId), eq(notifications.type, 'review.pending')));
    expect(forSto.some((n) => String(n.payload?.evaluationId ?? '') === evaluationId)).toBe(true);

    const forTester = await db
      .select({ payload: notifications.payload })
      .from(notifications)
      .where(and(eq(notifications.userId, testerId), eq(notifications.type, 'review.pending')));
    expect(forTester.some((n) => String(n.payload?.evaluationId ?? '') === evaluationId)).toBe(
      false,
    );

    await db.delete(notifications).where(inArray(notifications.userId, [stoId, testerId]));
  });
});
