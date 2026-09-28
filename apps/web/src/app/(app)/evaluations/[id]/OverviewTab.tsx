import { VerdictChip, type VerdictChipValue } from '@/components/metrology';
import type { getEvaluationOverview, listEvaluationTests } from '@/server/queries/evaluations';

type Evaluation = NonNullable<Awaited<ReturnType<typeof getEvaluationOverview>>>;
type TestRow = Awaited<ReturnType<typeof listEvaluationTests>>[number];

function progressByStatus(tests: TestRow[]) {
  const applicable = tests.filter((t) => t.applicability === 'APPLICABLE');
  const completed = applicable.filter((t) => t.status === 'COMPLETED').length;
  return { completed, total: applicable.length };
}

/** Overview tab (implementation.md §7.5): "progress by test, timeline". */
export function OverviewTab({ evaluation, tests }: { evaluation: Evaluation; tests: TestRow[] }) {
  const { completed, total } = progressByStatus(tests);
  const timeline = [
    { label: 'Created', at: evaluation.createdAt },
    { label: 'Submitted for review', at: evaluation.submittedAt },
    { label: 'Issued', at: evaluation.issuedAt },
  ].filter((event): event is { label: string; at: Date } => event.at !== null);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4">
        <p className="text-sm font-medium">Test progress</p>
        <p className="tabular text-2xl font-semibold">
          {completed} / {total}
        </p>
        <p className="text-sm text-muted-foreground">applicable tests completed</p>
      </div>

      <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4">
        <p className="text-sm font-medium">Overall verdict</p>
        {evaluation.overallVerdict ? (
          <VerdictChip verdict={evaluation.overallVerdict as VerdictChipValue} />
        ) : (
          <p className="text-sm text-muted-foreground">Not yet determined.</p>
        )}
      </div>

      <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4 sm:col-span-2">
        <p className="text-sm font-medium">Timeline</p>
        <ul className="space-y-1 text-sm">
          {timeline.map((event) => (
            <li key={event.label} className="flex items-baseline gap-2">
              <span className="tabular text-muted-foreground">
                {event.at.toISOString().slice(0, 10)}
              </span>
              <span>{event.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
