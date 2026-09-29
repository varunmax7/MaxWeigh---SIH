#!/usr/bin/env tsx
/**
 * Reports repository search latency benchmark (implementation.md §10 P9
 * acceptance: "p95 search latency < 300 ms on 10 000 reports"). Run after
 * `pnpm db:seed --volume`.
 *
 * Reruns the exact query shape `apps/web/src/server/queries/reports.ts`'s
 * `listReports` builds (joined, trigram-ranked, paginated) directly against
 * `@tula/db` — a root-level script isn't part of the `apps/web` workspace
 * package, so it can't import that file's `@/`-aliased module graph, the
 * same reason `apps/worker`'s `reports.export` job keeps its own copy
 * (`apps/worker/src/jobs/reports-export.ts`'s own comment) instead.
 */
import { env, loadRootEnv } from '@tula/config';
import { createDb, evaluations, instrumentModels, labs, manufacturers, reports } from '@tula/db';
import { and, desc, eq, sql } from 'drizzle-orm';

loadRootEnv();
const config = env();
const { db, sql: pgClient } = createDb(config.DATABASE_URL);

const RUNS = 60;
const P95_BUDGET_MS = 300;

/** A handful of realistic query shapes — plain lookups, fuzzy text, filter combinations. */
function buildQueries(sampleWords: string[]): { label: string; q?: string; verdict?: string }[] {
  const queries: { label: string; q?: string; verdict?: string }[] = [
    { label: 'unfiltered page 1' },
    { label: 'verdict filter', verdict: 'CONFORMS' },
  ];
  for (const word of sampleWords) {
    queries.push({ label: `fuzzy "${word}"`, q: word });
    queries.push({ label: `fuzzy misspelled "${word.slice(0, -1)}"`, q: word.slice(0, -1) });
  }
  return queries;
}

async function timedSearch(labId: string, q: string | undefined, verdict: string | undefined) {
  const conditions = [eq(evaluations.labId, labId)];
  if (verdict) conditions.push(eq(evaluations.overallVerdict, verdict));
  if (q) {
    conditions.push(sql`(
      ${reports.reportNo} % ${q}
      OR coalesce(${reports.certificateNo}, '') % ${q}
      OR ${manufacturers.name} % ${q}
      OR ${instrumentModels.modelName} % ${q}
      OR ${reports.reportNo} ilike ${`%${q}%`}
    )`);
  }
  const where = and(...conditions);

  const started = performance.now();
  await db
    .select({
      id: reports.id,
      reportNo: reports.reportNo,
      certificateNo: reports.certificateNo,
      manufacturerName: manufacturers.name,
      modelName: instrumentModels.modelName,
    })
    .from(reports)
    .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
    .innerJoin(instrumentModels, eq(evaluations.modelId, instrumentModels.id))
    .innerJoin(manufacturers, eq(evaluations.manufacturerId, manufacturers.id))
    .where(where)
    .orderBy(q ? desc(sql`similarity(${reports.reportNo}, ${q})`) : desc(reports.issuedAt))
    .limit(20)
    .offset(0);
  return performance.now() - started;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

async function main() {
  const [lab] = await db.select({ id: labs.id }).from(labs).where(eq(labs.code, 'RRSL-BLR'));
  if (!lab) throw new Error('RRSL-BLR not found — run `pnpm db:seed` first');

  const [{ count: reportCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reports)
    .innerJoin(evaluations, eq(reports.evaluationId, evaluations.id))
    .where(eq(evaluations.labId, lab.id));

  const sampleNames = await db.select({ name: manufacturers.name }).from(manufacturers).limit(10);
  const sampleWords = sampleNames.map((m) => m.name.split(' ')[1] ?? m.name).filter(Boolean);
  if (sampleWords.length === 0) sampleWords.push('bench', 'platform');

  const queries = buildQueries(sampleWords);
  const timingsMs: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    const spec = queries[i % queries.length];
    if (!spec) continue;
    const ms = await timedSearch(lab.id, spec.q, spec.verdict);
    timingsMs.push(ms);
  }

  timingsMs.sort((a, b) => a - b);
  const p50 = percentile(timingsMs, 50);
  const p95 = percentile(timingsMs, 95);
  const p99 = percentile(timingsMs, 99);

  console.info(
    `Reports repository search — ${Number(reportCount)} reports in RRSL-BLR, ${RUNS} queries`,
  );
  console.info(`  p50: ${p50.toFixed(1)} ms`);
  console.info(`  p95: ${p95.toFixed(1)} ms`);
  console.info(`  p99: ${p99.toFixed(1)} ms`);

  await pgClient.end();

  if (p95 >= P95_BUDGET_MS) {
    console.error(
      `FAIL: p95 (${p95.toFixed(1)} ms) exceeds the ${P95_BUDGET_MS} ms budget (§10 P9).`,
    );
    process.exit(1);
  }
  console.info(`PASS: p95 within the ${P95_BUDGET_MS} ms budget.`);
}

void main();
