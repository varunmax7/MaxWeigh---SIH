import { BadgeCheck, FileEdit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { getReportForEvaluation } from '@/server/queries/review';

type Version = NonNullable<Awaited<ReturnType<typeof getReportForEvaluation>>>['versions'][number];

/**
 * Version history (implementation.md §7.5 "Report view": "version history
 * with change summaries and diff link"). The diff itself
 * (`@tula/report`'s `diffReportModels`) is a P8 report-view concern once
 * there is a page to host it — this lists what changed in one line per
 * version, which is what the review screen's decision needs.
 */
export function VersionTimeline({
  versions,
  currentVersionId,
  slaHours,
}: {
  versions: Version[];
  currentVersionId: string;
  slaHours: number;
}) {
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {versions.map((version) => {
          const isCurrent = version.id === currentVersionId;
          return (
            <li
              key={version.id}
              className={cn(
                'space-y-0.5 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm',
                isCurrent && 'border-active/30 bg-active-bg',
              )}
            >
              <div className="flex items-center gap-2">
                {version.status === 'SIGNED' ? (
                  <BadgeCheck aria-hidden="true" className="size-3.5 text-seal" />
                ) : (
                  <FileEdit aria-hidden="true" className="size-3.5 text-muted-foreground" />
                )}
                <span className="tabular font-medium">v{version.version}</span>
                {isCurrent ? (
                  <span className="tabular text-xs text-active">current</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {version.status.toLowerCase()}
                  </span>
                )}
                <span className="tabular ml-auto text-xs text-muted-foreground">
                  {version.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {version.changeSummary ?? 'First submission.'}
                {version.createdByName ? ` — ${version.createdByName}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">SLA target: {slaHours} h per tier.</p>
    </div>
  );
}
