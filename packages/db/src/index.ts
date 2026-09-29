/**
 * @tula/db — Drizzle schema, migrations, SQL triggers and seed data.
 *
 * P2 adds the tables of implementation.md §5, the append-only audit ledger
 * (trigger + hash chain) and the shared Better Auth configuration.
 */

/** Postgres schema name the application owns. */
export const DB_SCHEMA = 'public' as const;

/** Extensions the init script must have enabled before migrations run. */
export const REQUIRED_EXTENSIONS = ['pg_trgm', 'pgcrypto'] as const;

export * from './analytics.js';
export * from './audit-ledger.js';
export * from './auth-config.js';
export * from './client.js';
export * from './number-sequences.js';
export * from './schema/index.js';
