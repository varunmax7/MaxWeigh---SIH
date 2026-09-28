/** Tenancy: RRSL labs and their members (implementation.md §5). */
import { jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { createdAtColumn, fkUuid, idColumn } from './columns.js';

export const labs = pgTable('labs', {
  id: idColumn(),
  /** e.g. RRSL-BLR */
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  address: text('address'),
  state: text('state'),
  accreditationNo: text('accreditation_no'),
  logoKey: text('logo_key'),
  reportPrefix: text('report_prefix'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  /** Numbering pattern, signatory titles, branding — shape owned by later phases. */
  settings: jsonb('settings').$type<Record<string, unknown>>(),
  createdAt: createdAtColumn(),
});

export const labMembers = pgTable(
  'lab_members',
  {
    userId: fkUuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    labId: fkUuid('lab_id')
      .notNull()
      .references(() => labs.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.labId] })],
);
