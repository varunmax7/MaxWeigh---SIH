/**
 * The one deliberately public query in the app (implementation.md §7.5
 * "Public verify", §8.4). Looked up by certificate number *or* report
 * number, since §8.4's QR can encode either. A report that exists but is
 * not yet `ISSUED` (or `REVOKED`) returns null, the same as a report that
 * does not exist at all — the same "don't confirm existence" discipline
 * `assertLabMember` uses internally (§10 P6 Decisions), applied here for a
 * different reason: a public page must never leak that an evaluation is
 * mid-review just because someone guessed or was handed its report number
 * early.
 */
import {
  evaluations,
  instrumentModels,
  labs,
  manufacturers,
  reports,
  reportVersions,
} from '@tula/db';
import { eq, or } from 'drizzle-orm';
import { db } from '@/server/db';

export interface VerifyResult {
  status: 'ISSUED' | 'REVOKED';
  reportNo: string;
  certificateNo: string | null;
  manufacturerName: string;
  modelName: string;
  accuracyClass: string | null;
  max: string | null;
  min: string | null;
  issuedAt: Date | null;
  validUntil: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  labName: string;
  pdfSha256: string | null;
}

function specField(spec: unknown, key: string): string | null {
  if (!spec || typeof spec !== 'object') return null;
  const value = (spec as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function specMax(spec: unknown): string | null {
  if (!spec || typeof spec !== 'object') return null;
  const ranges = (spec as Record<string, unknown>).ranges;
  if (!Array.isArray(ranges)) return null;
  const last = ranges[ranges.length - 1] as Record<string, unknown> | undefined;
  return typeof last?.max === 'string' ? last.max : null;
}

export async function verifyByCertOrReportNo(certOrReportNo: string): Promise<VerifyResult | null> {
  const [row] = await db
    .select({
      status: reports.status,
      reportNo: reports.reportNo,
      certificateNo: reports.certificateNo,
      issuedAt: reports.issuedAt,
      validUntil: reports.validUntil,
      revokedAt: reports.revokedAt,
      revokeReason: reports.revokeReason,
      manufacturerName: manufacturers.name,
      modelName: instrumentModels.modelName,
      specSnapshot: evaluations.specSnapshot,
      labName: labs.name,
      pdfSha256: reportVersions.pdfSha256,
    })
    .from(reports)
    .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .innerJoin(labs, eq(evaluations.labId, labs.id))
    .leftJoin(reportVersions, eq(reports.currentVersionId, reportVersions.id))
    .where(or(eq(reports.certificateNo, certOrReportNo), eq(reports.reportNo, certOrReportNo)));

  if (!row) return null;
  if (row.status !== 'ISSUED' && row.status !== 'REVOKED') return null;

  return {
    status: row.status,
    reportNo: row.reportNo,
    certificateNo: row.certificateNo,
    manufacturerName: row.manufacturerName,
    modelName: row.modelName,
    accuracyClass: specField(row.specSnapshot, 'accuracyClass'),
    max: specMax(row.specSnapshot),
    min: specField(row.specSnapshot, 'min'),
    issuedAt: row.issuedAt,
    validUntil: row.validUntil,
    revokedAt: row.revokedAt,
    revokeReason: row.revokeReason,
    labName: row.labName,
    pdfSha256: row.pdfSha256,
  };
}
