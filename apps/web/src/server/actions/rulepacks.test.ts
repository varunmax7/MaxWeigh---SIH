import {
  applicants,
  evaluations,
  evaluationTests,
  instrumentModels,
  labs as labsTable,
  manufacturers,
  rulepacks,
  user as userTable,
} from '@tula/db';
import type { InstrumentMetrology } from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '@/server/session';
import { db, sql } from '../db.js';

// Real DB, real engine, real `action()` wrapper — same rationale as
// review.test.ts. Only the session is mocked, so one test file can act as
// several different officers.
vi.mock('@/server/session', () => ({ getSession: vi.fn() }));

const { getSession } = await import('@/server/session');
const {
  cloneRulepackDraftAction,
  updateRulepackDraftAction,
  initiateRulepackPublishAction,
  cancelRulepackPublishInitiationAction,
  confirmRulepackPublishAction,
  compareRulepackDraftAction,
} = await import('./rulepacks.js');
const { saveDraftEvaluationAction, submitEvaluationAction } = await import('./evaluations.js');
const { saveObservationsAction } = await import('./execution.js');

let labId: string;
const createdManufacturerIds: string[] = [];
const createdApplicantIds: string[] = [];
const createdInstrumentModelIds: string[] = [];
const createdEvaluationIds: string[] = [];
/** `[id, version]` pairs this file creates in `rulepacks` — cleaned up in `afterAll`, distinct from the seeded `oiml-r76-1-2006@1.0.0` baseline. */
const createdRulepackVersions: [string, string][] = [];

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

/** One evaluation with a real, engine-computed, comfortably-passing COMPLETED `WEIGHING` test — the same golden fixture `review.test.ts` uses. */
async function completedWeighingEvaluation(suffix: string) {
  await setSession('intake.officer@tula.test', 'INTAKE_OFFICER');

  const [mfr] = await db
    .insert(manufacturers)
    .values({ name: `Rulepack QA Manufacturer ${suffix}` })
    .returning({ id: manufacturers.id });
  const [applicant] = await db
    .insert(applicants)
    .values({ name: `Rulepack QA Applicant ${suffix}` })
    .returning({ id: applicants.id });
  if (!mfr || !applicant) throw new Error('setup insert failed');
  createdManufacturerIds.push(mfr.id);
  createdApplicantIds.push(applicant.id);

  const [model] = await db
    .insert(instrumentModels)
    .values({
      manufacturerId: mfr.id,
      modelName: `Rulepack QA Model ${suffix}`,
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

  const testerId = await setSession('testing.officer@tula.test', 'TESTING_OFFICER');
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
    .set({ status: 'COMPLETED', completedAt: new Date(), completedBy: testerId })
    .where(eq(evaluationTests.id, weighing.id));

  const [stored] = await db
    .select({ verdict: evaluationTests.verdict })
    .from(evaluationTests)
    .where(eq(evaluationTests.id, weighing.id));
  const [evalRow] = await db
    .select({ refNo: evaluations.refNo })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId));
  if (!evalRow) throw new Error('evaluation not found after creation');

  return {
    evaluationId,
    refNo: evalRow.refNo,
    weighingTestId: weighing.id,
    storedVerdict: stored?.verdict ?? null,
  };
}

beforeAll(async () => {
  const [lab] = await db
    .select({ id: labsTable.id })
    .from(labsTable)
    .where(eq(labsTable.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;

  const [published] = await db
    .select({ id: rulepacks.id })
    .from(rulepacks)
    .where(
      and(eq(rulepacks.id, OIML_R76_1_2006.id), eq(rulepacks.version, OIML_R76_1_2006.version)),
    );
  if (!published)
    throw new Error('seed data missing: run pnpm db:seed first (published rule pack)');
});

afterAll(async () => {
  for (const [id, version] of createdRulepackVersions) {
    await db.delete(rulepacks).where(and(eq(rulepacks.id, id), eq(rulepacks.version, version)));
  }
  // The publish-flow tests retire the seeded baseline when they publish a
  // test draft over it — restore it so a re-run (and every other suite that
  // assumes a PUBLISHED oiml-r76-1-2006) still finds it.
  await db
    .update(rulepacks)
    .set({ status: 'PUBLISHED' })
    .where(
      and(eq(rulepacks.id, OIML_R76_1_2006.id), eq(rulepacks.version, OIML_R76_1_2006.version)),
    );

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
  await sql.end();
});

describe('cloneRulepackDraftAction / updateRulepackDraftAction', () => {
  it('clones the published pack to a new minor-bumped draft version, unverified', async () => {
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const result = await cloneRulepackDraftAction({
      sourceId: OIML_R76_1_2006.id,
      sourceVersion: OIML_R76_1_2006.version,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe('1.1.0');
    createdRulepackVersions.push([result.data.id, result.data.version]);

    const [row] = await db
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, result.data.id), eq(rulepacks.version, result.data.version)));
    if (!row) throw new Error('cloned draft not found');
    expect(row.status).toBe('DRAFT');
    const verification = row.content.verification as { verifiedBy: string | null } | undefined;
    expect(verification?.verifiedBy).toBeNull();
  });

  it('bumps past an already-taken version on a second clone', async () => {
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const result = await cloneRulepackDraftAction({
      sourceId: OIML_R76_1_2006.id,
      sourceVersion: OIML_R76_1_2006.version,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe('1.2.0');
    createdRulepackVersions.push([result.data.id, result.data.version]);
  });

  it('rejects cloning/editing for a role without rulepack.draft', async () => {
    await setSession('auditor@tula.test', 'AUDITOR');
    const result = await cloneRulepackDraftAction({
      sourceId: OIML_R76_1_2006.id,
      sourceVersion: OIML_R76_1_2006.version,
    });
    expect(result).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('accepts a valid edit to a draft and updates its content hash', async () => {
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const [draftId, draftVersion] = createdRulepackVersions[0] as [string, string];
    const [before] = await db
      .select({ contentSha256: rulepacks.contentSha256, content: rulepacks.content })
      .from(rulepacks)
      .where(and(eq(rulepacks.id, draftId), eq(rulepacks.version, draftVersion)));
    if (!before) throw new Error('draft not found');

    const edited = { ...before.content, title: 'OIML R 76-1:2006 (edited draft)' };
    const result = await updateRulepackDraftAction({
      id: draftId,
      version: draftVersion,
      content: edited,
    });
    expect(result.ok).toBe(true);

    const [after] = await db
      .select({ contentSha256: rulepacks.contentSha256, title: rulepacks.title })
      .from(rulepacks)
      .where(and(eq(rulepacks.id, draftId), eq(rulepacks.version, draftVersion)));
    expect(after?.contentSha256).not.toBe(before.contentSha256);
    expect(after?.title).toBe('OIML R 76-1:2006 (edited draft)');
  });

  it('rejects an edit that fails rule-pack schema validation', async () => {
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const [draftId, draftVersion] = createdRulepackVersions[0] as [string, string];
    const result = await updateRulepackDraftAction({
      id: draftId,
      version: draftVersion,
      content: { nonsense: true },
    });
    expect(result).toMatchObject({ ok: false, code: 'RULE' });
  });

  it('refuses to edit a draft with a pending publish confirmation, until it is cancelled', async () => {
    const [draftId, draftVersion] = createdRulepackVersions[0] as [string, string];

    await setSession('admin@tula.test', 'ADMIN');
    expect(await initiateRulepackPublishAction({ id: draftId, version: draftVersion })).toEqual({
      ok: true,
      data: { id: draftId, version: draftVersion },
    });

    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const [before] = await db
      .select({ content: rulepacks.content })
      .from(rulepacks)
      .where(and(eq(rulepacks.id, draftId), eq(rulepacks.version, draftVersion)));
    if (!before) throw new Error('draft not found');
    expect(
      await updateRulepackDraftAction({
        id: draftId,
        version: draftVersion,
        content: { ...before.content, title: 'Sneaked in after initiation' },
      }),
    ).toEqual({ ok: false, code: 'CONFLICT' });

    await setSession('admin@tula.test', 'ADMIN');
    expect(
      await cancelRulepackPublishInitiationAction({ id: draftId, version: draftVersion }),
    ).toEqual({ ok: true, data: { id: draftId, version: draftVersion } });

    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    expect(
      await updateRulepackDraftAction({
        id: draftId,
        version: draftVersion,
        content: { ...before.content, title: 'Edited after cancelling' },
      }),
    ).toMatchObject({ ok: true });
  });

  it('refuses to edit a published (non-draft) version', async () => {
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const result = await updateRulepackDraftAction({
      id: OIML_R76_1_2006.id,
      version: OIML_R76_1_2006.version,
      content: OIML_R76_1_2006 as unknown as Record<string, unknown>,
    });
    expect(result).toEqual({ ok: false, code: 'CONFLICT' });
  });
});

describe('rule pack publish — SoD-3 (implementation.md §6.2, §6.3)', () => {
  it('runs the full initiate (ADMIN) → confirm (CONTROLLER) flow and retires the previous published version', async () => {
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const cloned = await cloneRulepackDraftAction({
      sourceId: OIML_R76_1_2006.id,
      sourceVersion: OIML_R76_1_2006.version,
    });
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;
    const ref = { id: cloned.data.id, version: cloned.data.version };
    createdRulepackVersions.push([ref.id, ref.version]);

    // A role holding `rulepack.publish` (CONTROLLER) but the wrong side of
    // the split still can't initiate — only ADMIN may.
    await setSession('controller@tula.test', 'CONTROLLER');
    expect(await initiateRulepackPublishAction(ref)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });

    // A role that can draft but holds no `rulepack.publish` permission at all.
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    expect(await initiateRulepackPublishAction(ref)).toEqual({ ok: false, code: 'FORBIDDEN' });

    await setSession('admin@tula.test', 'ADMIN');
    expect(await initiateRulepackPublishAction(ref)).toEqual({ ok: true, data: ref });
    expect(await initiateRulepackPublishAction(ref)).toMatchObject({ ok: false, code: 'CONFLICT' });

    // Confirming needs CONTROLLER specifically — not the ADMIN who initiated.
    expect(await confirmRulepackPublishAction(ref)).toMatchObject({ ok: false, code: 'FORBIDDEN' });

    await setSession('controller@tula.test', 'CONTROLLER');
    expect(await confirmRulepackPublishAction(ref)).toEqual({ ok: true, data: ref });

    const [published] = await db
      .select()
      .from(rulepacks)
      .where(and(eq(rulepacks.id, ref.id), eq(rulepacks.version, ref.version)));
    expect(published?.status).toBe('PUBLISHED');
    expect(published?.confirmedBy).not.toBeNull();
    expect(published?.publishedAt).not.toBeNull();

    const [retired] = await db
      .select({ status: rulepacks.status })
      .from(rulepacks)
      .where(
        and(eq(rulepacks.id, OIML_R76_1_2006.id), eq(rulepacks.version, OIML_R76_1_2006.version)),
      );
    expect(retired?.status).toBe('RETIRED');

    // Confirming twice is refused — there's nothing pending any more.
    expect(await confirmRulepackPublishAction(ref)).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('lets an ADMIN cancel a pending initiation', async () => {
    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const cloned = await cloneRulepackDraftAction({
      sourceId: OIML_R76_1_2006.id,
      sourceVersion: OIML_R76_1_2006.version,
    });
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;
    const ref = { id: cloned.data.id, version: cloned.data.version };
    createdRulepackVersions.push([ref.id, ref.version]);

    await setSession('admin@tula.test', 'ADMIN');
    expect(await initiateRulepackPublishAction(ref)).toEqual({ ok: true, data: ref });

    await setSession('controller@tula.test', 'CONTROLLER');
    expect(await cancelRulepackPublishInitiationAction(ref)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });

    await setSession('admin@tula.test', 'ADMIN');
    expect(await cancelRulepackPublishInitiationAction(ref)).toEqual({ ok: true, data: ref });
    expect(await cancelRulepackPublishInitiationAction(ref)).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });

    const [row] = await db
      .select({ status: rulepacks.status, publishedBy: rulepacks.publishedBy })
      .from(rulepacks)
      .where(and(eq(rulepacks.id, ref.id), eq(rulepacks.version, ref.version)));
    expect(row?.status).toBe('DRAFT');
    expect(row?.publishedBy).toBeNull();
  });
});

describe('compareRulepackDraftAction — sandbox re-evaluate (implementation.md §10 P10)', () => {
  it('reports no change for a draft identical to the published pack, and never touches the stored evaluation', async () => {
    const { evaluationId, refNo, storedVerdict } =
      await completedWeighingEvaluation('sandbox-noop');
    expect(storedVerdict).toBe('PASS');

    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const cloned = await cloneRulepackDraftAction({
      sourceId: OIML_R76_1_2006.id,
      sourceVersion: OIML_R76_1_2006.version,
    });
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;
    createdRulepackVersions.push([cloned.data.id, cloned.data.version]);

    const compared = await compareRulepackDraftAction({
      id: cloned.data.id,
      version: cloned.data.version,
      refNo,
    });
    expect(compared.ok).toBe(true);
    if (!compared.ok) return;
    const weighingRow = compared.data.rows.find((r) => r.testCode === 'WEIGHING');
    expect(weighingRow).toMatchObject({
      storedVerdict: 'PASS',
      draftVerdict: 'PASS',
      changed: false,
    });

    const [stillStored] = await db
      .select({ verdict: evaluationTests.verdict })
      .from(evaluationTests)
      .where(
        and(
          eq(evaluationTests.evaluationId, evaluationId),
          eq(evaluationTests.testCode, 'WEIGHING'),
        ),
      );
    expect(stillStored?.verdict).toBe('PASS');
  });

  it('surfaces a real verdict change when the draft tightens the class III MPE bands, without altering the stored evaluation', async () => {
    const { evaluationId, refNo, storedVerdict } =
      await completedWeighingEvaluation('sandbox-change');
    expect(storedVerdict).toBe('PASS');

    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    const cloned = await cloneRulepackDraftAction({
      sourceId: OIML_R76_1_2006.id,
      sourceVersion: OIML_R76_1_2006.version,
    });
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;
    createdRulepackVersions.push([cloned.data.id, cloned.data.version]);

    const [draftRow] = await db
      .select({ content: rulepacks.content })
      .from(rulepacks)
      .where(and(eq(rulepacks.id, cloned.data.id), eq(rulepacks.version, cloned.data.version)));
    if (!draftRow) throw new Error('draft not found');
    const content = draftRow.content as {
      mpeBands: Record<string, { upToE: number | null; mpeE: string }[]>;
    };
    // Tighten every class III band to 0.1 e — the golden fixture's real
    // Ec (1.5 g) comfortably clears the real 1.0 e (5 g) band but not this
    // one (0.1 × 5 g = 0.5 g), regardless of which band its load falls in.
    content.mpeBands.III = (content.mpeBands.III ?? []).map((band) => ({ ...band, mpeE: '0.1' }));

    const updated = await updateRulepackDraftAction({
      id: cloned.data.id,
      version: cloned.data.version,
      content: content as unknown as Record<string, unknown>,
    });
    expect(updated.ok).toBe(true);

    const compared = await compareRulepackDraftAction({
      id: cloned.data.id,
      version: cloned.data.version,
      refNo,
    });
    expect(compared.ok).toBe(true);
    if (!compared.ok) return;
    const weighingRow = compared.data.rows.find((r) => r.testCode === 'WEIGHING');
    expect(weighingRow).toMatchObject({
      storedVerdict: 'PASS',
      draftVerdict: 'FAIL',
      changed: true,
    });

    const [stillStored] = await db
      .select({ verdict: evaluationTests.verdict })
      .from(evaluationTests)
      .where(
        and(
          eq(evaluationTests.evaluationId, evaluationId),
          eq(evaluationTests.testCode, 'WEIGHING'),
        ),
      );
    expect(stillStored?.verdict).toBe('PASS');
  });

  it('rejects a role without rulepack.draft, and unknown ids as NOT_FOUND', async () => {
    const { refNo } = await completedWeighingEvaluation('sandbox-guards');

    await setSession('auditor@tula.test', 'AUDITOR');
    expect(
      await compareRulepackDraftAction({
        id: OIML_R76_1_2006.id,
        version: OIML_R76_1_2006.version,
        refNo,
      }),
    ).toEqual({ ok: false, code: 'FORBIDDEN' });

    await setSession('chief.metrology.officer@tula.test', 'CHIEF_METROLOGY_OFFICER');
    expect(
      await compareRulepackDraftAction({ id: 'not-a-real-pack', version: '9.9.9', refNo }),
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(
      await compareRulepackDraftAction({
        id: OIML_R76_1_2006.id,
        version: OIML_R76_1_2006.version,
        refNo: 'EV-DOES-NOT-EXIST-0000',
      }),
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
  });
});
