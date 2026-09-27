/**
 * Rule-pack schema and validator (implementation.md §4.11).
 *
 * Evaluators are code; OIML constants are data that lives here. A rule pack
 * is validated once, at load time, into this shape — nothing downstream
 * trusts unvalidated JSON. `loadRulepack` takes an already-parsed JSON value
 * (an object literal, or `JSON.parse` output): the engine has zero I/O and no
 * internal package imports (§3.2), so reading the file itself is the job of
 * `@tula/rulepacks`, which calls this validator on what it reads.
 */
import { z } from 'zod';
import type { AccuracyClass } from './types.js';

const decString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'must be a plain decimal string, e.g. "5" or "0.1"');

const accuracyClass = z.enum(['I', 'II', 'III', 'IIII']);

const classificationBand = z.object({
  /** Lower bound of `e`, inclusive, in grams. */
  eMin: decString,
  /** Upper bound of `e`, inclusive, in grams; omitted means unbounded above. */
  eMax: decString.optional(),
  nMin: z.number().int().positive(),
  nMax: z.number().int().positive().optional(),
  /** `Min` (lower limit) = `minE * e`. */
  minE: z.number().int().positive(),
});

const mpeBand = z.object({
  /** Upper bound of `m = load / e`, inclusive; `null` marks the unbounded top band. */
  upToE: z.number().positive().nullable(),
  /** MPE for this band, expressed as a multiple of `e`. */
  mpeE: decString,
});

const applicability = z
  .object({
    always: z.boolean().optional(),
    requires: z
      .array(
        z.enum([
          'hasZeroTracking',
          'hasTareDevice',
          'isElectronic',
          'tiltSusceptible',
          'modular',
          'initialZeroSettingExceeds20Pct',
          'maxAtMost100kg',
        ]),
      )
      .optional(),
    classes: z.array(accuracyClass).optional(),
  })
  .default({});

const testEntry = z.object({
  code: z.string().min(1),
  evaluator: z.string().min(1),
  title: z.string().min(1),
  clause: z.string().min(1),
  applicability,
  params: z.record(z.string(), z.unknown()).default({}),
  mvp: z.boolean().default(false),
});

const eLimit = z.object({ maxE: decString, perC: z.number().positive() });

const rulepackSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().min(1),

  classification: z.record(accuracyClass, z.array(classificationBand)),
  mpeBands: z.record(accuracyClass, z.array(mpeBand)),
  inServiceFactor: z.number().int().positive(),

  tests: z.array(testEntry),

  limits: z.object({
    eFormMultipliers: z.array(z.number().int().positive()),
    auxiliaryIndication: z.object({
      allowedClasses: z.array(accuracyClass),
      eMustBePowerOfTenInKg: z.boolean(),
      maxDToERatio: z.number().positive(),
    }),
    initialZeroSettingMaxPct: decString,
    zeroTrackingCombinedMaxPct: decString,
    zeroSettingAccuracyE: decString,
    zeroTrackingRateMaxEPerSec: decString,
    discriminationExtraD: decString,
    repeatability: z.object({
      maxLoadKgForTenReadings: decString,
      readingsHigh: z.number().int().positive(),
      readingsLow: z.number().int().positive(),
    }),
    tareAccuracyE: decString,
    tiltNoLoadMaxE: decString,
    warmupTimesMin: z.array(z.number().nonnegative()),
    warmupZeroMaxE: decString,
    tempNoLoad: z.object({ I: eLimit, default: eLimit }),
    creepTimesMin: z.array(z.number().nonnegative()),
    creep30MinMaxE: decString,
    creep15to30MaxE: decString,
    creepExtendedTimeMin: z.number().positive(),
    zeroReturnMaxE: decString,
    durability: z.object({
      maxLoadKg: decString,
      eligibleClasses: z.array(accuracyClass),
    }),
    disturbanceMaxIndicationChangeE: decString,
    spanStabilityMinE: decString,
    spanStabilityMpeFraction: decString,
    powerSupply: z.object({ highPct: decString, lowPct: decString }),
    standardsAdequacyDivisor: z.number().int().positive(),
    substitution: z.object({
      fullSharePct: decString,
      reducedSharePct: decString,
      reducedRepeatabilityMaxE: decString,
      minimalSharePct: decString,
      minimalRepeatabilityMaxE: decString,
    }),
    suspectReadingMpeMultiple: decString,
    deltaLStepFractionOfE: decString,
  }),

  verification: z.object({
    verifiedBy: z.string().nullable(),
    verifiedAt: z.string().nullable(),
    source: z.string(),
  }),
});

export type Rulepack = z.infer<typeof rulepackSchema>;
export type ClassificationBand = z.infer<typeof classificationBand>;
export type MpeBand = z.infer<typeof mpeBand>;
export type TestEntry = z.infer<typeof testEntry>;
export type RulepackApplicability = z.infer<typeof applicability>;

export class RulepackValidationError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    const lines = issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    super(`Invalid rule pack:\n${lines.join('\n')}`);
    this.name = 'RulepackValidationError';
  }
}

/**
 * Validate and freeze a rule pack.
 *
 * @param raw an already-parsed JSON value (never a file path — see module doc)
 * @throws {RulepackValidationError} when `raw` does not satisfy the schema
 */
export function loadRulepack(raw: unknown): Rulepack {
  const result = rulepackSchema.safeParse(raw);
  if (!result.success) throw new RulepackValidationError(result.error.issues);
  return result.data;
}

const r111Class = z.enum(['E2', 'F1', 'F2', 'M1', 'M2', 'M3']);

const weightTableSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  unit: z.literal('mg'),
  rows: z.array(
    z.object({
      /** Nominal mass, in grams (canonical unit — §4.1). */
      nominal: decString,
      mpeMg: z.record(r111Class, decString),
    }),
  ),
});

export type WeightTable = z.infer<typeof weightTableSchema>;
export type R111Class = z.infer<typeof r111Class>;

/**
 * Validate an R 111 weight-MPE table (implementation.md §4.8), the same way
 * {@link loadRulepack} validates a rule pack.
 */
export function loadWeightTable(raw: unknown): WeightTable {
  const result = weightTableSchema.safeParse(raw);
  if (!result.success) throw new RulepackValidationError(result.error.issues);
  return result.data;
}

/** Classification bands for one accuracy class, or `undefined` if the pack defines none. */
export function classificationBandsFor(
  rulepack: Rulepack,
  accuracyClass: AccuracyClass,
): ClassificationBand[] | undefined {
  return rulepack.classification[accuracyClass];
}

/** MPE bands for one accuracy class, or `undefined` if the pack defines none. */
export function mpeBandsFor(
  rulepack: Rulepack,
  accuracyClass: AccuracyClass,
): MpeBand[] | undefined {
  return rulepack.mpeBands[accuracyClass];
}
