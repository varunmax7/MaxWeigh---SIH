import { LayoutDashboard } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireSession } from '@/server/session';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Empty-state placeholder — the KPI strip, throughput chart and "needs your
 * action" list (implementation.md §7.5) arrive with real evaluation data in
 * P9. P3's job was the shell around this page, not its content.
 */
export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Type approval dashboard"
        description={`Signed in as ${session.user.name} · ${session.user.role.replaceAll('_', ' ').toLowerCase()}`}
      />
      <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border py-16 text-center">
        <LayoutDashboard aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No evaluations yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Once evaluations are created, this dashboard will show throughput, verdicts by class and
          what needs your action.
        </p>
      </div>
    </div>
  );
}
