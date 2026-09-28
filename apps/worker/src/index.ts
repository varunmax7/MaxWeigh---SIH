import { env, loadRootEnv } from '@tula/config';
import { createDb } from '@tula/db';
import { PgBoss } from 'pg-boss';
import { makeVerifyAuditChain } from './jobs/verify-audit-chain.js';
import { logger } from './logger.js';
import { ALL_QUEUES, QUEUES } from './queues.js';

/**
 * Tula background worker.
 *
 * pg-boss keeps the queue inside Postgres, so an on-prem deployment needs no
 * second datastore (implementation.md §2). Handlers arrive with the phases
 * that need them; P0 only proves the process boots and can reach the queue.
 */
async function main(): Promise<void> {
  loadRootEnv();
  const { DATABASE_URL } = env();

  const boss = new PgBoss({ connectionString: DATABASE_URL, schema: 'pgboss' });
  boss.on('error', (error: unknown) => logger.error({ err: error }, 'pg-boss error'));

  await boss.start();
  for (const queue of ALL_QUEUES) {
    await boss.createQueue(queue);
  }

  const { db, sql } = createDb(DATABASE_URL);
  await boss.schedule(QUEUES.auditVerify, '0 2 * * *', null, { tz: 'Asia/Kolkata' });
  await boss.work(QUEUES.auditVerify, makeVerifyAuditChain(db));

  logger.info({ queues: ALL_QUEUES }, 'worker ready');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker shutting down');
    await boss.stop({ graceful: true });
    await sql.end();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'worker failed to start');
  process.exit(1);
});
