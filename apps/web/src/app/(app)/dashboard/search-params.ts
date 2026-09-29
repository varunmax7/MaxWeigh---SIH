import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';
import { fiscalYearOf } from '@/lib/fiscal-year';

/**
 * Dashboard filters (implementation.md §7.5's "[FY 2026-27 ▾] [All classes ▾]"
 * header row), shared between the server page and the client filter bar —
 * same URL-persistence convention `evaluations/search-params.ts` set up in P5.
 */
export const dashboardSearchParams = {
  fy: parseAsInteger.withDefault(fiscalYearOf(new Date())),
  accuracyClass: parseAsString,
};

export const loadDashboardSearchParams = createLoader(dashboardSearchParams);
