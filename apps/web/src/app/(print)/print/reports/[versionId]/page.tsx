import { env } from '@tula/config';
import { CertificateDocument, ReportDocument } from '@tula/report';
import { reportModelSchema } from '@tula/schemas';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { verifyPrintToken } from '@/server/print-token';
import {
  getPrintReportVersion,
  getPrintSignatories,
  getPrintVersionHistory,
} from '@/server/queries/print';
import { buildVerifyQrDataUrl } from '@/server/verify-qr';

export const metadata: Metadata = { title: 'Report', robots: { index: false, follow: false } };

/**
 * The print route (implementation.md §8.2): the *only* place a report or
 * certificate is rendered. The worker's `report.render` job captures this
 * exact page as a PDF; the Report view page (§7.5) embeds this exact page
 * in an `<iframe>` for the live preview — "previews always go through the
 * same route." `?doc=certificate` renders the certificate of conformity
 * instead of the test report, both gated by the same token.
 *
 * Token-protected, not session-protected (§8.2): the worker has no session
 * to check, so the short-lived HMAC token itself is the authorization. A
 * missing or expired token 404s rather than redirecting to login — there is
 * nowhere to log in *to* here.
 */
export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>;
  searchParams: Promise<{ token?: string; doc?: string }>;
}) {
  const { versionId } = await params;
  const { token, doc } = await searchParams;
  const config = env();

  if (!token || !verifyPrintToken(config.PRINT_TOKEN_SECRET, versionId, token)) {
    notFound();
  }

  const row = await getPrintReportVersion(versionId);
  if (!row) notFound();

  const model = reportModelSchema.parse(row.version.model);
  const issuedAt = row.report.issuedAt?.toISOString() ?? null;

  const signatoryRows = await getPrintSignatories(versionId);
  const signatories = signatoryRows.map((s) => ({
    tier: s.tier,
    name: s.userName,
    designation: s.userDesignation,
    decidedAt: s.decidedAt.toISOString(),
  }));
  const sealed = signatories.some((s) => s.tier === 3);

  if (doc === 'certificate') {
    if (!row.report.certificateNo) notFound();
    const qrDataUrl = await buildVerifyQrDataUrl(
      config.APP_URL,
      row.report.certificateNo,
      row.version.modelSha256,
    );
    return (
      <CertificateDocument
        model={model}
        modelSha256={row.version.modelSha256}
        certificateNo={row.report.certificateNo}
        issuedAt={issuedAt}
        validUntil={row.report.validUntil?.toISOString() ?? null}
        signatories={signatories}
        qrDataUrl={qrDataUrl}
      />
    );
  }

  const versions = await getPrintVersionHistory(row.report.id);
  const qrDataUrl = await buildVerifyQrDataUrl(
    config.APP_URL,
    row.report.certificateNo ?? row.report.reportNo,
    row.version.modelSha256,
  );

  return (
    <ReportDocument
      model={model}
      modelSha256={row.version.modelSha256}
      sealed={sealed}
      certificateNo={row.report.certificateNo}
      issuedAt={issuedAt}
      signatories={signatories}
      versions={versions}
      qrDataUrl={qrDataUrl}
    />
  );
}
