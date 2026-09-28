/**
 * Append-only audit ledger (implementation.md §5, §9).
 *
 * The append-only guarantee is enforced by a Postgres trigger
 * (`migrations/0002_audit_trigger.sql`), not by application code — Drizzle
 * has no way to express "no UPDATE/DELETE, ever" in a `pgTable` call.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  char,
  check,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { fkUuid } from './columns.js';
import { labs } from './labs.js';

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  actorId: fkUuid('actor_id').references(() => user.id),
  actorRole: text('actor_role'),
  labId: fkUuid('lab_id').references(() => labs.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  /** JSON Patch (RFC 6902) or `{before, after}` for small rows. */
  diff: jsonb('diff').$type<Record<string, unknown>>(),
  ip: inet('ip'),
  userAgent: text('user_agent'),
  prevHash: char('prev_hash', { length: 64 }).notNull(),
  hash: char('hash', { length: 64 }).notNull(),
});

/** Single-row (`id = 1`) pointer to the tip of the hash chain, locked with `SELECT ... FOR UPDATE` while appending. */
export const auditHead = pgTable(
  'audit_head',
  {
    id: integer('id').primaryKey(),
    lastId: bigint('last_id', { mode: 'bigint' }),
    lastHash: char('last_hash', { length: 64 }),
  },
  (table) => [check('audit_head_singleton_check', sql`${table.id} = 1`)],
);

/** The chain's starting value — there is no real previous entry before the first row. */
export const AUDIT_GENESIS_HASH = '0'.repeat(64);
