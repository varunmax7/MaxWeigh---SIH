/**
 * Refreshes the dashboard's materialized views every 5 min (implementation.md
 * §5, §10 P9). Same shape as `verify-audit-chain.ts`'s nightly job: no
 * payload, scheduled by cron in `index.ts`, logs its own result.
 */
import type { Db } from '@tula/db';
import { refreshAnalyticsViews } from '@tula/db';
import { logger } from '../logger.js';

export function makeAnalyticsRefresh(db: Db) {
  return async function analyticsRefresh(): Promise<void> {
    const startedAt = Date.now();
    await refreshAnalyticsViews(db);
    logger.info({ ms: Date.now() - startedAt }, 'analytics views refreshed');
  };
}
