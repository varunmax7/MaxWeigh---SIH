/** Drizzle client factory — one `postgres.js` pool per process. */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema/index.js';

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(connectionString: string): { db: Db; sql: Sql } {
  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export { schema };
