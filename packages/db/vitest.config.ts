import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    // See the same option in apps/web/vitest.config.ts: every file here
    // opens its own real-Postgres connection pool, and this package's
    // `audit-ledger.test.ts` additionally assumes it is the only writer to
    // `audit_log` while its `beforeAll`/`afterAll` reset the ledger to
    // genesis — both reasons to run these files one at a time, not in
    // parallel workers.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/migrate.ts', 'src/seed.ts', 'src/test/**'],
    },
  },
});
