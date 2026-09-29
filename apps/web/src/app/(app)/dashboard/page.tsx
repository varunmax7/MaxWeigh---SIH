import { LayoutDashboard } from 'lucide-react';
import type { Metadata } from 'next';
import { ThroughputChart } from '@/components/charts/ThroughputChart';
import { VerdictDonut } from '@/components/charts/VerdictDonut';
import { PageHeader } from '@/components/shell/PageHeader';
import { getActiveLabId } from '@/server/active-lab';
import {
  fiscalYearRange,
  getDashboardKpis,
  getThroughputLast12Months,
  getVerdictsByClass,
} from '@/server/queries/dashboard';
import { listEvaluations } from '@/server/queries/evaluations';
import { labSlaHours, listNeedsYourAction } from '@/server/queries/review';
import { requireSession } from '@/server/session';
import { EvaluationsTable } from '../evaluations/EvaluationsTable';
import { DashboardFilters } from './DashboardFilters';
import { KpiStrip } from './KpiStrip';
import { NeedsYourAction } from './NeedsYourAction';
import { loadDashboardSearchParams } from './search-params';

export const metadata: Metadata = { title: 'Dashboard' };

const RECENT_EVALUATIONS_LIMIT = 8;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const activeLabId = await getActiveLabId();
  const filters = await loadDashboardSearchParams(searchParams);

  if (!activeLabId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Type approval dashboard" />
        <p className="text-sm text-muted-foreground">Choose a lab to see its dashboard.</p>
      </div>
    );
  }

  const range = fiscalYearRange(filters.fy);
  const [kpis, throughput, verdictRows, slaHours, recent] = await Promise.all([
    getDashboardKpis(activeLabId, range, filters.accuracyClass ?? undefined),
    getThroughputLast12Months(activeLabId),
    getVerdictsByClass(activeLabId),
    labSlaHours(activeLabId),
    listEvaluations(activeLabId, { page: 1, pageSize: RECENT_EVALUATIONS_LIMIT }),
  ]);
  const needsAction = await listNeedsYourAction(
    activeLabId,
    session.user.id,
    session.user.role,
    slaHours,
  );

  const needsActionPanel = <NeedsYourAction rows={needsAction} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Type approval dashboard"
        description={`Signed in as ${session.user.name} · ${session.user.role.replaceAll('_', ' ').toLowerCase()}`}
        actions={<DashboardFilters />}
      />

      {kpis.total === 0 && needsAction.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border py-16 text-center">
          <LayoutDashboard aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No evaluations yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Once evaluations are created, this dashboard will show throughput, verdicts by class and
            what needs your action.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {needsAction.length > 0 ? needsActionPanel : null}

          <KpiStrip kpis={kpis} />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-panel)] border border-border p-4">
              <h2 className="text-sm font-medium">Throughput, last 12 months</h2>
              <div className="mt-3">
                <ThroughputChart months={throughput} />
              </div>
            </div>
            <div className="rounded-[var(--radius-panel)] border border-border p-4">
              <h2 className="text-sm font-medium">Verdicts by class</h2>
              <div className="mt-3">
                <VerdictDonut rows={verdictRows} />
              </div>
            </div>
          </div>

          {needsAction.length === 0 ? needsActionPanel : null}

          <div className="rounded-[var(--radius-panel)] border border-border p-4">
            <h2 className="text-sm font-medium">Recent evaluations</h2>
            <div className="mt-3">
              <EvaluationsTable
                rows={recent.rows}
                total={recent.rows.length}
                page={1}
                pageSize={RECENT_EVALUATIONS_LIMIT}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
