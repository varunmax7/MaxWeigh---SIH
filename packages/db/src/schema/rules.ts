/** Rule packs, per-lab numbering sequences and notifications (implementation.md §5). */
import {
  char,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { createdAtColumn, enumCheck, fkUuid, idColumn } from './columns.js';
import { labs } from './labs.js';

export const RULEPACK_STATUSES = ['DRAFT', 'PUBLISHED', 'RETIRED'] as const;

export const rulepacks = pgTable(
  'rulepacks',
  {
    id: text('id').notNull(),
    version: text('version').notNull(),
    status: text('status').notNull().default('DRAFT'),
    title: text('title').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    contentSha256: char('content_sha256', { length: 64 }).notNull(),
    createdBy: fkUuid('created_by')
      .notNull()
      .references(() => user.id),
    /** SoD-3: the ADMIN who initiates publishing. */
    publishedBy: fkUuid('published_by').references(() => user.id),
    /** SoD-3: the CONTROLLER who confirms — must differ from `publishedBy`. */
    confirmedBy: fkUuid('confirmed_by').references(() => user.id),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.version] }),
    enumCheck('rulepacks_status_check', table.status, RULEPACK_STATUSES),
  ],
);

export const NUMBER_SEQUENCE_KINDS = ['EVAL', 'REPORT', 'CERT'] as const;
export type NumberSequenceKind = (typeof NUMBER_SEQUENCE_KINDS)[number];

export const numberSequences = pgTable(
  'number_sequences',
  {
    labId: fkUuid('lab_id')
      .notNull()
      .references(() => labs.id),
    year: integer('year').notNull(),
    kind: text('kind').notNull(),
    /** Read with `SELECT ... FOR UPDATE` inside the transaction minting a number. */
    nextVal: integer('next_val').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.labId, table.year, table.kind] }),
    enumCheck('number_sequences_kind_check', table.kind, NUMBER_SEQUENCE_KINDS),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: idColumn(),
    userId: fkUuid('user_id')
      .notNull()
      .references(() => user.id),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    readAt: timestamp('read_at', { withTimezone: true }),
    /**
     * Set by the worker's `notify.email` job once the email has been handed
     * to SMTP. The row is written inside the same transaction as the workflow
     * transition it announces, and the worker picks it up afterwards, so a
     * rolled-back transition can never produce an email and a committed one
     * can never lose it (implementation.md §10 P7 "in-app + email via
     * notify.email").
     */
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index('notifications_user_unread_idx').on(table.userId, table.readAt),
    index('notifications_unsent_idx').on(table.emailedAt),
  ],
);
