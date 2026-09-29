import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { NeedsActionRow } from '@/server/queries/review';

/**
 * "Needs your action (role-specific, SLA age, one primary button each)"
 * (implementation.md §7.5). `listNeedsYourAction` already resolves the
 * role-specific set and the per-row href; this only renders it.
 */
export function NeedsYourAction({ rows }: { rows: NeedsActionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border p-4">
        <h2 className="text-sm font-medium">Needs your action</h2>
        <p className="mt-3 text-sm text-muted-foreground">Nothing waiting on you right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-panel)] border border-border p-4">
      <h2 className="text-sm font-medium">Needs your action</h2>
      <ul className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.evaluationId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                <span className="tabular">{row.refNo}</span>
                <span className="ml-2 font-normal text-muted-foreground">
                  {row.manufacturerName} · {row.modelName}
                </span>
              </p>
              <p
                className={`mt-0.5 text-xs ${row.overdue ? 'text-fail' : 'text-muted-foreground'}`}
              >
                {row.overdue ? 'Overdue · ' : ''}
                {row.ageHours < 24
                  ? `${row.ageHours} h waiting`
                  : `${Math.floor(row.ageHours / 24)} d waiting`}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={row.href}>
                Open
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
