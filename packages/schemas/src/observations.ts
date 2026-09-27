/**
 * Observation schemas, one per implemented test code (implementation.md §4.6,
 * §10 P1). Each mirrors the `Observation` type its `@tula/engine` evaluator
 * expects (see `packages/engine/src/tests/<code>.ts`) — kept in sync by hand,
 * since the engine has zero internal imports and can't reference Zod itself.
 *
 * Every schema is versioned: a stored observation records the
 * `OBSERVATION_SCHEMA_VERSION` it was written against (§10 P1 task list).
 */
import { z } from 'zod';
import {
  checklistItemSchema,
  decSchema,
  errorMethodSchema,
  mpeContextSchema,
  weighingRowSchema,
  zeroReferenceSchema,
} from './primitives.js';

export const OBSERVATION_SCHEMA_VERSION = 1 as const;

export const examMarkingsObservationSchema = z.object({
  items: z.array(checklistItemSchema).min(1),
});

export const examConstructionObservationSchema = z.object({
  items: z.array(checklistItemSchema).min(1),
});

export const zeroAccuracyObservationSchema = z.object({
  L: decSchema,
  I: decSchema,
  deltaL: decSchema.optional(),
  method: errorMethodSchema.optional(),
  rangeIndex: z.number().int().nonnegative().optional(),
});

export const tareAccuracyObservationSchema = zeroAccuracyObservationSchema;

export const zeroReturnObservationSchema = z.object({
  rangeIndex: z.number().int().nonnegative().optional(),
  i0Before: decSchema,
  i0After: decSchema,
});

export const weighingObservationSchema = z.object({
  zeroRef: zeroReferenceSchema,
  ascending: z.array(weighingRowSchema),
  descending: z.array(weighingRowSchema),
  mpeContext: mpeContextSchema.optional(),
});

export const eccentricityObservationSchema = z.object({
  zeroRef: zeroReferenceSchema,
  positions: z.array(
    z.object({
      position: z.string().min(1),
      L: decSchema,
      I: decSchema,
      deltaL: decSchema.optional(),
      method: errorMethodSchema.optional(),
      rangeIndex: z.number().int().nonnegative().optional(),
    }),
  ),
});

export const discriminationObservationSchema = z.object({
  rows: z.array(
    z.object({
      rowId: z.string().min(1),
      iBefore: decSchema,
      iAfter: decSchema,
      rangeIndex: z.number().int().nonnegative().optional(),
    }),
  ),
});

export const repeatabilityObservationSchema = z.object({
  series: z.array(
    z.object({
      L: decSchema,
      rangeIndex: z.number().int().nonnegative().optional(),
      readings: z.array(
        z.object({
          rowId: z.string().min(1),
          I: decSchema,
          deltaL: decSchema.optional(),
          method: errorMethodSchema.optional(),
        }),
      ),
    }),
  ),
});

export const tempNoLoadObservationSchema = z.object({
  rangeIndex: z.number().int().nonnegative().optional(),
  referenceIndex: z.number().int().nonnegative().optional(),
  readings: z.array(z.object({ tempC: z.number(), i0: decSchema })),
});

export const creepObservationSchema = z.object({
  rangeIndex: z.number().int().nonnegative().optional(),
  L: decSchema,
  readings: z.array(z.object({ tMin: z.number().nonnegative(), i: decSchema })),
});

/** Every implemented test code's observation schema, keyed exactly like the rule pack's `tests[].code`. */
export const OBSERVATION_SCHEMAS = {
  EXAM_MARKINGS: examMarkingsObservationSchema,
  EXAM_CONSTRUCTION: examConstructionObservationSchema,
  ZERO_ACCURACY: zeroAccuracyObservationSchema,
  TARE_ACCURACY: tareAccuracyObservationSchema,
  ZERO_RETURN: zeroReturnObservationSchema,
  WEIGHING: weighingObservationSchema,
  ECCENTRICITY: eccentricityObservationSchema,
  DISCRIMINATION: discriminationObservationSchema,
  REPEATABILITY: repeatabilityObservationSchema,
  TEMP_NO_LOAD: tempNoLoadObservationSchema,
  CREEP: creepObservationSchema,
} as const;

export type ImplementedTestCode = keyof typeof OBSERVATION_SCHEMAS;

/** True for a test code that has both an engine evaluator and an observation schema. */
export function isImplementedTestCode(code: string): code is ImplementedTestCode {
  return code in OBSERVATION_SCHEMAS;
}
