import { evaluations, labs, refreshAnalyticsViews } from '@tula/db';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, sql as pgClient } from '../db.js';
import {
  fiscalYearOf,
  fiscalYearRange,
  getDashboardKpis,
  getVerdictsByClass,
} from './dashboard.js';

let labId: string;

beforeAll(async () => {
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('seed data missing: run pnpm db:seed first');
  labId = lab.id;
});

afterAll(async () => {
  await pgClient.end();
});

/**
 * implementation.md §10 P9 acceptance: "Dashboard numbers equal direct SQL
 * counts (integration test)". Runs against whatever the real dev database
 * currently holds (the base seed, and `--volume`'s synthetic data when
 * present) rather than isolated fixtures — the property under test is that
 * `getDashboardKpis` agrees with an independently-written count query, not
 * any particular value.
 */
describe('dashboard KPI counts match direct SQL (§10 P9)', () => {
  it('matches a hand-written count query for the current fiscal year', async () => {
    const range = fiscalYearRange(fiscalYearOf(new Date()));
    const kpis = await getDashboardKpis(labId, range);

    const [direct] = await db
      .select({
        total: sql<number>`count(*)`,
        inTesting: sql<number>`count(*) filter (where status in ('PLANNED', 'IN_TESTING', 'RETURNED'))`,
        awaitingReview: sql<number>`count(*) filter (where status in ('PENDING_T1', 'PENDING_T2', 'PENDING_T3'))`,
        issuedConforms: sql<number>`count(*) filter (where status = 'ISSUED' and overall_verdict = 'CONFORMS')`,
        doesNotConform: sql<number>`count(*) filter (where status = 'ISSUED' and overall_verdict = 'DOES_NOT_CONFORM')`,
      })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.labId, labId),
          gte(evaluations.createdAt, range.from),
          lte(evaluations.createdAt, range.to),
        ),
      );
    if (!direct) throw new Error('direct count query returned no row');

    expect(kpis).toEqual({
      total: Number(direct.total),
      inTesting: Number(direct.inTesting),
      awaitingReview: Number(direct.awaitingReview),
      issuedConforms: Number(direct.issuedConforms),
      doesNotConform: Number(direct.doesNotConform),
    });
  });

  it('accuracyClass filter narrows the same way as a direct query', async () => {
    const range = fiscalYearRange(fiscalYearOf(new Date()));
    const kpis = await getDashboardKpis(labId, range, 'III');

    const [direct] = await db
      .select({ total: sql<number>`count(*)` })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.labId, labId),
          gte(evaluations.createdAt, range.from),
          lte(evaluations.createdAt, range.to),
          sql`${evaluations.specSnapshot}->>'accuracyClass' = 'III'`,
        ),
      );
    if (!direct) throw new Error('direct count query returned no row');
    expect(kpis.total).toBe(Number(direct.total));
  });

  it('getVerdictsByClass sums to the same total as a direct ISSUED count, once refreshed', async () => {
    await refreshAnalyticsViews(db);
    const rows = await getVerdictsByClass(labId);
    const summed = rows.reduce((sum, r) => sum + r.count, 0);

    const [direct] = await db
      .select({ total: sql<number>`count(*)` })
      .from(evaluations)
      .where(and(eq(evaluations.labId, labId), eq(evaluations.status, 'ISSUED')));
    if (!direct) throw new Error('direct count query returned no row');
    expect(summed).toBe(Number(direct.total));
  });
});
