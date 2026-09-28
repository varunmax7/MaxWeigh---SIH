/**
 * Master data and reference equipment schemas (implementation.md §4.2, §5,
 * §10 P4). `instrumentMetrologySchema` mirrors `@tula/engine`'s
 * `InstrumentMetrology` field-for-field — kept in sync by hand, the same
 * arrangement as `observations.ts` (the engine has zero internal imports and
 * can't reference Zod itself).
 */
import { z } from 'zod';
import { decSchema } from './primitives.js';

export const accuracyClassSchema = z.enum(['I', 'II', 'III', 'IIII']);
export const rangeKindSchema = z.enum(['single', 'multi_range', 'multi_interval']);
export const displayUnitSchema = z.enum(['mg', 'g', 'kg', 't']);

export const weighingRangeSchema = z.object({
  max: decSchema,
  e: decSchema,
  d: decSchema,
});

export const loadReceptorSchema = z.object({
  kind: z.enum(['platform', 'pan', 'hook', 'hopper', 'vehicle', 'other']),
  supports: z.number().int().positive(),
  widthMm: z.number().positive().optional(),
  depthMm: z.number().positive().optional(),
});

export const powerSupplySchema = z
  .object({
    mains: z.object({ vNom: z.number().positive(), fNomHz: z.number().positive() }).optional(),
    battery: z.boolean().optional(),
    dcAdapter: z.boolean().optional(),
  })
  .refine((v) => v.mains || v.battery || v.dcAdapter, {
    message: 'At least one power source is required.',
  });

/**
 * Mirrors `InstrumentMetrology` (`@tula/engine`). `tempRange` defaults to
 * −10/+40 °C (R 76-1 clause 3.9.2) at the form layer, not here — a default
 * baked into the schema would hide a spec that never actually set it.
 */
export const instrumentMetrologySchema = z.object({
  accuracyClass: accuracyClassSchema,
  kind: rangeKindSchema,
  ranges: z.array(weighingRangeSchema).min(1),
  min: decSchema,
  maxAdditiveTare: decSchema.optional(),
  maxSubtractiveTare: decSchema.optional(),
  tempRange: z.object({ lowC: z.number(), highC: z.number() }),
  isElectronic: z.boolean(),
  hasTareDevice: z.boolean(),
  hasZeroTracking: z.boolean(),
  initialZeroSettingRangePct: z.number().min(0).max(100).optional(),
  loadReceptor: loadReceptorSchema,
  levelIndicator: z.boolean(),
  tiltSusceptible: z.boolean(),
  powerSupply: powerSupplySchema,
  displayUnit: displayUnitSchema,
});

/**
 * Indicator + load-cell data (Annex F inputs, implementation.md §5's
 * `instrument_models.modules` comment) — the spec names the jsonb column
 * but not its exact shape; kept deliberately minimal until a phase needs
 * more (see docs/QUESTIONS.md).
 */
export const instrumentModuleSchema = z.object({
  type: z.enum(['indicator', 'load_cell']),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  approvalNo: z.string().optional(),
});
export const instrumentModulesSchema = z.array(instrumentModuleSchema).default([]);

export const manufacturerInputSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  country: z.string().optional(),
  contactName: z.string().optional(),
  email: z.email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
});

export const applicantInputSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  contactName: z.string().optional(),
  email: z.email().optional().or(z.literal('')),
  phone: z.string().optional(),
  manufacturerId: z.uuid().optional(),
});

export const INSTRUMENT_TYPES = [
  'bench',
  'counter',
  'platform',
  'weighbridge',
  'crane',
  'precision',
  'analytical',
  'hanging',
  'other',
] as const;

export const instrumentModelInputSchema = z.object({
  manufacturerId: z.uuid(),
  modelName: z.string().min(1),
  variantNames: z.array(z.string().min(1)).default([]),
  instrumentType: z.enum(INSTRUMENT_TYPES),
  description: z.string().optional(),
  defaultSpec: instrumentMetrologySchema.optional(),
  modules: instrumentModulesSchema.optional(),
});

export const OIML_WEIGHT_CLASSES = ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'] as const;

export const weightSetItemSchema = z.object({
  id: z.string().min(1),
  nominalG: decSchema,
  conventionalMassG: decSchema.optional(),
  uncertaintyMg: decSchema.optional(),
});

export const referenceWeightSetInputSchema = z.object({
  setCode: z.string().min(1),
  oimlClass: z.enum(OIML_WEIGHT_CLASSES),
  items: z.array(weightSetItemSchema).min(1),
  certNo: z.string().optional(),
  calibratedOn: z.iso.date().optional(),
  dueOn: z.iso.date().optional(),
  certAttachmentId: z.uuid().optional(),
});

export const envSensorInputSchema = z.object({
  hubCode: z.string().min(1),
  calibratedOn: z.iso.date().optional(),
  dueOn: z.iso.date().optional(),
});

/** implementation.md §7.5 Settings: "lab profile, logo, numbering patterns, signatory titles, SLA hours". */
export const signatoryTitleSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().min(1),
});

export const labSettingsInputSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  accreditationNo: z.string().optional(),
  reportPrefix: z.string().optional(),
  timezone: z.string().optional(),
  logoKey: z.string().optional(),
  settings: z
    .object({
      numberingPattern: z.string().optional(),
      signatoryTitles: z.array(signatoryTitleSchema).optional(),
      slaHours: z.number().int().positive().optional(),
    })
    .optional(),
});
