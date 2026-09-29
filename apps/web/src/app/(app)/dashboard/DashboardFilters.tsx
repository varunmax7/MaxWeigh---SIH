'use client';

import { useQueryStates } from 'nuqs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fiscalYearOf } from '@/lib/fiscal-year';
import { dashboardSearchParams } from './search-params';

const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'] as const;
const ALL = '__all__';

function fiscalYearLabel(year: number): string {
  return `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

/** The current FY plus the two before it — enough history for a lab officer to look back through. */
function recentFiscalYears(): number[] {
  const current = fiscalYearOf(new Date());
  return [current, current - 1, current - 2];
}

/** `[FY 2026-27 ▾] [All classes ▾]` (implementation.md §7.5's dashboard header). */
export function DashboardFilters() {
  const [filters, setFilters] = useQueryStates(dashboardSearchParams, {
    shallow: false,
    clearOnDefault: true,
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={String(filters.fy)} onValueChange={(v) => setFilters({ fy: Number(v) })}>
        <SelectTrigger aria-label="Fiscal year" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {recentFiscalYears().map((year) => (
            <SelectItem key={year} value={String(year)}>
              {fiscalYearLabel(year)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.accuracyClass ?? ALL}
        onValueChange={(v) => setFilters({ accuracyClass: v === ALL ? null : v })}
      >
        <SelectTrigger aria-label="Accuracy class" className="w-36">
          <SelectValue placeholder="All classes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All classes</SelectItem>
          {ACCURACY_CLASSES.map((c) => (
            <SelectItem key={c} value={c}>
              Class {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
