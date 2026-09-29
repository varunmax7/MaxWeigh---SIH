/**
 * Read queries for the Reports repository (implementation.md §5, §7.5,
 * §10 P9): "search (full-text + fuzzy), filters (lab, class, verdict,
 * status, date, manufacturer), columns (report no., certificate no.,
 * manufacturer, model, class, Max, verdict, issued, status)".
 *
 * `q` matches against `report_no`, `certificate_no`, the model name and the
 * manufacturer name via `pg_trgm` similarity (indexes from migration 0003) —
 * not the `evaluations.search` tsvector, which only covers `ref_no`
 * (docs/QUESTIONS.md #18: a stored generated column can't reach columns on
 * joined tables). Trigram similarity gives fuzzy, partial-string matching
 * across all four fields in one ranked query, which is what "full-text +
 * fuzzy" needs here more than word-boundary tsvector matching does.
 */
import {
  applicants,
  evaluations,
  instrumentModels,
  manufacturers,
  reports,
  reportVersions,
} from '@tula/db';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/server/db';

export interface ReportFilters {
  q?: string;
  accuracyClass?: string;
  verdict?: string;
  status?: string;
  manufacturerId?: string;
  issuedFrom?: string;
  issuedTo?: string;
  page: number;
  pageSize: number;
}

/** Every column the repository table and CSV/ZIP export share, kept in one place. */
const reportListColumns = {
  id: reports.id,
  evaluationId: reports.evaluationId,
  reportNo: reports.reportNo,
  certificateNo: reports.certificateNo,
  status: reports.status,
  issuedAt: reports.issuedAt,
  overallVerdict: evaluations.overallVerdict,
  accuracyClass: sql<string>`${evaluations.specSnapshot}->>'accuracyClass'`,
  maxLoadG: sql<string>`${evaluations.specSnapshot}->'ranges'->-1->>'max'`,
  manufacturerName: manufacturers.name,
  manufacturerId: manufacturers.id,
  modelName: instrumentModels.modelName,
  applicantName: applicants.name,
  currentVersionId: reports.currentVersionId,
};

/** Shared `WHERE`, so the paginated list and the unpaginated CSV/ZIP export can never drift. */
export function reportFilterConditions(labId: string, filters: ReportFilters) {
  const conditions = [eq(evaluations.labId, labId)];
  if (filters.status) conditions.push(eq(reports.status, filters.status));
  if (filters.verdict) conditions.push(eq(evaluations.overallVerdict, filters.verdict));
  if (filters.manufacturerId) conditions.push(eq(manufacturers.id, filters.manufacturerId));
  if (filters.accuracyClass) {
    conditions.push(sql`${evaluations.specSnapshot}->>'accuracyClass' = ${filters.accuracyClass}`);
  }
  if (filters.issuedFrom) conditions.push(gte(reports.issuedAt, new Date(filters.issuedFrom)));
  if (filters.issuedTo) conditions.push(lte(reports.issuedAt, new Date(filters.issuedTo)));
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    conditions.push(sql`(
      ${reports.reportNo} % ${q}
      OR coalesce(${reports.certificateNo}, '') % ${q}
      OR ${manufacturers.name} % ${q}
      OR ${instrumentModels.modelName} % ${q}
      OR ${reports.reportNo} ilike ${`%${q}%`}
      OR coalesce(${reports.certificateNo}, '') ilike ${`%${q}%`}
    )`);
  }
  return and(...conditions);
}

function baseQuery() {
  return db
    .select(reportListColumns)
    .from(reports)
    .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .innerJoin(applicants, eq(evaluations.applicantId, applicants.id));
}

/** Paginated, filtered, ranked reports list (§7.5 "Reports repository"). */
export async function listReports(labId: string, filters: ReportFilters) {
  const where = reportFilterConditions(labId, filters);
  const q = filters.q?.trim();

  const [rows, totalRows] = await Promise.all([
    baseQuery()
      .where(where)
      .orderBy(
        q
          ? desc(sql`greatest(
              similarity(${reports.reportNo}, ${q}),
              similarity(coalesce(${reports.certificateNo}, ''), ${q}),
              similarity(${manufacturers.name}, ${q}),
              similarity(${instrumentModels.modelName}, ${q})
            )`)
          : desc(reports.issuedAt),
      )
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db
      .select({ total: count() })
      .from(reports)
      .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
      .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
      .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
      .innerJoin(applicants, eq(evaluations.applicantId, applicants.id))
      .where(where),
  ]);

  return { rows, total: totalRows[0]?.total ?? 0 };
}

/** Every matching row, unpaginated — for CSV export and the bulk ZIP export job. Capped: exports aren't unbounded. */
const EXPORT_ROW_CAP = 20_000;

export async function listReportsForExport(
  labId: string,
  filters: Omit<ReportFilters, 'page' | 'pageSize'>,
) {
  const where = reportFilterConditions(labId, { ...filters, page: 1, pageSize: 0 });
  return baseQuery().where(where).orderBy(desc(reports.issuedAt)).limit(EXPORT_ROW_CAP);
}

/** The signed PDF's storage key for every matching, issued report — the ZIP export job's input. */
export async function listReportPdfKeysForExport(
  labId: string,
  filters: Omit<ReportFilters, 'page' | 'pageSize'>,
) {
  const where = reportFilterConditions(labId, { ...filters, page: 1, pageSize: 0 });
  return db
    .select({
      reportNo: reports.reportNo,
      pdfKey: reportVersions.pdfKey,
    })
    .from(reports)
    .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .innerJoin(applicants, eq(evaluations.applicantId, applicants.id))
    .innerJoin(reportVersions, eq(reports.currentVersionId, reportVersions.id))
    .where(where)
    .limit(EXPORT_ROW_CAP);
}
