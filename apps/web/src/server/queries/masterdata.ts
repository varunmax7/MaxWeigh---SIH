/**
 * Read queries for master data and reference equipment (implementation.md
 * §5, §10 P4). Manufacturers/applicants/instrument models carry no `lab_id`
 * — they're a shared catalog, not lab-scoped data — but reference weight
 * sets and env sensors do, per §11's "every read query is scoped to the
 * user's labs".
 */
import {
  applicants,
  attachments,
  envSensors,
  instrumentModels,
  labs,
  manufacturers,
  referenceWeightSets,
} from '@tula/db';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db';

export async function getLab(id: string) {
  const [row] = await db.select().from(labs).where(eq(labs.id, id));
  return row ?? null;
}

export async function listManufacturers() {
  return db.select().from(manufacturers).orderBy(asc(manufacturers.name));
}

export async function getManufacturer(id: string) {
  const [row] = await db.select().from(manufacturers).where(eq(manufacturers.id, id));
  return row ?? null;
}

export async function listApplicants() {
  return db
    .select({
      id: applicants.id,
      name: applicants.name,
      address: applicants.address,
      contactName: applicants.contactName,
      email: applicants.email,
      phone: applicants.phone,
      manufacturerId: applicants.manufacturerId,
      manufacturerName: manufacturers.name,
      createdAt: applicants.createdAt,
    })
    .from(applicants)
    .leftJoin(manufacturers, eq(applicants.manufacturerId, manufacturers.id))
    .orderBy(asc(applicants.name));
}

export async function listInstrumentModels() {
  return db
    .select({
      id: instrumentModels.id,
      modelName: instrumentModels.modelName,
      variantNames: instrumentModels.variantNames,
      instrumentType: instrumentModels.instrumentType,
      manufacturerId: instrumentModels.manufacturerId,
      manufacturerName: manufacturers.name,
      hasDefaultSpec: sql<boolean>`${instrumentModels.defaultSpec} is not null`,
      createdAt: instrumentModels.createdAt,
    })
    .from(instrumentModels)
    .innerJoin(manufacturers, eq(instrumentModels.manufacturerId, manufacturers.id))
    .orderBy(asc(instrumentModels.modelName));
}

export async function getInstrumentModel(id: string) {
  const [row] = await db
    .select({
      id: instrumentModels.id,
      modelName: instrumentModels.modelName,
      variantNames: instrumentModels.variantNames,
      instrumentType: instrumentModels.instrumentType,
      description: instrumentModels.description,
      defaultSpec: instrumentModels.defaultSpec,
      modules: instrumentModels.modules,
      manufacturerId: instrumentModels.manufacturerId,
      manufacturerName: manufacturers.name,
      createdAt: instrumentModels.createdAt,
    })
    .from(instrumentModels)
    .innerJoin(manufacturers, eq(instrumentModels.manufacturerId, manufacturers.id))
    .where(eq(instrumentModels.id, id));
  return row ?? null;
}

/**
 * Reference weight sets for a lab, each carrying `expired` (computed from
 * `due_on` vs today, implementation.md §10 P4: "flagged in lists").
 */
export async function listReferenceWeightSets(labId: string) {
  const rows = await db
    .select({
      id: referenceWeightSets.id,
      setCode: referenceWeightSets.setCode,
      oimlClass: referenceWeightSets.oimlClass,
      certNo: referenceWeightSets.certNo,
      calibratedOn: referenceWeightSets.calibratedOn,
      dueOn: referenceWeightSets.dueOn,
      status: referenceWeightSets.status,
      certAttachmentId: referenceWeightSets.certAttachmentId,
    })
    .from(referenceWeightSets)
    .where(eq(referenceWeightSets.labId, labId))
    .orderBy(asc(referenceWeightSets.setCode));

  const today = new Date().toISOString().slice(0, 10);
  return rows.map((row) => ({ ...row, expired: row.dueOn !== null && row.dueOn < today }));
}

/**
 * Weight sets eligible for a test plan picker (implementation.md §10 P4
 * acceptance: "Expired weight sets are excluded from pickers"). Filters at
 * the query level, not by post-processing an unfiltered list.
 */
export async function listActiveUnexpiredWeightSets(labId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: referenceWeightSets.id,
      setCode: referenceWeightSets.setCode,
      oimlClass: referenceWeightSets.oimlClass,
      dueOn: referenceWeightSets.dueOn,
      /** `[{ id, nominal_g, conventional_mass_g?, uncertainty_mg? }]` — implementation.md §5. */
      items: referenceWeightSets.items,
    })
    .from(referenceWeightSets)
    .where(
      sql`${referenceWeightSets.labId} = ${labId} and ${referenceWeightSets.status} = 'active' and (${referenceWeightSets.dueOn} is null or ${referenceWeightSets.dueOn} >= ${today})`,
    )
    .orderBy(asc(referenceWeightSets.setCode));
}

export async function listEnvSensors(labId: string) {
  const rows = await db
    .select({
      id: envSensors.id,
      hubCode: envSensors.hubCode,
      calibratedOn: envSensors.calibratedOn,
      dueOn: envSensors.dueOn,
      status: envSensors.status,
    })
    .from(envSensors)
    .where(eq(envSensors.labId, labId))
    .orderBy(asc(envSensors.hubCode));

  const today = new Date().toISOString().slice(0, 10);
  return rows.map((row) => ({ ...row, expired: row.dueOn !== null && row.dueOn < today }));
}

export async function getAttachment(id: string) {
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
  return row ?? null;
}
