import Link from 'next/link';
import {
  StatusChip,
  type StatusChipValue,
  VerdictChip,
  type VerdictChipValue,
} from '@/components/metrology';
import type { listModelEvaluationHistory } from '@/server/queries/masterdata';

type HistoryRow = Awaited<ReturnType<typeof listModelEvaluationHistory>>[number];

/**
 * "A history timeline of every evaluation of that model with verdicts"
 * (implementation.md §7.5's Instruments & specs model page, §10 P9).
 */
export function ModelHistoryTimeline({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-panel)] border border-dashed border-border p-4 text-sm text-muted-foreground">
        No evaluations of this model in your labs yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {rows.map((row) => (
        <li key={row.id} className="relative">
          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary" />
          <Link
            href={`/evaluations/${row.id}`}
            className="flex flex-wrap items-center gap-2 text-sm hover:underline"
          >
            <span className="tabular font-medium">{row.refNo}</span>
            <StatusChip status={row.status as StatusChipValue} />
            {row.overallVerdict ? (
              <VerdictChip verdict={row.overallVerdict as VerdictChipValue} />
            ) : null}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.issuedAt
              ? `Issued ${new Date(row.issuedAt).toLocaleDateString('en-IN')}`
              : `Created ${new Date(row.createdAt).toLocaleDateString('en-IN')}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
