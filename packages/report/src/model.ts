/**
 * `buildReportModel()` — the immutable snapshot every report document is
 * rendered from (implementation.md §3.2 principle 5, §8, §10 P7).
 *
 * Two properties matter more than the shape itself:
 *
 * 1. **Determinism.** The model is a pure function of the evaluation's stored
 *    data, with no wall-clock and no iteration-order dependence. §6.3 binds
 *    approvals to `model_sha256` and says "any data change invalidates
 *    pending approvals" — so the hash has to change when, and only when, the
 *    underlying data does. A `generatedAt` field would invalidate every
 *    approval on every rebuild.
 * 2. **Self-containment.** The snapshot carries the spec, the rule pack
 *    id@version, the engine version and the standards used, so a report
 *    rendered years later says exactly what the officers signed, not what
 *    today's master data happens to say.
 */
import { createHash } from 'node:crypto';
import { aggregateEvaluation, type VerdictBearing } from '@tula/engine';
import {
  REPORT_MODEL_VERSION,
  type ReportModel,
  type ReportModelAttachment,
  type ReportModelParty,
  type ReportModelStandard,
  type ReportModelTest,
  reportModelSchema,
} from '@tula/schemas';
import canonicalize from 'canonicalize';

export type {
  ReportModel,
  ReportModelAttachment,
  ReportModelParty,
  ReportModelStandard,
  ReportModelTest,
};
export { REPORT_MODEL_VERSION };

export interface BuildReportModelInput {
  reportNo: string;
  version: string;
  lab: ReportModel['lab'];
  evaluation: { refNo: string; sampleSerials: string[] | null; priority: string };
  applicant: ReportModelParty;
  manufacturer: ReportModelParty;
  instrument: ReportModel['instrument'];
  provenance: ReportModel['provenance'];
  tests: ReportModelTest[];
  attachments: ReportModelAttachment[];
}

/**
 * Sorted by the planner's own sequence, then range — never by the order rows
 * came back from Postgres, which is unspecified without an ORDER BY and would
 * make the hash depend on the query plan.
 */
function sortTests(tests: ReportModelTest[]): ReportModelTest[] {
  return [...tests].sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.rangeIndex - b.rangeIndex ||
      a.testCode.localeCompare(b.testCode),
  );
}

/**
 * Rolls the tests up through the engine's `aggregateEvaluation` rather than
 * counting verdicts here (§11: UI and server code never re-implement a rule).
 * A test that is applicable but has no engine result yet contributes an
 * `INCOMPLETE`, which is what keeps a half-finished evaluation from rolling
 * up to `CONFORMS`.
 */
function buildSummary(tests: ReportModelTest[]): ReportModel['summary'] {
  const byCode: Record<string, VerdictBearing> = {};
  for (const test of tests) {
    const key = test.rangeIndex > 0 ? `${test.testCode}#${test.rangeIndex}` : test.testCode;
    if (test.applicability === 'NOT_APPLICABLE') {
      byCode[key] = { verdict: 'NOT_APPLICABLE' };
      continue;
    }
    byCode[key] = { verdict: test.result?.verdict ?? 'INCOMPLETE' };
  }
  const aggregate = aggregateEvaluation(byCode);
  return {
    overallVerdict: aggregate.verdict,
    rows: [...aggregate.tests].sort((a, b) => a.code.localeCompare(b.code)),
  };
}

/**
 * Builds the immutable snapshot. Pure: same input, same bytes, same hash.
 *
 * Parsed through `reportModelSchema` before returning — not just typed —
 * because everything downstream (the print route, the worker's PDF/DOCX
 * jobs) reads this same shape back out of `report_versions.model`, a
 * `jsonb` column Postgres does not enforce our TS shape on. Validating once,
 * here, at the one place the shape is actually constructed, means a bad
 * snapshot can never be written in the first place.
 */
export function buildReportModel(input: BuildReportModelInput): ReportModel {
  const tests = sortTests(input.tests);
  return reportModelSchema.parse({
    modelVersion: REPORT_MODEL_VERSION,
    reportNo: input.reportNo,
    version: input.version,
    lab: input.lab,
    evaluation: {
      refNo: input.evaluation.refNo,
      sampleSerials: input.evaluation.sampleSerials ?? [],
      priority: input.evaluation.priority,
    },
    applicant: input.applicant,
    manufacturer: input.manufacturer,
    instrument: input.instrument,
    provenance: input.provenance,
    tests,
    summary: buildSummary(tests),
    methodology: tests
      .filter((test) => (test.result?.steps?.length ?? 0) > 0)
      .map((test) => ({
        testCode: test.testCode,
        rangeIndex: test.rangeIndex,
        steps: test.result?.steps ?? [],
      })),
    attachments: [...input.attachments].sort((a, b) => a.sha256.localeCompare(b.sha256)),
  });
}

/**
 * `report_versions.model_sha256`. RFC 8785 canonical JSON first (the same
 * `canonicalize` the audit ledger hashes with), so two structurally equal
 * models hash identically regardless of key insertion order.
 */
export function modelSha256(model: ReportModel): string {
  const canonical = canonicalize(model);
  if (canonical === undefined) {
    throw new TypeError('report model must be JSON-serializable');
  }
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** `1.0` → `1.1` on each return-and-resubmit; `1.x` → `2.0` for a post-issue amendment (§6.3). */
export function nextVersion(current: string | null, kind: 'minor' | 'major'): string {
  if (!current) return '1.0';
  const [majorPart, minorPart] = current.split('.');
  const major = Number(majorPart);
  const minor = Number(minorPart);
  if (!Number.isInteger(major) || !Number.isInteger(minor)) {
    throw new TypeError(`unrecognised report version: ${current}`);
  }
  return kind === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
}
