import { createHash } from 'node:crypto';
import { insertAuditEntry, reports, reportVersions, shareLinks } from '@tula/db';
import { ReportDocument } from '@tula/report';
import { reportModelSchema } from '@tula/schemas';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { getPrintSignatories, getPrintVersionHistory } from '@/server/queries/print';

export const metadata: Metadata = {
  title: 'Shared report',
  robots: { index: false, follow: false },
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A secure share link's landing page (implementation.md §8.5): expiring,
 * read-only, single report version, "every access audited." Renders the
 * exact same `ReportDocument` the print route does, directly — a share
 * link is its own form of authorization (the token itself, not a print
 * token or a session), so it does not need to go through `/print` at all.
 */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const [link] = await db
    .select({ link: shareLinks, report: reports, version: reportVersions })
    .from(shareLinks)
    .innerJoin(reportVersions, eq(shareLinks.reportVersionId, reportVersions.id))
    .innerJoin(reports, eq(reportVersions.reportId, reports.id))
    .where(eq(shareLinks.tokenHash, tokenHash));

  if (!link || link.link.revokedAt || link.link.expiresAt.getTime() < Date.now()) {
    notFound();
  }

  await db.transaction((tx) =>
    insertAuditEntry(tx, {
      actorId: null,
      actorRole: 'PUBLIC',
      labId: null,
      action: 'report.share_link.access',
      entityType: 'share_link',
      entityId: link.link.id,
      diff: null,
      ip: null,
      userAgent: null,
    }),
  );

  const model = reportModelSchema.parse(link.version.model);
  const [signatoryRows, versions] = await Promise.all([
    getPrintSignatories(link.version.id),
    getPrintVersionHistory(link.report.id),
  ]);
  const signatories = signatoryRows.map((s) => ({
    tier: s.tier,
    name: s.userName,
    designation: s.userDesignation,
    decidedAt: s.decidedAt.toISOString(),
  }));

  return (
    <ReportDocument
      model={model}
      modelSha256={link.version.modelSha256}
      sealed={signatories.some((s) => s.tier === 3)}
      certificateNo={link.report.certificateNo}
      issuedAt={link.report.issuedAt?.toISOString() ?? null}
      signatories={signatories}
      versions={versions}
    />
  );
}
