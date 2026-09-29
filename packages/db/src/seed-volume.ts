/**
 * `--volume` seed extension (implementation.md §10 P9): ~10 000 synthetic
 * historical evaluations/reports for performance testing the Reports
 * repository, dashboard and search. Called from `seed.ts` — see that file
 * for the CLI flag.
 *
 * Every verdict comes from a real `evaluateTest()` call against
 * schema-valid, engine-computed observations (`seed-volume-fixtures.ts`) —
 * never fabricated. The one exception, matching an already-documented,
 * already-accepted gap (docs/QUESTIONS.md #12): the rule pack's other 12
 * test codes have no registered evaluator at all, so nothing exists to call
 * for them. `SPEC_ARCHETYPES` are scaled variants of `review.test.ts`'s own
 * `goldenSpec`, chosen precisely because that spec is already proven (in
 * that suite) to make `planTests()` mark exactly the 11 implemented test
 * codes applicable and nothing else — this script only ever needs to
 * observe/complete those 11 real evaluators.
 *
 * Submitted-and-reviewed rows (`reports`/`report_versions`/`approvals`) are
 * built by `seed-volume-report.ts`; master data (manufacturers, models,
 * weight sets, cross-lab reviewers) by `seed-volume-masterdata.ts`.
 *
 * No `audit_log` entries: this is direct data setup, the same category as
 * the labs/users `main()` in `seed.ts` seeds without auditing either — not
 * an `action()` mutation with a real actor behind it.
 */
import {
  ENGINE_VERSION,
  evaluateTest,
  planCreep,
  planDiscrimination,
  planEccentricity,
  planRepeatability,
  planTemperatureSequence,
  planTests,
  planWeighingLoads,
  type TestResult,
} from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { allocateNumber } from './number-sequences.js';
import {
  evaluations,
  evaluationTests,
  instrumentModels,
  labs,
  manufacturers,
} from './schema/index.js';
import { buildObservationsByCode } from './seed-volume-fixtures.js';
import {
  ensureLabReviewers,
  ensureMasterData,
  MANUFACTURER_NAMES,
  type SeedAuth,
} from './seed-volume-masterdata.js';
import { type SubmittedOutcome, submitAndReview } from './seed-volume-report.js';

const VOLUME_TOTAL = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SPAN_DAYS = 900; // ~2.5 years

/** `SubmittedOutcome` minus the two terminal (sealed) kinds — a review-tier is still pending. */
const OPEN_REVIEW_STATUSES = ['PENDING_T1', 'PENDING_T2', 'PENDING_T3', 'RETURNED'] as const;

/** Same stamped-`TestResult` shape `review.test.ts`'s `completedEvaluation()` uses for a test code with no registered evaluator. */
const PLACEHOLDER_RESULT: TestResult = {
  verdict: 'PASS',
  rows: [],
  summary: {},
  issues: [],
  steps: [],
  engineVersion: ENGINE_VERSION,
  rulepack: { id: OIML_R76_1_2006.id, version: OIML_R76_1_2006.version },
};

interface PlannedTestLike {
  code: string;
  sequence: number;
  applicable: boolean;
  reason: string;
}

/**
 * Builds every `evaluation_tests` row for one evaluation. Split out of
 * `seedVolume`'s per-evaluation transaction purely to keep that function's
 * cognitive complexity within Biome's limit — see the three branches this
 * covers in `seedVolume`'s own comment (not applicable / not yet completing
 * / completing, real or stamped).
 */
function buildTestRows(
  planned: PlannedTestLike[],
  observationsByCode: Record<string, unknown>,
  ctx: {
    evaluationId: string;
    spec: Parameters<typeof evaluateTest>[2]['instrument'];
    weightSetId: string | undefined;
    /** Whether *this* applicable test completes now — re-evaluated per test for IN_TESTING's partial-progress case. */
    willComplete: () => boolean;
    createdAt: Date;
    completedBy: string;
  },
): { testRows: (typeof evaluationTests.$inferInsert)[]; resultByCode: Map<string, TestResult> } {
  const testRows: (typeof evaluationTests.$inferInsert)[] = [];
  const resultByCode = new Map<string, TestResult>();
  const weightSetIds = ctx.weightSetId ? [ctx.weightSetId] : [];
  const env = (ts: string) => ({ tempC: 22.3, rhPct: 54, source: 'manual' as const, ts });

  for (const t of planned) {
    const base = {
      evaluationId: ctx.evaluationId,
      testCode: t.code,
      rangeIndex: 0,
      sequence: t.sequence,
    };
    if (!t.applicable) {
      testRows.push({
        ...base,
        applicability: 'NOT_APPLICABLE',
        naReason: t.reason,
        status: 'PENDING',
      });
      continue;
    }
    if (!ctx.willComplete()) {
      testRows.push({ ...base, applicability: 'APPLICABLE', status: 'PENDING', weightSetIds });
      continue;
    }

    const obs = observationsByCode[t.code];
    const completed = {
      ...base,
      applicability: 'APPLICABLE' as const,
      status: 'COMPLETED' as const,
      envStart: env(ctx.createdAt.toISOString()),
      envEnd: env(ctx.createdAt.toISOString()),
      weightSetIds,
      startedAt: ctx.createdAt,
      completedAt: ctx.createdAt,
      completedBy: ctx.completedBy,
    };

    if (obs === undefined) {
      // t.code has no registered evaluator at all (docs/QUESTIONS.md #12's
      // already-tracked gap — e.g. TEMP_STATIC, ZERO_RANGE, and (for an
      // electronic instrument) WARM_UP/DAMP_HEAT/POWER_SUPPLY/DISTURBANCES/
      // SPAN_STABILITY are *always* applicable under the current rule pack,
      // so no real evaluation could ever reach ISSUED today without this
      // same gap-filling — same stamped-row precedent `review.test.ts`'s
      // `completedEvaluation()` already uses, applied only to codes with
      // literally nothing to call.
      testRows.push({
        ...completed,
        verdict: 'PASS',
        result: PLACEHOLDER_RESULT as unknown as Record<string, unknown>,
      });
      continue;
    }

    const result = evaluateTest(t.code, obs, { instrument: ctx.spec, rulepack: OIML_R76_1_2006 });
    resultByCode.set(t.code, result);
    testRows.push({
      ...completed,
      verdict: result.verdict,
      observations: { schemaVersion: 1, ...(obs as Record<string, unknown>) },
      result: result as unknown as Record<string, unknown>,
    });
  }

  return { testRows, resultByCode };
}

/** Runs every planner once and builds the matching observations — split out purely to keep `seedVolume`'s transaction under Biome's complexity limit. */
function planObservations(
  spec: Parameters<typeof planTests>[0],
  forceFail: boolean,
): { planned: ReturnType<typeof planTests>; observationsByCode: Record<string, unknown> } {
  const planned = planTests(spec, OIML_R76_1_2006);
  const weighingPlan = planWeighingLoads(spec, OIML_R76_1_2006)[0];
  if (!weighingPlan) throw new Error('planWeighingLoads returned no range');
  const eccentricityPlan = planEccentricity(spec);
  const repeatabilityPlan = planRepeatability(spec, OIML_R76_1_2006);
  const discriminationPlan = planDiscrimination(spec, OIML_R76_1_2006);
  const creepPlan = planCreep(spec, OIML_R76_1_2006);
  const tempPlan = planTemperatureSequence(spec);

  const observationsByCode = buildObservationsByCode(
    spec,
    {
      weighing: weighingPlan,
      eccentricity: eccentricityPlan,
      repeatability: {
        loads: repeatabilityPlan.loads,
        readingsPerSeries: repeatabilityPlan.readingsPerSeries,
      },
      discrimination: { loads: discriminationPlan.loads, extraLoad: discriminationPlan.extraLoad },
      creep: { load: creepPlan.load, scheduleMin: creepPlan.scheduleMin },
      tempSequenceC: tempPlan.sequenceC,
    },
    forceFail,
  );

  return { planned, observationsByCode };
}

function randomFrom<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('randomFrom: empty array');
  return item;
}

/** Deterministic PRNG (mulberry32) — reproducible if the idempotency check ever needs debugging. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ~88% ISSUED (of which ~90% CONFORMS), ~1% REVOKED, ~11% still open across the workflow. */
function pickOutcome(
  rng: () => number,
): 'ISSUED' | 'REVOKED' | 'PLANNED' | 'IN_TESTING' | SubmittedOutcome {
  const r = rng();
  if (r < 0.88) return 'ISSUED';
  if (r < 0.89) return 'REVOKED';
  return randomFrom(rng, ['PLANNED', 'IN_TESTING', ...OPEN_REVIEW_STATUSES] as const);
}

export async function seedVolume(db: Db, auth: SeedAuth, password: string): Promise<void> {
  const [marker] = await db
    .select({ id: manufacturers.id })
    .from(manufacturers)
    .where(eq(manufacturers.name, `Synth ${MANUFACTURER_NAMES[0]}`));
  if (marker) {
    console.info('--volume: synthetic data already present, skipping (idempotent).');
    return;
  }

  const labRows = await db.select({ id: labs.id, code: labs.code }).from(labs);
  if (labRows.length === 0) throw new Error('seedVolume: no labs — run without --volume first');
  const labIds = labRows.map((l) => l.id);

  const rng = mulberry32(0x7a1a5e);
  const reviewersByLab = await ensureLabReviewers(db, auth, password, labRows);
  const { applicantId, modelRows, weightSetIdByLab } = await ensureMasterData(db, labIds, rng);
  if (modelRows.length === 0) throw new Error('seedVolume: no synthetic models were created');

  const modelById = new Map(
    (
      await db
        .select({
          id: instrumentModels.id,
          manufacturerId: instrumentModels.manufacturerId,
          defaultSpec: instrumentModels.defaultSpec,
        })
        .from(instrumentModels)
    ).map((m) => [m.id, m]),
  );

  const startedAt = Date.now();
  const counts: Record<string, number> = {};

  for (let i = 0; i < VOLUME_TOTAL; i++) {
    const labId = randomFrom(rng, labIds);
    const labCode = labRows.find((l) => l.id === labId)?.code ?? 'RRSL-BLR';
    const model = modelById.get(randomFrom(rng, modelRows).id);
    if (!model) continue;
    const spec = model.defaultSpec as unknown as Parameters<typeof planTests>[0];

    const reviewers = reviewersByLab.get(labId);
    if (!reviewers) continue;

    const daysAgo = Math.floor(rng() * SPAN_DAYS);
    const createdAt = new Date(Date.now() - daysAgo * DAY_MS);
    const outcome = pickOutcome(rng);
    const forceFail = outcome === 'ISSUED' && rng() < 0.1;
    const sampleSerial = `SN-${i}`;

    await db.transaction(async (tx) => {
      const year = createdAt.getFullYear();
      const seq = await allocateNumber(tx, labId, year, 'EVAL');
      const refNo = `EV-${labCode}-${year}-${String(seq).padStart(4, '0')}`;

      const [evalRow] = await tx
        .insert(evaluations)
        .values({
          refNo,
          labId,
          applicantId,
          manufacturerId: model.manufacturerId,
          modelId: model.id,
          sampleSerials: [sampleSerial],
          specSnapshot: spec as unknown as Record<string, unknown>,
          rulepackId: OIML_R76_1_2006.id,
          rulepackVersion: OIML_R76_1_2006.version,
          engineVersion: ENGINE_VERSION,
          status: 'PLANNED',
          assignedTesterId: reviewers.TESTING_OFFICER,
          createdBy: reviewers.INTAKE_OFFICER,
          dueAt: new Date(createdAt.getTime() + 14 * DAY_MS),
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: evaluations.id });
      if (!evalRow) throw new Error('evaluations insert returned no row');

      const { planned, observationsByCode } = planObservations(spec, forceFail);

      const isOpenOnly = outcome === 'PLANNED' || outcome === 'IN_TESTING';
      const { testRows, resultByCode } = buildTestRows(planned, observationsByCode, {
        evaluationId: evalRow.id,
        spec,
        weightSetId: weightSetIdByLab.get(labId),
        willComplete: () => !isOpenOnly || (outcome === 'IN_TESTING' && rng() < 0.5),
        createdAt,
        completedBy: reviewers.TESTING_OFFICER,
      });
      if (testRows.length > 0) await tx.insert(evaluationTests).values(testRows);

      counts[outcome] = (counts[outcome] ?? 0) + 1;

      if (isOpenOnly) {
        await tx.update(evaluations).set({ status: outcome }).where(eq(evaluations.id, evalRow.id));
        return;
      }

      const overallVerdict = [...resultByCode.values()].some((r) => r.verdict === 'FAIL')
        ? 'DOES_NOT_CONFORM'
        : resultByCode.size > 0
          ? 'CONFORMS'
          : null;

      await submitAndReview(tx, {
        evaluationId: evalRow.id,
        refNo,
        sampleSerial,
        labId,
        labCode,
        createdAt,
        applicantId,
        modelId: model.id,
        manufacturerId: model.manufacturerId,
        spec,
        testRows,
        outcome: outcome as SubmittedOutcome,
        overallVerdict,
        userIdByRole: reviewers,
      });
    });

    if ((i + 1) % 500 === 0) {
      const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(0);
      console.info(`--volume: ${i + 1}/${VOLUME_TOTAL} evaluations (${elapsedS}s elapsed)`);
    }
  }

  console.info(
    `--volume complete in ${((Date.now() - startedAt) / 1000).toFixed(0)}s: ${JSON.stringify(counts)}`,
  );
}
