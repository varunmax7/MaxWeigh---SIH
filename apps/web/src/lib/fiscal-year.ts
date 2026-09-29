/**
 * India's fiscal year (1 Apr–31 Mar) — pure date math, no `@tula/db`
 * dependency, so both the server dashboard queries and the client filter
 * bar (`(app)/dashboard/DashboardFilters.tsx`) can import it without
 * pulling a server-only module into the browser bundle.
 */
export interface FiscalYearRange {
  from: Date;
  to: Date;
  label: string;
}

/** `year` is the starting calendar year (e.g. 2026 → "FY 2026-27"). */
export function fiscalYearRange(year: number): FiscalYearRange {
  return {
    from: new Date(Date.UTC(year, 3, 1)),
    to: new Date(Date.UTC(year + 1, 3, 1)),
    label: `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}`,
  };
}

/** The fiscal year the given instant falls in (its starting calendar year). */
export function fiscalYearOf(date: Date): number {
  return date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}
