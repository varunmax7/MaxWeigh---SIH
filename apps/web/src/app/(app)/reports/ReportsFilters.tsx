'use client';

import { Search } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { listManufacturers } from '@/server/queries/masterdata';
import { reportsSearchParams } from './search-params';

type Manufacturer = Awaited<ReturnType<typeof listManufacturers>>[number];

const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'] as const;
const STATUSES = ['DRAFT', 'IN_REVIEW', 'ISSUED', 'REVOKED', 'SUPERSEDED'] as const;
const VERDICTS = ['CONFORMS', 'DOES_NOT_CONFORM'] as const;
const ALL = '__all__';
const SEARCH_DEBOUNCE_MS = 300;

/** Filter bar for `/reports` (implementation.md §7.5 "Reports repository"), URL-persisted like `/evaluations`'s. */
export function ReportsFilters({ manufacturers }: { manufacturers: Manufacturer[] }) {
  const [filters, setFilters] = useQueryStates(reportsSearchParams, {
    shallow: false,
    clearOnDefault: true,
  });
  const [q, setQ] = useState(filters.q ?? '');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== (filters.q ?? '')) setFilters({ q: q || null, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, filters.q, setFilters]);

  const hasFilters =
    filters.q ||
    filters.accuracyClass ||
    filters.verdict ||
    filters.status ||
    filters.manufacturerId ||
    filters.issuedFrom ||
    filters.issuedTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-64">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search report no., certificate no., model…"
          className="pl-8"
          aria-label="Search reports"
        />
      </div>

      <Select
        value={filters.status ?? ALL}
        onValueChange={(v) => setFilters({ status: v === ALL ? null : v, page: 1 })}
      >
        <SelectTrigger aria-label="Status" className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUSES.map((s) => (
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
        value={filters.verdict ?? ALL}
        onValueChange={(v) => setFilters({ verdict: v === ALL ? null : v, page: 1 })}
      >
        <SelectTrigger aria-label="Verdict" className="w-40">
          <SelectValue placeholder="Verdict" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All verdicts</SelectItem>
          {VERDICTS.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.manufacturerId ?? ALL}
        onValueChange={(v) => setFilters({ manufacturerId: v === ALL ? null : v, page: 1 })}
      >
        <SelectTrigger aria-label="Manufacturer" className="w-48">
          <SelectValue placeholder="Manufacturer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All manufacturers</SelectItem>
          {manufacturers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => {
            setQ('');
            setFilters({
              q: null,
              accuracyClass: null,
              verdict: null,
              status: null,
              manufacturerId: null,
              issuedFrom: null,
              issuedTo: null,
              page: 1,
            });
          }}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
