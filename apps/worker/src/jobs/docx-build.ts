/**
 * `docx.build` (implementation.md §8.2): the last step of the render→sign→
 * docx chain. Builds the editable Word copy from the identical stored
 * `ReportModel` the signed PDF was rendered from, uploads it, and is the
 * job that finally tells anyone the certificate is ready — everything
 * before this point is invisible plumbing to the officers involved.
 */

import {
  approvals,
  type Db,
  evaluations,
  insertAuditEntry,
  notifications,
  reports,
  reportVersions,
  user as userTable,
} from '@tula/db';
import { buildReportDocx, type SignatoryEntry } from '@tula/report';
import { reportModelSchema } from '@tula/schemas';
import { and, eq, inArray } from 'drizzle-orm';
import { logger } from '../logger.js';
import type { Storage } from '../storage.js';

export interface DocxBuildPayload {
  reportVersionId: string;
}

export function makeDocxBuild(db: Db, storage: Storage) {
  return async function docxBuild(jobs: { data: DocxBuildPayload }[]): Promise<void> {
    for (const job of jobs) {
      const { reportVersionId } = job.data;

      const [row] = await db
        .select({ report: reports, version: reportVersions, evaluation: evaluations })
        .from(reportVersions)
        .innerJoin(reports, eq(reportVersions.reportId, reports.id))
        .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
        .where(eq(reportVersions.id, reportVersionId));
      if (!row) {
        logger.warn({ reportVersionId }, 'docx.build: report_version not found, skipping');
        continue;
      }
      if (row.version.docxKey) {
        logger.info({ reportVersionId }, 'docx.build: already built, skipping (idempotent)');
        continue;
      }

      const model = reportModelSchema.parse(row.version.model);

      const signedApprovals = await db
        .select({
          tier: approvals.tier,
          userId: approvals.userId,
          decidedAt: approvals.decidedAt,
        })
        .from(approvals)
        .where(
          and(eq(approvals.reportVersionId, reportVersionId), eq(approvals.decision, 'APPROVED')),
        );

      const signerIds = signedApprovals.map((a) => a.userId);
      const signerNames = signerIds.length
        ? await db
            .select({ id: userTable.id, name: userTable.name, designation: userTable.designation })
            .from(userTable)
            .where(inArray(userTable.id, signerIds))
        : [];
      const nameById = new Map(signerNames.map((u) => [u.id, u]));
      const signatories: SignatoryEntry[] = signedApprovals
        .filter((a) => a.tier === 1 || a.tier === 2 || a.tier === 3)
        .map((a) => ({
          tier: a.tier as 1 | 2 | 3,
          name: nameById.get(a.userId)?.name ?? 'Unknown',
          designation: nameById.get(a.userId)?.designation ?? null,
          decidedAt: a.decidedAt.toISOString(),
        }));

      const docxBuffer = await buildReportDocx({
        model,
        modelSha256: row.version.modelSha256,
        certificateNo: row.report.certificateNo,
        issuedAt: row.report.issuedAt?.toISOString() ?? null,
        signatories,
      });

      const docxKey = `reports/${reportVersionId}/report.docx`;
      await storage.putObject(
        docxKey,
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );

      const notifyUserIds = [
        ...new Set(
          [row.evaluation.assignedTesterId, ...signerIds].filter((id): id is string => Boolean(id)),
        ),
      ];

      await db.transaction(async (tx) => {
        await tx
          .update(reportVersions)
          .set({ docxKey })
          .where(eq(reportVersions.id, reportVersionId));

        if (notifyUserIds.length > 0) {
          await tx.insert(notifications).values(
            notifyUserIds.map((userId) => ({
              userId,
              type: 'review.approved' as const,
              payload: {
                evaluationId: row.evaluation.id,
                refNo: row.report.reportNo,
                message: `${row.report.reportNo} is issued — the signed PDF and DOCX are ready to download.`,
              },
            })),
          );
        }

        await insertAuditEntry(tx, {
          actorId: null,
          actorRole: 'SYSTEM',
          labId: row.evaluation.labId,
          action: 'docx.build',
          entityType: 'report_version',
          entityId: reportVersionId,
          diff: { docxBytes: docxBuffer.length },
          ip: null,
          userAgent: null,
        });
      });

      logger.info(
        { reportVersionId, bytes: docxBuffer.length },
        'docx.build: DOCX built, report issued',
      );
    }
  };
}
