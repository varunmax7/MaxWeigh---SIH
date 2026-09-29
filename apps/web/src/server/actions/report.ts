'use server';

import { createHash, randomBytes } from 'node:crypto';
import { evaluations, labMembers, reports, reportVersions, shareLinks } from '@tula/db';
import {
  createShareLinkInputSchema,
  revokeReportInputSchema,
  revokeShareLinkInputSchema,
} from '@tula/schemas';
import { and, eq } from 'drizzle-orm';
import { ActionError, action } from '@/server/action';
import { db } from '@/server/db';
import { getSession } from '@/server/session';
import { assertStepUp } from '@/server/step-up';
import { presignGetUrl } from '@/server/storage';
import { assertTransition, toEvaluationStatus } from '@/server/workflow';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A share link's token is generated once, hashed for storage (never the raw
 * value — §8.5, and the same discipline §9 uses for env-sensor device
 * keys), and returned to the caller exactly this once. There is no way to
 * recover it later, by design: the officer copies it into the share dialog
 * immediately or creates a new one.
 */
export const createShareLinkAction = action(
  {
    schema: createShareLinkInputSchema,
    permission: 'report.share',
    audit: {
      action: 'report.share_link.create',
      entityType: 'evaluation',
      entityId: (i) => i.evaluationId,
    },
  },
  async ({ evaluationId, expiresInDays }, { tx, assertLabAccess, session }) => {
    const [evaluation] = await tx
      .select({ labId: evaluations.labId })
      .from(evaluations)
      .where(eq(evaluations.id, evaluationId));
    if (!evaluation) throw new ActionError('NOT_FOUND', 'Evaluation not found.');
    await assertLabAccess(evaluation.labId);

    const [report] = await tx.select().from(reports).where(eq(reports.evaluationId, evaluationId));
    if (!report?.currentVersionId) {
      throw new ActionError('NOT_FOUND', 'This evaluation has no report version to share.');
    }

    const token = randomBytes(32).toString('base64url');
    const [created] = await tx
      .insert(shareLinks)
      .values({
        reportVersionId: report.currentVersionId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + expiresInDays * MS_PER_DAY),
        createdBy: session.user.id,
      })
      .returning({ id: shareLinks.id, expiresAt: shareLinks.expiresAt });
    if (!created) throw new Error('share_links insert returned no row');

    return { id: created.id, token, expiresAt: created.expiresAt.toISOString() };
  },
);

export const revokeShareLinkAction = action(
  {
    schema: revokeShareLinkInputSchema,
    permission: 'report.share',
    audit: {
      action: 'report.share_link.revoke',
      entityType: 'share_link',
      entityId: (i) => i.shareLinkId,
    },
  },
  async ({ shareLinkId }, { tx, assertLabAccess }) => {
    const [row] = await tx
      .select({ labId: evaluations.labId })
      .from(shareLinks)
      .innerJoin(reports, eq(shareLinks.reportVersionId, reports.currentVersionId))
      .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
      .where(eq(shareLinks.id, shareLinkId));
    if (!row) throw new ActionError('NOT_FOUND', 'Share link not found.');
    await assertLabAccess(row.labId);

    await tx
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(eq(shareLinks.id, shareLinkId));
    return { id: shareLinkId };
  },
);

/**
 * §8.5 "revoke flow (Controller, TOTP, reason)". `ISSUED --> REVOKED` is
 * the only edge `workflow.ts` gives a sealed report — it cannot be
 * un-revoked, matching a real certificate withdrawal.
 */
export const revokeReportAction = action(
  {
    schema: revokeReportInputSchema,
    permission: 'report.revoke',
    audit: {
      action: 'report.revoke',
      entityType: 'evaluation',
      entityId: (i) => i.evaluationId,
      diff: (i) => ({ reason: i.reason }),
    },
  },
  async ({ evaluationId, reason, totpCode }, { tx, assertLabAccess }) => {
    const [evaluation] = await tx
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, evaluationId));
    if (!evaluation) throw new ActionError('NOT_FOUND', 'Evaluation not found.');
    await assertLabAccess(evaluation.labId);

    const status = toEvaluationStatus(evaluation.status);
    try {
      assertTransition(status, 'REVOKED');
    } catch {
      throw new ActionError('CONFLICT', 'Only an issued evaluation can be revoked.');
    }

    await assertStepUp(totpCode);

    await tx.update(evaluations).set({ status: 'REVOKED' }).where(eq(evaluations.id, evaluationId));
    await tx
      .update(reports)
      .set({ status: 'REVOKED', revokedAt: new Date(), revokeReason: reason })
      .where(and(eq(reports.evaluationId, evaluationId), eq(reports.status, 'ISSUED')));

    return { id: evaluationId };
  },
);

/**
 * Presigned download URLs for the current version's signed PDF and DOCX
 * (§9: "presigned GET URLs, 5 min TTL, issued only after permission
 * check"). A read, not a mutation — same rationale as `listTestEvidenceAction`.
 */
export async function getReportDownloadUrlsAction(evaluationId: string) {
  const session = await getSession();
  if (!session) return null;

  const [membership] = await db
    .select({ userId: labMembers.userId })
    .from(evaluations)
    .innerJoin(labMembers, eq(labMembers.labId, evaluations.labId))
    .where(and(eq(evaluations.id, evaluationId), eq(labMembers.userId, session.user.id)));
  if (!membership) return null;

  const [current] = await db
    .select({ pdfKey: reportVersions.pdfKey, docxKey: reportVersions.docxKey })
    .from(reports)
    .innerJoin(reportVersions, eq(reports.currentVersionId, reportVersions.id))
    .where(eq(reports.evaluationId, evaluationId));
  if (!current) return null;

  return {
    pdfUrl: current.pdfKey ? await presignGetUrl(current.pdfKey) : null,
    docxUrl: current.docxKey ? await presignGetUrl(current.docxKey) : null,
  };
}
