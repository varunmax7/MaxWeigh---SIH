/** Lab reference equipment: weight sets and environment sensors (implementation.md §5). */
import { bigserial, date, index, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { enumCheck, fkUuid, idColumn } from './columns.js';
import { labs } from './labs.js';

export const OIML_WEIGHT_CLASSES = ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'] as const;
export type OimlWeightClass = (typeof OIML_WEIGHT_CLASSES)[number];

export const REFERENCE_WEIGHT_SET_STATUSES = ['active', 'retired'] as const;

export const referenceWeightSets = pgTable(
  'reference_weight_sets',
  {
    id: idColumn(),
    labId: fkUuid('lab_id')
      .notNull()
      .references(() => labs.id),
    setCode: text('set_code').notNull(),
    oimlClass: text('oiml_class').notNull(),
    /** `[{ id, nominal_g, conventional_mass_g?, uncertainty_mg? }]` */
    items: jsonb('items').$type<Record<string, unknown>[]>().notNull(),
    certNo: text('cert_no'),
    calibratedOn: date('calibrated_on'),
    dueOn: date('due_on'),
    certAttachmentId: fkUuid('cert_attachment_id'),
    status: text('status').notNull().default('active'),
  },
  (table) => [
    enumCheck('reference_weight_sets_class_check', table.oimlClass, OIML_WEIGHT_CLASSES),
    enumCheck('reference_weight_sets_status_check', table.status, REFERENCE_WEIGHT_SET_STATUSES),
    index('reference_weight_sets_lab_idx').on(table.labId),
  ],
);

export const ENV_SENSOR_STATUSES = ['active', 'retired'] as const;

export const envSensors = pgTable(
  'env_sensors',
  {
    id: idColumn(),
    labId: fkUuid('lab_id')
      .notNull()
      .references(() => labs.id),
    hubCode: text('hub_code').notNull(),
    deviceKeyHash: text('device_key_hash').notNull(),
    calibratedOn: date('calibrated_on'),
    dueOn: date('due_on'),
    status: text('status').notNull().default('active'),
  },
  (table) => [enumCheck('env_sensors_status_check', table.status, ENV_SENSOR_STATUSES)],
);

export const envReadings = pgTable(
  'env_readings',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    sensorId: fkUuid('sensor_id')
      .notNull()
      .references(() => envSensors.id),
    labId: fkUuid('lab_id')
      .notNull()
      .references(() => labs.id),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    tempC: numeric('temp_c', { precision: 5, scale: 2 }).notNull(),
    rhPct: numeric('rh_pct', { precision: 5, scale: 2 }).notNull(),
    pressureHpa: numeric('pressure_hpa', { precision: 6, scale: 1 }).notNull(),
  },
  (table) => [index('env_readings_lab_ts_idx').on(table.labId, table.ts.desc())],
);
