import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';
import { getActiveLabId } from '@/server/active-lab';
import { listEvaluations, listTesters } from '@/server/queries/evaluations';
import { requireSession } from '@/server/session';
import { EvaluationsFilters } from './EvaluationsFilters';
import { EvaluationsTable } from './EvaluationsTable';
import { loadEvaluationsSearchParams } from './search-params';

export const metadata: Metadata = { title: 'Evaluations' };

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const activeLabId = await getActiveLabId();
  const filters = await loadEvaluationsSearchParams(searchParams);

  const [{ rows, total }, testers] = activeLabId
    ? await Promise.all([
        listEvaluations(activeLabId, {
          status: filters.status ?? undefined,
          accuracyClass: filters.accuracyClass ?? undefined,
          testerId: filters.testerId ?? undefined,
          verdict: filters.verdict ?? undefined,
          createdFrom: filters.createdFrom ?? undefined,
          createdTo: filters.createdTo ?? undefined,
          overdue: filters.overdue ?? undefined,
          page: filters.page,
          pageSize: filters.pageSize,
        }),
        listTesters(activeLabId),
      ])
    : [{ rows: [], total: 0 }, []];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evaluations"
        description="Type evaluations in progress and issued for this lab."
        actions={
          <Button asChild size="sm">
            <Link href={ROUTES.newEvaluation}>
              <Plus className="size-4" />
              New evaluation
            </Link>
          </Button>
        }
      />
      {activeLabId ? (
        <div className="space-y-4">
          <EvaluationsFilters testers={testers} currentUserId={session.user.id} />
          <EvaluationsTable
            rows={rows}
            total={total}
            page={filters.page}
            pageSize={filters.pageSize}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a lab to see its evaluations.</p>
      )}
    </div>
  );
}
