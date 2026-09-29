import type { VerdictByClass } from '@/server/queries/dashboard';

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Verdicts by class (§7.5's dashboard donut), from the materialized
 * `v_verdict_by_class`. The ring itself is CONFORMS vs DOES_NOT_CONFORM
 * (the only two verdicts an ISSUED evaluation carries); the per-class
 * breakdown sits beside it as a legend, since a colour-per-class ring would
 * need as many hues as there are classes in use and would stop reading as
 * "pass vs fail" at a glance.
 */
export function VerdictDonut({ rows }: { rows: VerdictByClass[] }) {
  const conforms = rows
    .filter((r) => r.overallVerdict === 'CONFORMS')
    .reduce((sum, r) => sum + r.count, 0);
  const notConform = rows
    .filter((r) => r.overallVerdict === 'DOES_NOT_CONFORM')
    .reduce((sum, r) => sum + r.count, 0);
  const total = conforms + notConform;

  const byClass = new Map<string, { conforms: number; notConform: number }>();
  for (const row of rows) {
    const entry = byClass.get(row.accuracyClass) ?? { conforms: 0, notConform: 0 };
    if (row.overallVerdict === 'CONFORMS') entry.conforms += row.count;
    else if (row.overallVerdict === 'DOES_NOT_CONFORM') entry.notConform += row.count;
    byClass.set(row.accuracyClass, entry);
  }

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-border text-sm text-muted-foreground">
        No issued reports yet
      </div>
    );
  }

  const conformsFraction = conforms / total;
  const conformsLength = conformsFraction * CIRCUMFERENCE;

  return (
    <div className="flex items-center gap-6">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`${conforms} of ${total} issued reports conform (${Math.round(conformsFraction * 100)}%)`}
      >
        <title>Verdicts by class</title>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--fail)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--pass)"
          strokeWidth={STROKE}
          strokeDasharray={`${conformsLength} ${CIRCUMFERENCE - conformsLength}`}
          strokeDashoffset={CIRCUMFERENCE / 4}
          transform={`rotate(90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          className="fill-card-foreground tabular"
          fontSize={22}
          fontWeight={600}
        >
          {Math.round(conformsFraction * 100)}%
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize={10}
        >
          conform
        </text>
      </svg>
      <dl className="space-y-1.5 text-sm">
        {[...byClass.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([accuracyClass, counts]) => (
            <div key={accuracyClass} className="flex items-center gap-2">
              <dt className="w-16 shrink-0 font-medium">Class {accuracyClass}</dt>
              <dd className="tabular text-muted-foreground">
                {counts.conforms} / {counts.conforms + counts.notConform}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
