/**
 * `report.render` (implementation.md §8.2): fetches the token-gated print
 * route with a real headless browser and captures a paginated PDF — the
 * *only* place in the pipeline that renders anything, so the PDF and the
 * DOCX (`docx-build.ts`, built straight from the stored model) can never
 * show different content: both start from the exact same
 * `report_versions.model` snapshot, never a live query.
 */

import type { Env } from '@tula/config';
import { type Db, evaluations, insertAuditEntry, reports, reportVersions } from '@tula/db';
import { eq } from 'drizzle-orm';
import type { Browser } from 'playwright';
import { logger } from '../logger.js';
import { mintPrintToken } from '../print-token.js';
import { QUEUES } from '../queues.js';
import type { Storage } from '../storage.js';

export interface ReportRenderPayload {
  reportVersionId: string;
}

const RENDER_TIMEOUT_MS = 30_000;

function footerTemplate(reportNo: string, version: string, modelSha256: string): string {
  const shortHash = modelSha256.slice(0, 16);
  return `
    <div style="font-size:7px; width:100%; padding:0 16mm; display:flex; justify-content:space-between; color:#5a6378;">
      <span>${reportNo} v${version}</span>
      <span>${shortHash}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `;
}

export function makeReportRender(
  db: Db,
  storage: Storage,
  config: Env,
  enqueue: (queue: string, data: Record<string, unknown>) => Promise<string | null>,
  getBrowser: () => Promise<Browser>,
) {
  return async function reportRender(jobs: { data: ReportRenderPayload }[]): Promise<void> {
    for (const job of jobs) {
      const { reportVersionId } = job.data;

      const [row] = await db
        .select({
          version: reportVersions,
          reportNo: reports.reportNo,
          labId: evaluations.labId,
        })
        .from(reportVersions)
        .innerJoin(reports, eq(reportVersions.reportId, reports.id))
        .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
        .where(eq(reportVersions.id, reportVersionId));

      if (!row) {
        logger.warn({ reportVersionId }, 'report.render: report_version not found, skipping');
        continue;
      }
      if (row.version.status === 'SIGNED') {
        logger.info({ reportVersionId }, 'report.render: already signed, skipping (idempotent)');
        continue;
      }

      const token = mintPrintToken(config.PRINT_TOKEN_SECRET, reportVersionId);
      const url = `${config.APP_URL}/print/reports/${reportVersionId}?token=${token}`;

      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: RENDER_TIMEOUT_MS });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: footerTemplate(
            row.reportNo,
            row.version.version,
            row.version.modelSha256,
          ),
        });

        const unsignedKey = `reports/${reportVersionId}/unsigned.pdf`;
        await storage.putObject(unsignedKey, pdf, 'application/pdf');

        await enqueue(QUEUES.reportSign, { reportVersionId, unsignedKey });

        await db.transaction((tx) =>
          insertAuditEntry(tx, {
            actorId: null,
            actorRole: 'SYSTEM',
            labId: row.labId,
            action: 'report.render',
            entityType: 'report_version',
            entityId: reportVersionId,
            diff: { pdfBytes: pdf.length },
            ip: null,
            userAgent: null,
          }),
        );

        logger.info({ reportVersionId, bytes: pdf.length }, 'report.render: PDF captured');
      } finally {
        await page.close();
      }
    }
  };
}
