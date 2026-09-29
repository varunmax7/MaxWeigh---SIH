/**
 * Read queries for the dashboard (implementation.md §7.5, §10 P9).
 *
 * The KPI strip is deliberately a plain live query, not the materialized
 * views below — §10 P9's acceptance criterion "Dashboard numbers equal
 * direct SQL counts" has to hold without waiting on the worker's 5-minute
 * `analytics.refresh`. The throughput chart and verdict donut *do* read the
 * materialized views (`packages/db/migrations/0006_p9_materialized_views.sql`)
 * — a few minutes of staleness on a 12-month trend is invisible.
 */
import { evaluations } from '@tula/db';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { FiscalYearRange } from '@/lib/fiscal-year';
import { db } from '@/server/db';

// Re-exported so existing callers of this module don't need a second import
// — but the values themselves live in `@/lib/fiscal-year` (pure, no
// `@tula/db`) because `(app)/dashboard/DashboardFilters.tsx`, a Client
// Component, needs `fiscalYearOf` too, and importing anything from *this*
// file into a Client Component would pull the whole server-only module
// (and `@tula/db`) into the browser bundle.
export { type FiscalYearRange, fiscalYearOf, fiscalYearRange } from '@/lib/fiscal-year';

export interface DashboardKpis {
  total: number;
  inTesting: number;
  awaitingReview: number;
  issuedConforms: number;
  doesNotConform: number;
}

const IN_TESTING_STATUSES = ['PLANNED', 'IN_TESTING', 'RETURNED'];
const AWAITING_REVIEW_STATUSES = ['PENDING_T1', 'PENDING_T2', 'PENDING_T3'];

/**
 * KPI strip counts (§7.5): "Total evaluations", "In testing", "Awaiting
 * review", "Issued (conforms)", "Does not conform" — all scoped to one lab
 * and fiscal year, all `count(*)`, no view involved.
 */
export async function getDashboardKpis(
  labId: string,
  range: FiscalYearRange,
  accuracyClass?: string,
): Promise<DashboardKpis> {
  const base = [
    eq(evaluations.labId, labId),
    gte(evaluations.createdAt, range.from),
    lte(evaluations.createdAt, range.to),
  ];
  if (accuracyClass) {
    base.push(sql`${evaluations.specSnapshot}->>'accuracyClass' = ${accuracyClass}`);
  }
  const where = and(...base);

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      inTesting: sql<number>`count(*) filter (where ${inArray(evaluations.status, IN_TESTING_STATUSES)})`,
      awaitingReview: sql<number>`count(*) filter (where ${inArray(evaluations.status, AWAITING_REVIEW_STATUSES)})`,
      issuedConforms: sql<number>`count(*) filter (where ${evaluations.status} = 'ISSUED' and ${evaluations.overallVerdict} = 'CONFORMS')`,
      doesNotConform: sql<number>`count(*) filter (where ${evaluations.status} = 'ISSUED' and ${evaluations.overallVerdict} = 'DOES_NOT_CONFORM')`,
    })
    .from(evaluations)
    .where(where);

  return {
    total: Number(row?.total ?? 0),
    inTesting: Number(row?.inTesting ?? 0),
    awaitingReview: Number(row?.awaitingReview ?? 0),
    issuedConforms: Number(row?.issuedConforms ?? 0),
    doesNotConform: Number(row?.doesNotConform ?? 0),
  };
}

export interface ThroughputMonth {
  month: string;
  conforms: number;
  notConform: number;
}

/** Last 12 months' throughput, one lab, from the materialized `v_eval_monthly` (§7.5's stacked chart). */
export async function getThroughputLast12Months(labId: string): Promise<ThroughputMonth[]> {
  const rows = await db.execute<{
    month: string;
    conforms_count: number;
    not_conform_count: number;
  }>(
    sql`
      SELECT month, conforms_count, not_conform_count
      FROM v_eval_monthly
      WHERE lab_id = ${labId} AND month >= date_trunc('month', now()) - interval '11 months'
      ORDER BY month
    `,
  );
  return rows.map((row) => ({
    // `db.execute`'s generic is a type assertion only — postgres-js doesn't
    // actually parse an aggregate `timestamp` column back into a `Date` at
    // runtime the way a normal typed column read does, so this comes back
    // a string; `new Date(...)` normalizes either shape.
    month: new Date(row.month).toISOString().slice(0, 7),
    conforms: Number(row.conforms_count),
    notConform: Number(row.not_conform_count),
  }));
}

export interface VerdictByClass {
  accuracyClass: string;
  overallVerdict: string;
  count: number;
}

/** Verdicts by accuracy class, one lab, from the materialized `v_verdict_by_class` (§7.5's donut). */
export async function getVerdictsByClass(labId: string): Promise<VerdictByClass[]> {
  const rows = await db.execute<{ accuracy_class: string; overall_verdict: string; n: number }>(
    sql`SELECT accuracy_class, overall_verdict, n FROM v_verdict_by_class WHERE lab_id = ${labId}`,
  );
  return rows.map((row) => ({
    accuracyClass: row.accuracy_class,
    overallVerdict: row.overall_verdict,
    count: Number(row.n),
  }));
}
