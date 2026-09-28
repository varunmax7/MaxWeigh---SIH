'use client';

import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { CheckCircle2, CircleDashed, PlayCircle, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface BatteryTest {
  id: string;
  testCode: string;
  rangeIndex: number;
  /** Set once, at planning time — never changes once the plan exists. */
  applicability: 'APPLICABLE' | 'NOT_APPLICABLE';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REOPENED';
  /** Only meaningful once `status === 'COMPLETED'` — null for every test not yet run, applicable or not. */
  verdict: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_APPLICABLE' | null;
}

const CATALOG_TITLE = new Map(OIML_R76_1_2006.tests.map((t) => [t.code, t.title]));

function StatusIcon({
  status,
  verdict,
}: {
  status: BatteryTest['status'];
  verdict: BatteryTest['verdict'];
}) {
  if (status === 'COMPLETED') {
    return verdict === 'FAIL' ? (
      <XCircle className="size-4 text-fail" aria-hidden="true" />
    ) : (
      <CheckCircle2 className="size-4 text-pass" aria-hidden="true" />
    );
  }
  if (status === 'IN_PROGRESS')
    return <PlayCircle className="size-4 text-active" aria-hidden="true" />;
  if (status === 'REOPENED')
    return <RotateCcw className="size-4 text-pending" aria-hidden="true" />;
  return <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />;
}

/**
 * The left pane "test battery" (implementation.md §7.5's reference layout:
 * "2 of 12 complete", a status icon per test, active test highlighted).
 * Applicable tests only — a NOT_APPLICABLE row has nothing to execute.
 * Filtered by `applicability` (fixed at planning time), never by `verdict`
 * (null for every unexecuted test, applicable or not — a bug caught before
 * it could hide a genuinely-applicable test that just hadn't run yet).
 */
export function TestBatteryList({
  evaluationId,
  tests,
  activeTestCode,
  activeRangeIndex,
}: {
  evaluationId: string;
  tests: BatteryTest[];
  activeTestCode: string;
  activeRangeIndex: number;
}) {
  const applicable = tests.filter((t) => t.applicability === 'APPLICABLE');
  const completed = applicable.filter((t) => t.status === 'COMPLETED').length;

  return (
    <nav aria-label="Test battery" className="space-y-2">
      <p className="tabular px-2 text-sm text-muted-foreground">
        {completed} of {applicable.length} complete
      </p>
      <ul className="space-y-0.5">
        {applicable.map((test) => {
          const isActive = test.testCode === activeTestCode && test.rangeIndex === activeRangeIndex;
          const title = CATALOG_TITLE.get(test.testCode) ?? test.testCode;
          const label = test.rangeIndex > 0 ? `${title} (range ${test.rangeIndex + 1})` : title;
          return (
            <li key={test.id}>
              <Link
                href={`/evaluations/${evaluationId}/execute/${test.testCode}?range=${test.rangeIndex}`}
                className={cn(
                  'flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-sm hover:bg-muted',
                  isActive && 'bg-active-bg font-medium text-active',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <StatusIcon status={test.status} verdict={test.verdict} />
                <span className="flex-1 truncate">{label}</span>
                {test.status === 'COMPLETED' && test.verdict ? (
                  <span className="tabular text-xs text-muted-foreground">{test.verdict}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
