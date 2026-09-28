'use server';

import { createHash, randomBytes } from 'node:crypto';
import {
  applicants,
  envSensors,
  instrumentModels,
  manufacturers,
  referenceWeightSets,
} from '@tula/db';
import {
  applicantInputSchema,
  envSensorInputSchema,
  instrumentModelInputSchema,
  manufacturerInputSchema,
  referenceWeightSetInputSchema,
} from '@tula/schemas';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { classifyInstrument, hasBlockingIssues } from '@/lib/classify';
import { ActionError, action } from '@/server/action';

export const createManufacturerAction = action(
  {
    schema: manufacturerInputSchema,
    permission: 'masterdata.manage',
    audit: {
      action: 'manufacturer.create',
      entityType: 'manufacturer',
      diff: (_input, result) => ({ id: (result as { id: string }).id }),
    },
  },
  async (input, { tx }) => {
    const [row] = await tx.insert(manufacturers).values(input).returning({ id: manufacturers.id });
    if (!row) throw new Error('manufacturers insert returned no row');
    return row;
  },
);

export const updateManufacturerAction = action(
  {
    schema: manufacturerInputSchema.extend({ id: z.uuid() }),
    permission: 'masterdata.manage',
    audit: { action: 'manufacturer.update', entityType: 'manufacturer', entityId: (i) => i.id },
  },
  async ({ id, ...input }, { tx }) => {
    await tx.update(manufacturers).set(input).where(eq(manufacturers.id, id));
    return { id };
  },
);

export const createApplicantAction = action(
  {
    schema: applicantInputSchema,
    permission: 'masterdata.manage',
    audit: {
      action: 'applicant.create',
      entityType: 'applicant',
      diff: (_input, result) => ({ id: (result as { id: string }).id }),
    },
  },
  async (input, { tx }) => {
    const [row] = await tx.insert(applicants).values(input).returning({ id: applicants.id });
    if (!row) throw new Error('applicants insert returned no row');
    return row;
  },
);

export const updateApplicantAction = action(
  {
    schema: applicantInputSchema.extend({ id: z.uuid() }),
    permission: 'masterdata.manage',
    audit: { action: 'applicant.update', entityType: 'applicant', entityId: (i) => i.id },
  },
  async ({ id, ...input }, { tx }) => {
    await tx.update(applicants).set(input).where(eq(applicants.id, id));
    return { id };
  },
);

/**
 * Validates `defaultSpec` against `@tula/engine` before ever touching the
 * database — implementation.md §10 P4 acceptance: "An invalid spec shows
 * engine issues with clause references; errors block saving the default
 * spec." The live panel runs the same check client-side; this is the
 * authoritative one.
 */
function assertSpecClassifies(
  defaultSpec: z.infer<typeof instrumentModelInputSchema>['defaultSpec'],
) {
  if (!defaultSpec) return;
  const issues = classifyInstrument(defaultSpec);
  if (hasBlockingIssues(issues)) {
    throw new ActionError(
      'RULE',
      `Default spec has ${issues.filter((i) => i.severity === 'error').length} blocking classification issue(s).`,
    );
  }
}

export const createInstrumentModelAction = action(
  {
    schema: instrumentModelInputSchema,
    permission: 'masterdata.manage',
    audit: {
      action: 'instrument_model.create',
      entityType: 'instrument_model',
      diff: (_input, result) => ({ id: (result as { id: string }).id }),
    },
  },
  async (input, { tx }) => {
    assertSpecClassifies(input.defaultSpec);
    const [row] = await tx
      .insert(instrumentModels)
      .values(input)
      .returning({ id: instrumentModels.id });
    if (!row) throw new Error('instrument_models insert returned no row');
    return row;
  },
);

export const updateInstrumentModelAction = action(
  {
    schema: instrumentModelInputSchema.extend({ id: z.uuid() }),
    permission: 'masterdata.manage',
    audit: {
      action: 'instrument_model.update',
      entityType: 'instrument_model',
      entityId: (i) => i.id,
    },
  },
  async ({ id, ...input }, { tx }) => {
    assertSpecClassifies(input.defaultSpec);
    await tx.update(instrumentModels).set(input).where(eq(instrumentModels.id, id));
    return { id };
  },
);

const referenceWeightSetActionSchema = referenceWeightSetInputSchema.extend({ labId: z.uuid() });

export const createReferenceWeightSetAction = action(
  {
    schema: referenceWeightSetActionSchema,
    permission: 'standards.manage',
    audit: {
      action: 'reference_weight_set.create',
      entityType: 'reference_weight_set',
      labId: (i) => i.labId,
      diff: (_input, result) => ({ id: (result as { id: string }).id }),
    },
  },
  async (input, { tx, assertLabAccess }) => {
    await assertLabAccess(input.labId);
    const [row] = await tx
      .insert(referenceWeightSets)
      .values(input)
      .returning({ id: referenceWeightSets.id });
    if (!row) throw new Error('reference_weight_sets insert returned no row');
    return row;
  },
);

export const retireReferenceWeightSetAction = action(
  {
    schema: z.object({ id: z.uuid(), labId: z.uuid(), reason: z.string().min(1) }),
    permission: 'standards.manage',
    audit: {
      action: 'reference_weight_set.retire',
      entityType: 'reference_weight_set',
      entityId: (i) => i.id,
      labId: (i) => i.labId,
      diff: (i) => ({ reason: i.reason }),
    },
  },
  async ({ id, labId }, { tx, assertLabAccess }) => {
    await assertLabAccess(labId);
    await tx
      .update(referenceWeightSets)
      .set({ status: 'retired' })
      .where(eq(referenceWeightSets.id, id));
    return { id };
  },
);

const envSensorActionSchema = envSensorInputSchema.extend({ labId: z.uuid() });

export interface RegisterEnvSensorResult {
  id: string;
  /** Shown once — implementation.md §10 P4 acceptance: "never retrievable again." */
  deviceKey: string;
}

export const registerEnvSensorAction = action(
  {
    schema: envSensorActionSchema,
    permission: 'standards.manage',
    audit: {
      action: 'env_sensor.register',
      entityType: 'env_sensor',
      labId: (i) => i.labId,
      // Picks only `id` off the result — never spread the whole result,
      // which also carries the plaintext `deviceKey`. Writing that to
      // `audit_log` would defeat "never retrievable again" (§10 P4).
      diff: (_input, result) => ({ id: (result as RegisterEnvSensorResult).id }),
    },
  },
  async (input, { tx, assertLabAccess }): Promise<RegisterEnvSensorResult> => {
    await assertLabAccess(input.labId);
    const deviceKey = randomBytes(32).toString('base64url');
    const deviceKeyHash = createHash('sha256').update(deviceKey).digest('hex');

    const [row] = await tx
      .insert(envSensors)
      .values({ ...input, deviceKeyHash })
      .returning({ id: envSensors.id });
    if (!row) throw new Error('env_sensors insert returned no row');

    return { id: row.id, deviceKey };
  },
);
