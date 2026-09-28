'use client';

import { EVALUATION_STATUSES, OVERALL_VERDICTS } from '@tula/schemas';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { listTesters } from '@/server/queries/evaluations';
import { evaluationsSearchParams } from './search-params';

type Tester = Awaited<ReturnType<typeof listTesters>>[number];

const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'] as const;

const ALL = '__all__';

function firstOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

/**
 * Filter bar for `/evaluations` (implementation.md §7.5), backed by nuqs so
 * every filter round-trips through the URL — reload and shared links both
 * reproduce the same view (§10 P5 acceptance).
 */
export function EvaluationsFilters({
  testers,
  currentUserId,
}: {
  testers: Tester[];
  currentUserId: string;
}) {
  const [filters, setFilters] = useQueryStates(evaluationsSearchParams, {
    shallow: false,
    clearOnDefault: true,
  });

  const hasFilters =
    filters.status ||
    filters.accuracyClass ||
    filters.testerId ||
    filters.verdict ||
    filters.createdFrom ||
    filters.createdTo ||
    filters.overdue;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setFilters({
              testerId: currentUserId,
              status: null,
              overdue: null,
              createdFrom: null,
              createdTo: null,
              page: 1,
            })
          }
        >
          My open
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters({ overdue: true, testerId: null, status: null, page: 1 })}
        >
          Overdue
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setFilters({
              createdFrom: firstOfMonthIso(),
              createdTo: null,
              overdue: null,
              page: 1,
            })
          }
        >
          This month
        </Button>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({
                status: null,
                accuracyClass: null,
                testerId: null,
                verdict: null,
                createdFrom: null,
                createdTo: null,
                overdue: null,
                page: 1,
              })
            }
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status ?? ALL}
          onValueChange={(v) => setFilters({ status: v === ALL ? null : v, page: 1 })}
        >
          <SelectTrigger aria-label="Status" className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {EVALUATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.accuracyClass ?? ALL}
          onValueChange={(v) => setFilters({ accuracyClass: v === ALL ? null : v, page: 1 })}
        >
          <SelectTrigger aria-label="Class" className="w-32">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All classes</SelectItem>
            {ACCURACY_CLASSES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.testerId ?? ALL}
          onValueChange={(v) => setFilters({ testerId: v === ALL ? null : v, page: 1 })}
        >
          <SelectTrigger aria-label="Tester" className="w-44">
            <SelectValue placeholder="Tester" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All testers</SelectItem>
            {testers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.verdict ?? ALL}
          onValueChange={(v) => setFilters({ verdict: v === ALL ? null : v, page: 1 })}
        >
          <SelectTrigger aria-label="Verdict" className="w-40">
            <SelectValue placeholder="Verdict" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All verdicts</SelectItem>
            {OVERALL_VERDICTS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
