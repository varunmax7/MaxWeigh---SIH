import { env } from '@tula/config';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  StatusChip,
  type StatusChipValue,
  VerdictChip,
  type VerdictChipValue,
} from '@/components/metrology';
import { SignatoryChain } from '@/components/metrology/SignatoryChain';
import { PageHeader } from '@/components/shell/PageHeader';
import { assertLabMember } from '@/server/lab-access';
import { mintPrintToken } from '@/server/print-token';
import { getEvaluationOverview } from '@/server/queries/evaluations';
import { getReportForEvaluation, listApprovals, listShareLinks } from '@/server/queries/review';
import { can } from '@/server/rbac';
import { requireSession } from '@/server/session';
import { VersionTimeline } from '../review/VersionTimeline';
import { DownloadButtons } from './DownloadButtons';
import { RevokeReportButton } from './RevokeReportButton';
import { ShareLinkPanel } from './ShareLinkPanel';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const evaluation = await getEvaluationOverview(id);
  return { title: evaluation ? `Report — ${evaluation.refNo}` : 'Report' };
}

/**
 * The Report view (implementation.md §7.5): metadata, signatory chain,
 * version history, a live A4 preview through the same route the PDF uses,
 * downloads, and (Controller only) revocation. Only reachable once a report
 * exists at all — `hasReport` on the evaluation overview page is what links
 * here, the same gate the Review screen uses.
 */
export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: evaluationId } = await params;

  const evaluation = await getEvaluationOverview(evaluationId);
  if (!evaluation) notFound();
  await assertLabMember(session.user.id, evaluation.labId);

  const reportData = await getReportForEvaluation(evaluationId);
  if (!reportData?.current) notFound();
  const { report, versions, current } = reportData;

  const [approvals, shareLinkRows] = await Promise.all([
    listApprovals(current.id),
    listShareLinks(report.id),
  ]);

  const signatoryEntries = approvals
    .filter((a) => a.decision === 'APPROVED')
    .map((a) => ({
      tier: a.tier as 1 | 2 | 3,
      decision: 'APPROVED' as const,
      userName: a.userName,
      decidedAt: a.decidedAt,
    }));

  const config = env();
  const previewToken = mintPrintToken(config.PRINT_TOKEN_SECRET, current.id, 300);
  const previewSrc = `/print/reports/${current.id}?token=${previewToken}`;

  const ready = current.status === 'SIGNED' && Boolean(current.pdfKey);
  const canRevoke = can(session.user.role, 'report.revoke') && report.status === 'ISSUED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Report — ${evaluation.refNo}`}
        description={`${evaluation.manufacturerName} · ${evaluation.modelName} · v${current.version}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={report.status as StatusChipValue} />
            {evaluation.overallVerdict ? (
              <VerdictChip verdict={evaluation.overallVerdict as VerdictChipValue} />
            ) : null}
            {canRevoke ? <RevokeReportButton evaluationId={evaluationId} /> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4 text-sm">
            <Row label="Report no." value={report.reportNo} />
            {report.certificateNo ? (
              <Row label="Certificate no." value={report.certificateNo} />
            ) : null}
            <Row
              label="Issue date"
              value={report.issuedAt ? report.issuedAt.toISOString().slice(0, 10) : '—'}
            />
            <Row
              label="Rule pack"
              value={`${evaluation.rulepackId}@${evaluation.rulepackVersion}`}
            />
          </div>

          <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4">
            <p className="text-sm font-medium">Signatory chain</p>
            <SignatoryChain entries={signatoryEntries} />
          </div>

          <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4">
            <p className="text-sm font-medium">Downloads</p>
            <DownloadButtons evaluationId={evaluationId} ready={ready} />
          </div>

          <div className="rounded-[var(--radius-panel)] border border-border p-4">
            <ShareLinkPanel evaluationId={evaluationId} links={shareLinkRows} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Version history</p>
            <VersionTimeline versions={versions} currentVersionId={current.id} slaHours={48} />
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-muted">
          <iframe src={previewSrc} title="Report preview" className="h-[80vh] w-full border-0" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="mono text-right">{value}</span>
    </div>
  );
}
