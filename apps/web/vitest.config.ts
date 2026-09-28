import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup-env.ts'],
    // Most of these files open their own real-Postgres connection pool
    // (`@tula/db`'s `createDb`, up to 10 connections each — see
    // `server/db.ts`). Running test files in parallel multiplies that by
    // the file count; past a certain number of DB-touching files it starts
    // to approach the dev Postgres instance's `max_connections` (100),
    // which showed up as a rare, unrelated-looking read-your-own-write
    // failure in an unrelated test once P7 added two more such files.
    // Serializing files removes the multiplication — the suite is still
    // fast (each file is well under a second) and correctness against a
    // shared real database matters more here than parallel wall-clock time.
    fileParallelism: false,
  },
});
