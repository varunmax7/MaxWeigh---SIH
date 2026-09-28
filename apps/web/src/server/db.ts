/** The process-wide database connection (implementation.md §3.3: `server/`). */
import { env } from '@tula/config';
import { createDb } from '@tula/db';

const config = env();

export const { db, sql } = createDb(config.DATABASE_URL);
