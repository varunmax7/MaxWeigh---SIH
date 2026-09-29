/**
 * The `ReportModel` schema (implementation.md §8.1, §10 P8) — the immutable
 * snapshot every rendered document (PDF, DOCX, the live preview) is built
 * from. Lives here, not in `@tula/report`, per §3.3's repo layout ("schemas:
 * Zod... report model...") — `@tula/report`'s `buildReportModel()` produces
 * a value of this exact shape (`z.infer<typeof reportModelSchema>` *is* its
 * `ReportModel` type), and the print route re-validates the stored `jsonb`
 * against this schema before rendering anything from it, the same way
 * `evaluations.spec_snapshot` is re-parsed rather than cast (§11: Postgres
 * does not enforce our TS shape on data read back out of `jsonb`).
 */
import { z } from 'zod';
import { decSchema } from './primitives.js';

export const REPORT_MODEL_VERSION = 1 as const;

export const verdictSchema = z.enum(['PASS', 'FAIL', 'INCOMPLETE', 'NOT_APPLICABLE']);
export const severitySchema = z.enum(['error', 'warning', 'info']);

/** Mirrors `@tula/engine`'s `Issue` — kept in sync by hand (the engine has zero internal imports). */
export const issueSchema = z.object({
  code: z.string(),
  severity: severitySchema,
  clause: z.string().optional(),
  path: z.string().optional(),
  params: z.record(z.string(), z.string()),
});

/** Mirrors `@tula/engine`'s `CalcStep` — the "Show calculation" trail and the methodology annex. */
export const calcStepSchema = z.object({
  label: z.string(),
  formula: z.string(),
  substituted: z.string(),
  result: z.string(),
  clause: z.string().optional(),
});

/** Mirrors `@tula/engine`'s `RowResult`. */
export const rowResultSchema = z.object({
  rowId: z.string(),
  P: decSchema.optional(),
  E: decSchema.optional(),
  Ec: decSchema.optional(),
  EcInE: decSchema.optional(),
  mpe: decSchema.optional(),
  mpeInE: decSchema.optional(),
  verdict: verdictSchema,
  issues: z.array(issueSchema),
  steps: z.array(calcStepSchema).optional(),
});

/** Mirrors `@tula/engine`'s `TestResult` — the server engine's persisted, authoritative run. */
export const testResultSchema = z.object({
  verdict: verdictSchema,
  rows: z.array(rowResultSchema),
  summary: z.record(z.string(), z.union([decSchema, z.string()])),
  issues: z.array(issueSchema),
  steps: z.array(calcStepSchema),
  engineVersion: z.string(),
  rulepack: z.object({ id: z.string(), version: z.string() }),
});

export const reportModelLabSchema = z.object({
  code: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  state: z.string().nullable(),
  accreditationNo: z.string().nullable(),
});

export const reportModelPartySchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
  country: z.string().nullable(),
});

export const reportModelStandardSchema = z.object({
  setCode: z.string(),
  oimlClass: z.string(),
  certificateNo: z.string().nullable(),
  dueOn: z.string().nullable(),
});

export const reportModelTestSchema = z.object({
  testCode: z.string(),
  rangeIndex: z.number().int().nonnegative(),
  sequence: z.number().int(),
  clause: z.string().nullable(),
  title: z.string().nullable(),
  applicability: z.string(),
  naReason: z.string().nullable(),
  verdict: verdictSchema.nullable(),
  params: z.record(z.string(), z.unknown()).nullable(),
  observations: z.record(z.string(), z.unknown()).nullable(),
  result: testResultSchema.nullable(),
  envStart: z.record(z.string(), z.unknown()).nullable(),
  envEnd: z.record(z.string(), z.unknown()).nullable(),
  /** ISO 8601, or null while the test is still open. */
  completedAt: z.string().nullable(),
  completedByName: z.string().nullable(),
  standards: z.array(reportModelStandardSchema),
});

export const reportModelAttachmentSchema = z.object({
  filename: z.string(),
  caption: z.string().nullable(),
  mime: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const reportModelSchema = z.object({
  modelVersion: z.literal(REPORT_MODEL_VERSION),
  reportNo: z.string(),
  version: z.string(),
  lab: reportModelLabSchema,
  evaluation: z.object({
    refNo: z.string(),
    sampleSerials: z.array(z.string()),
    priority: z.string(),
  }),
  applicant: reportModelPartySchema,
  manufacturer: reportModelPartySchema,
  instrument: z.object({
    modelName: z.string(),
    modelCode: z.string().nullable(),
    spec: z.record(z.string(), z.unknown()),
  }),
  provenance: z.object({
    rulepackId: z.string(),
    rulepackVersion: z.string(),
    engineVersion: z.string(),
  }),
  tests: z.array(reportModelTestSchema),
  summary: z.object({
    overallVerdict: z.string(),
    rows: z.array(z.object({ code: z.string(), verdict: verdictSchema })),
  }),
  /** §8.1 item 8: the methodology annex, generated from the engine's own `CalcStep`s. */
  methodology: z.array(
    z.object({
      testCode: z.string(),
      rangeIndex: z.number().int().nonnegative(),
      steps: z.array(calcStepSchema),
    }),
  ),
  attachments: z.array(reportModelAttachmentSchema),
});

/** §8.5 "Secure share links": expiring, read-only, single report version. */
export const createShareLinkInputSchema = z.object({
  evaluationId: z.uuid(),
  /** 1–30 days; §8.5's stated default is 7. */
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const revokeShareLinkInputSchema = z.object({
  shareLinkId: z.uuid(),
});

/** §8.5 "revoke flow (Controller, TOTP, reason)". */
export const revokeReportInputSchema = z.object({
  evaluationId: z.uuid(),
  reason: z.string().trim().min(1),
  totpCode: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

export type ReportModel = z.infer<typeof reportModelSchema>;
export type ReportModelLab = z.infer<typeof reportModelLabSchema>;
export type ReportModelParty = z.infer<typeof reportModelPartySchema>;
export type ReportModelTest = z.infer<typeof reportModelTestSchema>;
export type ReportModelStandard = z.infer<typeof reportModelStandardSchema>;
export type ReportModelAttachment = z.infer<typeof reportModelAttachmentSchema>;
export type TestResultModel = z.infer<typeof testResultSchema>;
export type CalcStepModel = z.infer<typeof calcStepSchema>;
