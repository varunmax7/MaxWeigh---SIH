import { BadgeCheck, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { verifyByCertOrReportNo } from '@/server/queries/verify';
import { CheckPdfDropzone } from './CheckPdfDropzone';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certNo: string }>;
}): Promise<Metadata> {
  const { certNo } = await params;
  return { title: `Verify ${certNo}` };
}

function fmtDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Public QR verification (implementation.md §7.5, §8.4). No login; no lab
 * scoping — `verifyByCertOrReportNo` is the one query in the app that is
 * deliberately public, and only ever returns an `ISSUED` or `REVOKED`
 * report, never anything mid-review. Rate limiting is deferred to P11's
 * hardening pass (docs/QUESTIONS.md) — this route has no state-changing
 * effect, so the risk in the meantime is enumeration/load, not data
 * exposure beyond what the QR already discloses.
 */
export default async function VerifyPage({ params }: { params: Promise<{ certNo: string }> }) {
  const { certNo } = await params;
  const result = await verifyByCertOrReportNo(certNo);

  if (!result) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">No matching certificate or report</h1>
        <p className="text-muted-foreground">
          "{certNo}" does not match an issued test report or certificate of conformity. Check the
          number and try again.
        </p>
      </main>
    );
  }

  const revoked = result.status === 'REVOKED';

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <div
        className="flex items-center gap-3 rounded-[var(--radius-panel)] border p-4"
        style={
          revoked
            ? { borderColor: 'var(--fail)', backgroundColor: 'var(--fail-bg)' }
            : { borderColor: 'var(--seal)', backgroundColor: 'var(--seal-bg)' }
        }
      >
        {revoked ? (
          <ShieldAlert aria-hidden="true" className="size-6 text-fail" />
        ) : (
          <BadgeCheck aria-hidden="true" className="size-6 text-seal" />
        )}
        <div>
          <p className={`text-lg font-semibold ${revoked ? 'text-fail' : 'text-seal'}`}>
            {revoked ? 'REVOKED' : 'VALID'}
          </p>
          {revoked ? (
            <p className="text-sm text-muted-foreground">
              Revoked {fmtDate(result.revokedAt)}
              {result.revokeReason ? ` — ${result.revokeReason}` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Issued by {result.labName}</p>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4 text-sm">
        <Row label="Report no." value={result.reportNo} mono />
        {result.certificateNo ? (
          <Row label="Certificate no." value={result.certificateNo} mono />
        ) : null}
        <Row label="Manufacturer" value={result.manufacturerName} />
        <Row label="Model" value={result.modelName} />
        {result.accuracyClass ? <Row label="Accuracy class" value={result.accuracyClass} /> : null}
        {result.max ? (
          <Row label="Max / Min" value={`${result.max} g / ${result.min ?? '—'} g`} mono />
        ) : null}
        <Row label="Issue date" value={fmtDate(result.issuedAt)} />
        <Row
          label="Valid until"
          value={result.validUntil ? fmtDate(result.validUntil) : 'Not time-limited'}
        />
        {result.pdfSha256 ? (
          <Row label="PDF SHA-256" value={result.pdfSha256} mono className="break-all text-xs" />
        ) : null}
      </div>

      <CheckPdfDropzone expectedSha256={result.pdfSha256} />
    </main>
  );
}

function Row({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${mono ? 'mono tabular' : ''} ${className ?? ''}`}>{value}</span>
    </div>
  );
}
