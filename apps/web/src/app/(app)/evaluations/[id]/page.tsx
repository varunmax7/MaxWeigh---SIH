import { instrumentMetrologySchema } from '@tula/schemas';
import { Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClassBadge, StatusChip, type StatusChipValue } from '@/components/metrology';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { assertLabMember } from '@/server/lab-access';
import {
  getEvaluationOverview,
  listEvaluationHistory,
  listEvaluationTests,
} from '@/server/queries/evaluations';
import { requireSession } from '@/server/session';
import { CancelEvaluationButton } from './CancelEvaluationButton';
import { HistoryTab } from './HistoryTab';
import { InstrumentTab } from './InstrumentTab';
import { OverviewTab } from './OverviewTab';
import { TestPlanTab } from './TestPlanTab';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const evaluation = await getEvaluationOverview(id);
  return { title: evaluation?.refNo ?? 'Evaluation' };
}

/** implementation.md §7.5 "Evaluation overview". */
export default async function EvaluationOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const evaluation = await getEvaluationOverview(id);
  if (!evaluation) notFound();
  await assertLabMember(session.user.id, evaluation.labId);

  const [tests, history] = await Promise.all([listEvaluationTests(id), listEvaluationHistory(id)]);

  const accuracyClass = instrumentMetrologySchema.safeParse(evaluation.specSnapshot);
  const canCancel = evaluation.status === 'DRAFT' || evaluation.status === 'PLANNED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={evaluation.refNo}
        description={`${evaluation.manufacturerName} · ${evaluation.modelName}`}
        actions={
          <div className="flex items-center gap-2">
            {accuracyClass.success ? <ClassBadge value={accuracyClass.data.accuracyClass} /> : null}
            <StatusChip status={evaluation.status as StatusChipValue} />
            {evaluation.status === 'DRAFT' ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/evaluations/new?draft=${evaluation.id}`}>
                  <Pencil className="size-4" />
                  Resume draft
                </Link>
              </Button>
            ) : null}
            {canCancel ? <CancelEvaluationButton evaluationId={evaluation.id} /> : null}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instrument">Instrument</TabsTrigger>
          <TabsTrigger value="test-plan">Test plan</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab evaluation={evaluation} tests={tests} />
        </TabsContent>
        <TabsContent value="instrument" className="pt-4">
          <InstrumentTab evaluation={evaluation} />
        </TabsContent>
        <TabsContent value="test-plan" className="pt-4">
          <TestPlanTab tests={tests} />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <HistoryTab entries={history} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
