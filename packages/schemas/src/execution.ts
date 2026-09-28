/**
 * Test execution workspace schemas (implementation.md §5 `evaluation_tests`,
 * §10 P6). `observations` itself is validated dynamically against
 * `OBSERVATION_SCHEMAS[testCode]` inside the server action, once the test
 * row (and so its `testCode`) is known — one static schema can't cover
 * every test code's different shape.
 */
import { z } from 'zod';

export const ENV_CONDITION_SOURCES = ['sensor', 'manual'] as const;

/** `evaluation_tests.env_start`/`env_end` (implementation.md §5). Manual entry only in P6 — a live sensor stream is P10. */
export const envConditionsSchema = z.object({
  tempC: z.number(),
  rhPct: z.number().min(0).max(100),
  pressureHpa: z.number().positive().optional(),
  source: z.enum(ENV_CONDITION_SOURCES),
  sensorId: z.uuid().optional(),
  ts: z.iso.datetime(),
});

export const startTestInputSchema = z.object({
  testId: z.uuid(),
});

export const saveObservationsInputSchema = z.object({
  testId: z.uuid(),
  /** Shape depends on the test's code — parsed against `OBSERVATION_SCHEMAS[testCode]` in the action. */
  observations: z.unknown(),
  envStart: envConditionsSchema.optional(),
  envEnd: envConditionsSchema.optional(),
  weightSetIds: z.array(z.uuid()).optional(),
  /** Optimistic concurrency: the `row_version` this client last saw. */
  rowVersion: z.number().int().nonnegative(),
});

export const completeTestInputSchema = z.object({
  testId: z.uuid(),
  rowVersion: z.number().int().nonnegative(),
});

export const reopenTestInputSchema = z.object({
  testId: z.uuid(),
  reason: z.string().min(1),
});
