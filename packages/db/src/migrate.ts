/** Applies every pending migration in `migrations/` (implementation.md §10, P2). Run via `pnpm db:migrate`. */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRootEnv } from '@tula/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client.js';

loadRootEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const { db, sql } = createDb(databaseUrl);

await migrate(db, { migrationsFolder });
await sql.end();

console.info(`Migrations applied from ${migrationsFolder}`);
