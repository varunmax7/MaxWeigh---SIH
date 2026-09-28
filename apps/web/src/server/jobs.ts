/**
 * A send-only pg-boss client (implementation.md §3.1 system diagram: "SA
 * -->|pg-boss jobs| PG"). The web app only enqueues; `apps/worker` is the
 * only process that calls `.work()`. One lazily-started instance per
 * process, same pattern as `server/db.ts`.
 */
import { env } from '@tula/config';
import { PgBoss } from 'pg-boss';

const config = env();

let boss: PgBoss | undefined;
let starting: Promise<PgBoss> | undefined;

async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  starting ??= (async () => {
    const instance = new PgBoss({ connectionString: config.DATABASE_URL, schema: 'pgboss' });
    await instance.start();
    boss = instance;
    return instance;
  })();
  return starting;
}

/** Enqueues a job by queue name (see `apps/worker/src/queues.ts` for the catalog). */
export async function enqueue(queue: string, data: Record<string, unknown>): Promise<void> {
  const instance = await getBoss();
  await instance.send(queue, data);
}
