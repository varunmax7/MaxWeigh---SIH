import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell/PageHeader';
import { getActiveLabId } from '@/server/active-lab';
import { listManufacturers } from '@/server/queries/masterdata';
import { listReports } from '@/server/queries/reports';
import { requireSession } from '@/server/session';
import { ReportsExportActions } from './ReportsExportActions';
import { ReportsFilters } from './ReportsFilters';
import { ReportsTable } from './ReportsTable';
import { loadReportsSearchParams } from './search-params';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const activeLabId = await getActiveLabId();
  const filters = await loadReportsSearchParams(searchParams);

  const [{ rows, total }, manufacturers] = activeLabId
    ? await Promise.all([
        listReports(activeLabId, {
          q: filters.q ?? undefined,
          accuracyClass: filters.accuracyClass ?? undefined,
          verdict: filters.verdict ?? undefined,
          status: filters.status ?? undefined,
          manufacturerId: filters.manufacturerId ?? undefined,
          issuedFrom: filters.issuedFrom ?? undefined,
          issuedTo: filters.issuedTo ?? undefined,
          page: filters.page,
          pageSize: filters.pageSize,
        }),
        listManufacturers(),
      ])
    : [{ rows: [], total: 0 }, []];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Every test report and certificate issued by this lab."
        actions={activeLabId ? <ReportsExportActions labId={activeLabId} /> : undefined}
      />
      {activeLabId ? (
        <div className="space-y-4">
          <ReportsFilters manufacturers={manufacturers} />
          <ReportsTable rows={rows} total={total} page={filters.page} pageSize={filters.pageSize} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a lab to see its reports.</p>
      )}
    </div>
  );
}
