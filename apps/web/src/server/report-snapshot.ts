/**
 * Gathers one evaluation into a `ReportModel` (implementation.md §10 P7:
 * "create `reports` row + report v1.0 with `buildReportModel()` snapshot +
 * `model_sha256`").
 *
 * The shaping rules live in `@tula/report`; this module is only the query
 * side. It is deliberately reusable in two places: the submit action, which
 * stores the snapshot as a new `report_versions` row, and the decision
 * action, which rebuilds it from *current* data and compares hashes to catch
 * a stored version that no longer matches the evaluation (§6.3: "any data
 * change invalidates pending approvals").
 */
import {
  applicants,
  attachments,
  type DbTx,
  evaluations,
  evaluationTests,
  instrumentModels,
  labs,
  manufacturers,
  referenceWeightSets,
  user as userTable,
} from '@tula/db';
import type { TestResult } from '@tula/engine';
import {
  buildReportModel,
  modelSha256,
  type ReportModel,
  type ReportModelStandard,
  type ReportModelTest,
} from '@tula/report';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { asc, eq, inArray } from 'drizzle-orm';

const CATALOG = new Map(OIML_R76_1_2006.tests.map((t) => [t.code, t]));

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * `result` is `jsonb` — Postgres does not enforce our TS shape on what comes
 * back out of it, so this narrows on the one field the report model reads
 * structurally (`verdict`) rather than casting the whole thing blind.
 */
function asTestResult(value: unknown): TestResult | null {
  const record = asRecord(value);
  return record && typeof record.verdict === 'string' ? (record as unknown as TestResult) : null;
}

/**
 * Builds the snapshot for `evaluationId` under the given report number and
 * version. Returns null when the evaluation does not exist.
 */
export async function buildSnapshot(
  tx: DbTx,
  evaluationId: string,
  reportNo: string,
  version: string,
): Promise<{ model: ReportModel; sha256: string } | null> {
  const [head] = await tx
    .select({
      evaluation: evaluations,
      lab: labs,
      applicant: applicants,
      manufacturer: manufacturers,
      model: instrumentModels,
    })
    .from(evaluations)
    .innerJoin(labs, eq(evaluations.labId, labs.id))
    .innerJoin(applicants, eq(evaluations.applicantId, applicants.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .where(eq(evaluations.id, evaluationId));
  if (!head) return null;

  const testRows = await tx
    .select()
    .from(evaluationTests)
    .where(eq(evaluationTests.evaluationId, evaluationId))
    .orderBy(asc(evaluationTests.sequence), asc(evaluationTests.rangeIndex));

  const weightSetIds = [...new Set(testRows.flatMap((row) => row.weightSetIds ?? []))];
  const weightSets = weightSetIds.length
    ? await tx
        .select({
          id: referenceWeightSets.id,
          setCode: referenceWeightSets.setCode,
          oimlClass: referenceWeightSets.oimlClass,
          certNo: referenceWeightSets.certNo,
          dueOn: referenceWeightSets.dueOn,
        })
        .from(referenceWeightSets)
        .where(inArray(referenceWeightSets.id, weightSetIds))
    : [];
  const standardById = new Map<string, ReportModelStandard>(
    weightSets.map((set) => [
      set.id,
      {
        setCode: set.setCode,
        oimlClass: set.oimlClass,
        certificateNo: set.certNo,
        dueOn: set.dueOn,
      },
    ]),
  );

  const completerIds = [
    ...new Set(testRows.flatMap((row) => (row.completedBy ? [row.completedBy] : []))),
  ];
  const completers = completerIds.length
    ? await tx
        .select({ id: userTable.id, name: userTable.name })
        .from(userTable)
        .where(inArray(userTable.id, completerIds))
    : [];
  const nameById = new Map(completers.map((row) => [row.id, row.name]));

  const files = await tx
    .select({
      filename: attachments.filename,
      caption: attachments.caption,
      mime: attachments.mime,
      sha256: attachments.sha256,
    })
    .from(attachments)
    .where(eq(attachments.evaluationId, evaluationId));

  const tests: ReportModelTest[] = testRows.map((row) => {
    const catalog = CATALOG.get(row.testCode);
    return {
      testCode: row.testCode,
      rangeIndex: row.rangeIndex,
      sequence: row.sequence,
      clause: catalog?.clause ?? null,
      title: catalog?.title ?? null,
      applicability: row.applicability,
      naReason: row.naReason,
      verdict: (row.verdict as ReportModelTest['verdict']) ?? null,
      params: asRecord(row.params),
      observations: asRecord(row.observations),
      result: asTestResult(row.result),
      envStart: asRecord(row.envStart),
      envEnd: asRecord(row.envEnd),
      completedAt: row.completedAt?.toISOString() ?? null,
      completedByName: row.completedBy ? (nameById.get(row.completedBy) ?? null) : null,
      standards: (row.weightSetIds ?? []).flatMap((id) => {
        const standard = standardById.get(id);
        return standard ? [standard] : [];
      }),
    };
  });

  const model = buildReportModel({
    reportNo,
    version,
    lab: {
      code: head.lab.code,
      name: head.lab.name,
      address: head.lab.address,
      state: head.lab.state,
      accreditationNo: head.lab.accreditationNo,
    },
    evaluation: {
      refNo: head.evaluation.refNo,
      sampleSerials: head.evaluation.sampleSerials,
      priority: head.evaluation.priority,
    },
    applicant: {
      name: head.applicant.name,
      address: head.applicant.address,
      country: null,
    },
    manufacturer: {
      name: head.manufacturer.name,
      address: head.manufacturer.address,
      country: head.manufacturer.country,
    },
    instrument: {
      modelName: head.model.modelName,
      modelCode: head.model.instrumentType,
      spec: head.evaluation.specSnapshot,
    },
    provenance: {
      rulepackId: head.evaluation.rulepackId,
      rulepackVersion: head.evaluation.rulepackVersion,
      engineVersion: head.evaluation.engineVersion,
    },
    tests,
    attachments: files,
  });

  return { model, sha256: modelSha256(model) };
}
