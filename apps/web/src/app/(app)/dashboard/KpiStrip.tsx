import type { DashboardKpis } from '@/server/queries/dashboard';

/**
 * "One bordered row, not five floating cards" (implementation.md §7.5's
 * explicit layout note for the KPI strip).
 */
export function KpiStrip({ kpis }: { kpis: DashboardKpis }) {
  const issuedTotal = kpis.issuedConforms + kpis.doesNotConform;
  const conformsPct =
    issuedTotal > 0 ? Math.round((kpis.issuedConforms / issuedTotal) * 100) : null;

  const cells = [
    { label: 'Total evaluations', value: kpis.total },
    { label: 'In testing', value: kpis.inTesting },
    { label: 'Awaiting review', value: kpis.awaitingReview },
    {
      label: 'Issued (conforms)',
      value: kpis.issuedConforms,
      suffix: conformsPct !== null ? `· ${conformsPct}%` : undefined,
    },
    { label: 'Does not conform', value: kpis.doesNotConform, tone: 'fail' as const },
  ];

  return (
    <div className="grid grid-cols-2 divide-y divide-border rounded-[var(--radius-panel)] border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
      {cells.map((cell) => (
        <div key={cell.label} className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{cell.label}</p>
          <p
            className={`tabular mt-1 text-xl font-semibold ${cell.tone === 'fail' && cell.value > 0 ? 'text-fail' : 'text-foreground'}`}
          >
            {cell.value.toLocaleString('en-IN')}
            {cell.suffix ? (
              <span className="ml-1 text-sm font-normal text-muted-foreground">{cell.suffix}</span>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}
