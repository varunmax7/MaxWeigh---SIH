import { OIML_R76_1_2006 } from '@tula/rulepacks';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  CalcExplainer,
  StatusChip,
  type StatusChipValue,
  VerdictChip,
  type VerdictChipValue,
} from '@/components/metrology';
import { CommentThread } from '@/components/metrology/CommentThread';
import { ReviewDecisionPanel } from '@/components/metrology/ReviewDecisionPanel';
import { SignatoryChain } from '@/components/metrology/SignatoryChain';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { assertLabMember } from '@/server/lab-access';
import { getEvaluationOverview } from '@/server/queries/evaluations';
import {
  getReportForEvaluation,
  labSlaHours,
  listApprovals,
  listComments,
  listTestsForReview,
} from '@/server/queries/review';
import { requireSession } from '@/server/session';
import { pendingTier, TIER_APPROVE_VERB, TIER_ROLE, toEvaluationStatus } from '@/server/workflow';
import { VersionTimeline } from './VersionTimeline';

const CATALOG_BY_CODE = new Map(OIML_R76_1_2006.tests.map((t) => [t.code, t]));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const evaluation = await getEvaluationOverview(id);
  return { title: evaluation ? `Review — ${evaluation.refNo}` : 'Review' };
}

/**
 * The review screen (implementation.md §7.5): read-only per-test summary
 * with each row's own "Show calculation" trail, comment threads, the
 * signatory chain, version history, and the decision block for whichever
 * tier is currently pending. Full per-test detail (the observation grid, the
 * error envelope) is one click away at that test's own execute page — which
 * is already read-only from `PENDING_T1` onward (§6.3 "Locking"), so there is
 * nothing this screen needs to re-render, only to link to.
 */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: evaluationId } = await params;

  const evaluation = await getEvaluationOverview(evaluationId);
  if (!evaluation) notFound();
  await assertLabMember(session.user.id, evaluation.labId);

  const reportData = await getReportForEvaluation(evaluationId);
  if (!reportData?.current) notFound();
  const { versions, current } = reportData;

  const [tests, approvals, comments, sla] = await Promise.all([
    listTestsForReview(evaluationId),
    listApprovals(current.id),
    listComments(evaluationId),
    labSlaHours(evaluation.labId),
  ]);

  const status = toEvaluationStatus(evaluation.status);
  const tier = pendingTier(status);
  // §6.2 gives each tier's decision to exactly one role, so `TIER_ROLE` alone
  // is enough to decide whether the decision block belongs to this viewer —
  // the tier-decision action re-checks the real permission regardless.
  const canDecide = tier !== null && session.user.role === TIER_ROLE[tier];

  const applicableTests = tests.filter((t) => t.applicability === 'APPLICABLE');

  const signatoryEntries = approvals
    .filter((a) => a.decision === 'APPROVED' || a.tier === tier)
    .map((a) => ({
      tier: a.tier as 1 | 2 | 3,
      decision: a.decision as 'APPROVED' | 'RETURNED',
      userName: a.userName,
      decidedAt: a.decidedAt,
    }));

  const testLabel = (testId: string): string => {
    const test = tests.find((t) => t.id === testId);
    if (!test) return 'Unknown test';
    const title = CATALOG_BY_CODE.get(test.testCode)?.title ?? test.testCode;
    return test.rangeIndex > 0 ? `${title} (range ${test.rangeIndex + 1})` : title;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Review — ${evaluation.refNo}`}
        description={`${evaluation.manufacturerName} · ${evaluation.modelName} · v${current.version}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={evaluation.status as StatusChipValue} />
            {evaluation.overallVerdict ? (
              <VerdictChip verdict={evaluation.overallVerdict as VerdictChipValue} />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Test summary</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clause</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Completed by</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicableTests.map((test) => {
                  const catalog = CATALOG_BY_CODE.get(test.testCode);
                  return (
                    <TableRow key={test.id}>
                      <TableCell className="tabular">{catalog?.clause ?? '—'}</TableCell>
                      <TableCell>
                        <a
                          href={`/evaluations/${evaluationId}/execute/${test.testCode}?range=${test.rangeIndex}`}
                          className="underline decoration-dotted hover:decoration-solid"
                        >
                          {catalog?.title ?? test.testCode}
                          {test.rangeIndex > 0 ? ` (range ${test.rangeIndex + 1})` : ''}
                        </a>
                      </TableCell>
                      <TableCell>
                        {test.verdict ? (
                          <VerdictChip verdict={test.verdict as VerdictChipValue} />
                        ) : (
                          <StatusChip status={test.status as StatusChipValue} />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {test.completedByName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <CalcExplainer steps={test.steps} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Version history</p>
            <VersionTimeline versions={versions} currentVersionId={current.id} slaHours={sla} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Comments</p>
            <CommentThread
              evaluationId={evaluationId}
              comments={comments}
              canWrite={session.user.role !== 'AUDITOR'}
              anchors={applicableTests.map((t) => ({ testId: t.id, label: testLabel(t.id) }))}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4">
            <p className="text-sm font-medium">Signatory chain</p>
            <SignatoryChain entries={signatoryEntries} />
          </div>

          {tier !== null && canDecide ? (
            <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4">
              <p className="text-sm font-medium">Decision — {TIER_APPROVE_VERB[tier]}</p>
              <p className="text-xs text-muted-foreground">
                Against report version {current.version} (hash {current.modelSha256.slice(0, 12)}
                …).
              </p>
              <ReviewDecisionPanel
                evaluationId={evaluationId}
                tier={tier}
                modelSha256={current.modelSha256}
                approveVerb={TIER_APPROVE_VERB[tier]}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
