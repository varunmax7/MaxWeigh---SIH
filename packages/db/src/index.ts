/**
 * @tula/db — Drizzle schema, migrations, SQL triggers and seed data.
 *
 * P2 adds the tables of implementation.md §5, the append-only audit ledger
 * trigger and the search indexes.
 */

/** Postgres schema name the application owns. */
export const DB_SCHEMA = 'public' as const;

/** Extensions the init script must have enabled before migrations run. */
export const REQUIRED_EXTENSIONS = ['pg_trgm', 'pgcrypto'] as const;
