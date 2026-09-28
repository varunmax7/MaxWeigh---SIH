/** Master data: manufacturers, applicants, instrument models (implementation.md §5). */
import { jsonb, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { createdAtColumn, enumCheck, fkUuid, idColumn } from './columns.js';

export const manufacturers = pgTable('manufacturers', {
  id: idColumn(),
  name: text('name').notNull(),
  address: text('address'),
  country: text('country'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  createdAt: createdAtColumn(),
});

export const applicants = pgTable('applicants', {
  id: idColumn(),
  name: text('name').notNull(),
  address: text('address'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  /** The applicant may differ from the manufacturer (e.g. an importer). */
  manufacturerId: fkUuid('manufacturer_id').references(() => manufacturers.id),
  createdAt: createdAtColumn(),
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
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const instrumentModels = pgTable(
  'instrument_models',
  {
    id: idColumn(),
    manufacturerId: fkUuid('manufacturer_id')
      .notNull()
      .references(() => manufacturers.id),
    modelName: text('model_name').notNull(),
    variantNames: text('variant_names').array(),
    instrumentType: text('instrument_type').notNull(),
    description: text('description'),
    /** `InstrumentMetrology` (@tula/engine, implementation.md §4.2). */
    defaultSpec: jsonb('default_spec').$type<Record<string, unknown>>(),
    /** Indicator + load cell data (Annex F inputs). */
    modules: jsonb('modules').$type<Record<string, unknown>>(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    enumCheck('instrument_models_type_check', table.instrumentType, INSTRUMENT_TYPES),
    unique('instrument_models_manufacturer_model_unique').on(table.manufacturerId, table.modelName),
  ],
);
