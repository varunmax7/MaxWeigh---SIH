/**
 * Builds the `reports`/`report_versions`/`approvals` rows for one submitted
 * synthetic evaluation — the part of `seed-volume.ts`'s per-evaluation work
 * that mirrors `apps/web/src/server/report-snapshot.ts`'s `buildSnapshot()`
 * + `apps/web/src/server/actions/tier-decision.ts`'s certificate minting,
 * replicated here (not imported — an app is not a workspace package another
 * app or `packages/db` can import from) because a synthetic evaluation has
 * no HTTP request to drive the real `action()`s through.
 */
import { ENGINE_VERSION, type InstrumentMetrology, type TestResult } from '@tula/engine';
import { buildReportModel, modelSha256, type ReportModelTest } from '@tula/report';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { eq } from 'drizzle-orm';
import type { DbTx } from './audit-ledger.js';
import { allocateNumber } from './number-sequences.js';
import {
  applicants,
  approvals,
  evaluations,
  type evaluationTests,
  instrumentModels,
  labs,
  manufacturers,
  reports,
  reportVersions,
} from './schema/index.js';
import type { ReviewerRoles } from './seed-volume-masterdata.js';

export type SubmittedOutcome =
  | 'ISSUED'
  | 'REVOKED'
  | 'PENDING_T1'
  | 'PENDING_T2'
  | 'PENDING_T3'
  | 'RETURNED';

const TIER_ROLE: Record<1 | 2 | 3, keyof ReviewerRoles> = {
  1: 'SENIOR_TESTING_OFFICER',
  2: 'CHIEF_METROLOGY_OFFICER',
  3: 'CONTROLLER',
};

const TIERS_APPROVED_BEFORE: Record<SubmittedOutcome, (1 | 2 | 3)[]> = {
  PENDING_T1: [],
  PENDING_T2: [1],
  PENDING_T3: [1, 2],
  RETURNED: [1],
  ISSUED: [1, 2, 3],
  REVOKED: [1, 2, 3],
};

export interface SubmitReviewParams {
  evaluationId: string;
  refNo: string;
  sampleSerial: string;
  labId: string;
  labCode: string;
  createdAt: Date;
  applicantId: string;
  modelId: string;
  manufacturerId: string;
  spec: InstrumentMetrology;
  testRows: (typeof evaluationTests.$inferInsert)[];
  outcome: SubmittedOutcome;
  overallVerdict: 'CONFORMS' | 'DOES_NOT_CONFORM' | null;
  userIdByRole: ReviewerRoles;
}

/** Takes a fully-tested evaluation through submit → (partial or full) tier review → optional seal. */
export async function submitAndReview(tx: DbTx, p: SubmitReviewParams): Promise<void> {
  const reportYear = p.createdAt.getFullYear();
  const reportSeq = await allocateNumber(tx, p.labId, reportYear, 'REPORT');
  const reportNo = `TR-${p.labCode}-${reportYear}-${String(reportSeq).padStart(4, '0')}`;
  const [reportRow] = await tx
    .insert(reports)
    .values({ evaluationId: p.evaluationId, reportNo, status: 'IN_REVIEW' })
    .returning({ id: reports.id });
  if (!reportRow) throw new Error('reports insert returned no row');

  const [lab] = await tx.select().from(labs).where(eq(labs.id, p.labId));
  const [applicant] = await tx.select().from(applicants).where(eq(applicants.id, p.applicantId));
  const [manufacturer] = await tx
    .select()
    .from(manufacturers)
    .where(eq(manufacturers.id, p.manufacturerId));
  const [instrumentModel] = await tx
    .select()
    .from(instrumentModels)
    .where(eq(instrumentModels.id, p.modelId));
  if (!lab || !applicant || !manufacturer || !instrumentModel) {
    throw new Error('seedVolume: report snapshot lookup failed');
  }

  const tests: ReportModelTest[] = p.testRows.map((row) => {
    const catalog = OIML_R76_1_2006.tests.find((t) => t.code === row.testCode);
    return {
      testCode: row.testCode,
      rangeIndex: row.rangeIndex ?? 0,
      sequence: row.sequence,
      clause: catalog?.clause ?? null,
      title: catalog?.title ?? null,
      applicability: row.applicability as 'APPLICABLE' | 'NOT_APPLICABLE',
      naReason: row.naReason ?? null,
      verdict: (row.verdict as ReportModelTest['verdict']) ?? null,
      params: null,
      observations: (row.observations as Record<string, unknown>) ?? null,
      result: (row.result as unknown as TestResult) ?? null,
      envStart: (row.envStart as Record<string, unknown>) ?? null,
      envEnd: (row.envEnd as Record<string, unknown>) ?? null,
      completedAt: row.completedAt ? (row.completedAt as Date).toISOString() : null,
      completedByName: row.completedBy ? 'Seed Testing Officer' : null,
      standards: [],
    };
  });

  const modelSnapshot = buildReportModel({
    reportNo,
    version: '1.0',
    lab: {
      code: lab.code,
      name: lab.name,
      address: lab.address,
      state: lab.state,
      accreditationNo: lab.accreditationNo,
    },
    evaluation: { refNo: p.refNo, sampleSerials: [p.sampleSerial], priority: 'normal' },
    applicant: { name: applicant.name, address: applicant.address, country: null },
    manufacturer: {
      name: manufacturer.name,
      address: manufacturer.address,
      country: manufacturer.country,
    },
    instrument: {
      modelName: instrumentModel.modelName,
      modelCode: instrumentModel.instrumentType,
      spec: p.spec as unknown as Record<string, unknown>,
    },
    provenance: {
      rulepackId: OIML_R76_1_2006.id,
      rulepackVersion: OIML_R76_1_2006.version,
      engineVersion: ENGINE_VERSION,
    },
    tests,
    attachments: [],
  });
  const sha256 = modelSha256(modelSnapshot);

  const [versionRow] = await tx
    .insert(reportVersions)
    .values({
      reportId: reportRow.id,
      version: '1.0',
      model: modelSnapshot as unknown as Record<string, unknown>,
      modelSha256: sha256,
      status: 'DRAFT',
      createdBy: p.userIdByRole.TESTING_OFFICER,
      createdAt: p.createdAt,
    })
    .returning({ id: reportVersions.id });
  if (!versionRow) throw new Error('report_versions insert returned no row');

  await tx
    .update(reports)
    .set({ currentVersionId: versionRow.id })
    .where(eq(reports.id, reportRow.id));

  for (const tier of TIERS_APPROVED_BEFORE[p.outcome]) {
    await tx.insert(approvals).values({
      reportVersionId: versionRow.id,
      tier,
      decision: tier === 1 && p.outcome === 'RETURNED' ? 'RETURNED' : 'APPROVED',
      userId: p.userIdByRole[TIER_ROLE[tier]],
      modelSha256: sha256,
      stepUpVerified: true,
      decidedAt: p.createdAt,
    });
  }

  const sealed = p.outcome === 'ISSUED' || p.outcome === 'REVOKED';
  await tx
    .update(evaluations)
    .set({
      status: p.outcome,
      overallVerdict: p.overallVerdict,
      submittedAt: p.createdAt,
      issuedAt: sealed ? p.createdAt : null,
      lockedAt: p.createdAt,
    })
    .where(eq(evaluations.id, p.evaluationId));

  if (!sealed) return;

  await tx
    .update(reportVersions)
    .set({ status: 'SIGNED' })
    .where(eq(reportVersions.id, versionRow.id));

  let certificateNo: string | null = null;
  if (p.overallVerdict === 'CONFORMS') {
    const certSeq = await allocateNumber(tx, p.labId, reportYear, 'CERT');
    certificateNo = `IN-R76-${p.labCode}-${reportYear}-${String(certSeq).padStart(4, '0')}`;
  }

  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  await tx
    .update(reports)
    .set({
      status: p.outcome === 'REVOKED' ? 'REVOKED' : 'ISSUED',
      issuedAt: p.createdAt,
      certificateNo,
      ...(p.outcome === 'REVOKED'
        ? {
            revokedAt: new Date(p.createdAt.getTime() + oneMonthMs),
            revokeReason: 'Synthetic seed: superseded model revision.',
          }
        : {}),
    })
    .where(eq(reports.id, reportRow.id));
}
