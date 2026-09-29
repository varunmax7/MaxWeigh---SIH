/**
 * `reports.export` (implementation.md §10 P9 "bulk ZIP export job"): fetches
 * every matching report's signed PDF (and DOCX, when built), zips them, and
 * notifies the requester with a download link.
 *
 * The filter → `WHERE` logic here mirrors `apps/web/src/server/queries/
 * reports.ts`'s `reportFilterConditions` — kept in sync by hand, the same
 * precedent `apps/web/src/server/queues.ts`'s comment documents for `QUEUES`
 * (an app is not a workspace package another app can import from).
 */

import type { Db } from '@tula/db';
import {
  evaluations,
  instrumentModels,
  manufacturers,
  notifications,
  reports,
  reportVersions,
} from '@tula/db';
import { reportsFilterSchema } from '@tula/schemas';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import JSZip from 'jszip';
import type { z } from 'zod';
import { logger } from '../logger.js';
import type { Storage } from '../storage.js';

export interface ReportsExportPayload {
  labId: string;
  filters: z.infer<typeof reportsFilterSchema>;
  requestedBy: string;
}

const EXPORT_ROW_CAP = 20_000;

function filterConditions(labId: string, filters: ReportsExportPayload['filters']) {
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
    )`);
  }
  return and(...conditions);
}

export function makeReportsExport(db: Db, storage: Storage) {
  return async function reportsExport(jobs: { data: ReportsExportPayload }[]): Promise<void> {
    for (const job of jobs) {
      const { labId, requestedBy } = job.data;
      const filters = reportsFilterSchema.parse(job.data.filters);

      const rows = await db
        .select({
          reportNo: reports.reportNo,
          pdfKey: reportVersions.pdfKey,
          docxKey: reportVersions.docxKey,
        })
        .from(reports)
        .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
        .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
        .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
        .innerJoin(reportVersions, eq(reports.currentVersionId, reportVersions.id))
        .where(filterConditions(labId, filters))
        .limit(EXPORT_ROW_CAP);

      const zip = new JSZip();
      let fileCount = 0;
      for (const row of rows) {
        if (row.pdfKey) {
          zip.file(`${row.reportNo}.pdf`, await storage.getObject(row.pdfKey));
          fileCount++;
        }
        if (row.docxKey) {
          zip.file(`${row.reportNo}.docx`, await storage.getObject(row.docxKey));
          fileCount++;
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const zipKey = `exports/${crypto.randomUUID()}/reports.zip`;
      await storage.putObject(zipKey, zipBuffer, 'application/zip');

      await db.insert(notifications).values({
        userId: requestedBy,
        type: 'reports.export_ready',
        payload: {
          message: `Your export of ${rows.length} report${rows.length === 1 ? '' : 's'} (${fileCount} files) is ready to download.`,
          zipKey,
          reportCount: rows.length,
        },
      });

      logger.info(
        { labId, reportCount: rows.length, fileCount, zipKey },
        'reports.export: ZIP built',
      );
    }
  };
}
