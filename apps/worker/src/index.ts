import { env, loadRootEnv } from '@tula/config';
import { createDb } from '@tula/db';
import { PgBoss } from 'pg-boss';
import { chromium } from 'playwright';
import { makeDocxBuild } from './jobs/docx-build.js';
import { makeReportRender } from './jobs/report-render.js';
import { makeReportSign } from './jobs/report-sign.js';
import { makeThumbMake } from './jobs/thumb-make.js';
import { makeVerifyAuditChain } from './jobs/verify-audit-chain.js';
import { logger } from './logger.js';
import { ALL_QUEUES, QUEUES } from './queues.js';
import { createStorage } from './storage.js';

/**
 * Tula background worker.
 *
 * pg-boss keeps the queue inside Postgres, so an on-prem deployment needs no
 * second datastore (implementation.md §2). Handlers arrive with the phases
 * that need them; P0 only proves the process boots and can reach the queue.
 */
async function main(): Promise<void> {
  loadRootEnv();
  const config = env();
  const { DATABASE_URL } = config;

  const boss = new PgBoss({ connectionString: DATABASE_URL, schema: 'pgboss' });
  boss.on('error', (error: unknown) => logger.error({ err: error }, 'pg-boss error'));

  await boss.start();
  for (const queue of ALL_QUEUES) {
    await boss.createQueue(queue);
  }

  const { db, sql } = createDb(DATABASE_URL);
  const storage = createStorage(config);
  const enqueue = (queue: string, data: Record<string, unknown>) => boss.send(queue, data);

  // One Chromium instance for the whole process (implementation.md §8.2:
  // "Reuse one browser instance per worker" — launching fresh per render is
  // what blows the 40-page-in-≤10s budget). Lazy: nothing pays the launch
  // cost until the first report.render job actually arrives.
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const getBrowser = async () => {
    browser ??= await chromium.launch();
    return browser;
  };

  await boss.schedule(QUEUES.auditVerify, '0 2 * * *', null, { tz: 'Asia/Kolkata' });
  await boss.work(QUEUES.auditVerify, makeVerifyAuditChain(db));
  await boss.work(QUEUES.thumbMake, makeThumbMake(db, storage));
  await boss.work(QUEUES.reportRender, makeReportRender(db, storage, config, enqueue, getBrowser));
  await boss.work(QUEUES.reportSign, makeReportSign(db, storage, config, enqueue));
  await boss.work(QUEUES.docxBuild, makeDocxBuild(db, storage));

  logger.info({ queues: ALL_QUEUES }, 'worker ready');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker shutting down');
    await boss.stop({ graceful: true });
    await browser?.close();
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
