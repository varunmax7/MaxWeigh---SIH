/**
 * Global search, backing the ⌘K palette (implementation.md §7.4, §10 P9:
 * "⌘K palette wired to search (reports, evaluations, models, manufacturers)").
 *
 * Evaluations and reports are lab-scoped (§11); manufacturers and instrument
 * models are shared master data with no `lab_id` (docs/QUESTIONS.md — same
 * reasoning as `server/queries/masterdata.ts`), so those two searches are not
 * lab-filtered. Every field searched has a `pg_trgm` GIN index (migration
 * 0003, 0006), so a short, misspelled, or partial query still ranks well.
 */
import { evaluations, instrumentModels, manufacturers, reports } from '@tula/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db';

export interface SearchResult {
  id: string;
  kind: 'evaluation' | 'report' | 'model' | 'manufacturer';
  title: string;
  subtitle: string;
  href: string;
}

const RESULTS_PER_KIND = 6;

export async function globalSearch(labId: string | null, q: string): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const [evaluationRows, reportRows, modelRows, manufacturerRows] = await Promise.all([
    labId
      ? db
          .select({ id: evaluations.id, refNo: evaluations.refNo, status: evaluations.status })
          .from(evaluations)
          .where(and(eq(evaluations.labId, labId), sql`${evaluations.refNo} % ${query}`))
          .orderBy(desc(sql`similarity(${evaluations.refNo}, ${query})`))
          .limit(RESULTS_PER_KIND)
      : [],
    labId
      ? db
          .select({
            id: reports.id,
            evaluationId: reports.evaluationId,
            reportNo: reports.reportNo,
            certificateNo: reports.certificateNo,
            status: reports.status,
          })
          .from(reports)
          .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
          .where(
            and(
              eq(evaluations.labId, labId),
              sql`(${reports.reportNo} % ${query} OR coalesce(${reports.certificateNo}, '') % ${query})`,
            ),
          )
          .orderBy(
            desc(
              sql`greatest(similarity(${reports.reportNo}, ${query}), similarity(coalesce(${reports.certificateNo}, ''), ${query}))`,
            ),
          )
          .limit(RESULTS_PER_KIND)
      : [],
    db
      .select({
        id: instrumentModels.id,
        modelName: instrumentModels.modelName,
        manufacturerName: manufacturers.name,
      })
      .from(instrumentModels)
      .innerJoin(manufacturers, eq(instrumentModels.manufacturerId, manufacturers.id))
      .where(sql`${instrumentModels.modelName} % ${query}`)
      .orderBy(desc(sql`similarity(${instrumentModels.modelName}, ${query})`))
      .limit(RESULTS_PER_KIND),
    db
      .select({ id: manufacturers.id, name: manufacturers.name })
      .from(manufacturers)
      .where(sql`${manufacturers.name} % ${query}`)
      .orderBy(desc(sql`similarity(${manufacturers.name}, ${query})`))
      .limit(RESULTS_PER_KIND),
  ]);

  const results: SearchResult[] = [];
  for (const row of evaluationRows) {
    results.push({
      id: row.id,
      kind: 'evaluation',
      title: row.refNo,
      subtitle: row.status.replaceAll('_', ' ').toLowerCase(),
      href: `/evaluations/${row.id}`,
    });
  }
  for (const row of reportRows) {
    results.push({
      id: row.id,
      kind: 'report',
      title: row.reportNo,
      subtitle: row.certificateNo ?? row.status,
      href: `/evaluations/${row.evaluationId}/report`,
    });
  }
  for (const row of modelRows) {
    results.push({
      id: row.id,
      kind: 'model',
      title: row.modelName,
      subtitle: row.manufacturerName,
      href: `/instruments/models/${row.id}`,
    });
  }
  for (const row of manufacturerRows) {
    results.push({
      id: row.id,
      kind: 'manufacturer',
      title: row.name,
      subtitle: 'Manufacturer',
      href: '/instruments',
    });
  }
  return results;
}
