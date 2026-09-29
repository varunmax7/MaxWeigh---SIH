/**
 * `report.sign` (implementation.md §8.2, §8.3): PAdES-signs the captured
 * PDF with the lab's P12 certificate and records its hash. This is the one
 * place `report_versions.status` becomes `SIGNED` — the fact this job
 * checks (`checkNotLocked`'s server-side counterpart has nothing to
 * enforce here; this *is* the authority) — and where `reports.status`
 * becomes `ISSUED`, matching the sequence diagram's own last step, not the
 * Tier 3 approval itself (`evaluations.status` already moved to `ISSUED`
 * synchronously at that click — see `tier-decision.ts`'s Decision note).
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import { type Env, resolveFromRoot } from '@tula/config';
import { type Db, insertAuditEntry, reports, reportVersions } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import { logger } from '../logger.js';
import { QUEUES } from '../queues.js';
import type { Storage } from '../storage.js';

export interface ReportSignPayload {
  reportVersionId: string;
  unsignedKey: string;
}

export function makeReportSign(
  db: Db,
  storage: Storage,
  config: Env,
  enqueue: (queue: string, data: Record<string, unknown>) => Promise<string | null>,
) {
  return async function reportSign(jobs: { data: ReportSignPayload }[]): Promise<void> {
    if (!config.SIGNING_P12_PATH || !config.SIGNING_P12_PASSWORD) {
      throw new Error(
        'report.sign: SIGNING_P12_PATH/SIGNING_P12_PASSWORD are not configured — run scripts/gen-dev-cert.sh',
      );
    }

    for (const job of jobs) {
      const { reportVersionId, unsignedKey } = job.data;

      const [row] = await db
        .select({ report: reports, version: reportVersions })
        .from(reportVersions)
        .innerJoin(reports, eq(reportVersions.reportId, reports.id))
        .where(eq(reportVersions.id, reportVersionId));
      if (!row) {
        logger.warn({ reportVersionId }, 'report.sign: report_version not found, skipping');
        continue;
      }
      if (row.version.status === 'SIGNED') {
        logger.info({ reportVersionId }, 'report.sign: already signed, skipping (idempotent)');
        continue;
      }

      const unsignedPdf = await storage.getObject(unsignedKey);
      const p12Buffer = await readFile(resolveFromRoot(config.SIGNING_P12_PATH));

      const withPlaceholder = plainAddPlaceholder({
        pdfBuffer: unsignedPdf,
        reason: 'Type evaluation test report sealed by the issuing laboratory',
        contactInfo: config.APP_URL,
        name: row.report.reportNo,
        location: 'India',
      });
      const signer = new P12Signer(p12Buffer, { passphrase: config.SIGNING_P12_PASSWORD });
      const signedPdf = await new SignPdf().sign(withPlaceholder, signer);
      const pdfSha256 = createHash('sha256').update(signedPdf).digest('hex');

      const pdfKey = `reports/${reportVersionId}/report.pdf`;
      await storage.putObject(pdfKey, signedPdf, 'application/pdf');

      await db.transaction(async (tx) => {
        await tx
          .update(reportVersions)
          .set({ pdfKey, pdfSha256, status: 'SIGNED' })
          .where(eq(reportVersions.id, reportVersionId));

        // Only this exact version's report row: an amendment (a later,
        // higher version) must not resurrect an older `reports.status` back
        // to ISSUED out of order if jobs are ever retried out of sequence.
        await tx
          .update(reports)
          .set({ status: 'ISSUED', issuedAt: new Date() })
          .where(and(eq(reports.id, row.report.id), eq(reports.currentVersionId, reportVersionId)));

        await insertAuditEntry(tx, {
          actorId: null,
          actorRole: 'SYSTEM',
          labId: null,
          action: 'report.sign',
          entityType: 'report_version',
          entityId: reportVersionId,
          diff: { pdfSha256 },
          ip: null,
          userAgent: null,
        });
      });

      await enqueue(QUEUES.docxBuild, { reportVersionId });

      logger.info({ reportVersionId, pdfSha256 }, 'report.sign: PDF signed');
    }
  };
}
