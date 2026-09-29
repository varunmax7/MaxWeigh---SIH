/**
 * Refreshes the dashboard's materialized views (implementation.md §5, §10
 * P9). Backs the worker's `analytics.refresh` job, scheduled every 5 min.
 *
 * `refresh_analytics_views()` (migration 0006) refreshes all three
 * materialized views (`v_eval_monthly`, `v_verdict_by_class`,
 * `v_turnaround`) `CONCURRENTLY` in one call, so readers never see a
 * blank/locked view mid-refresh. `v_pending_actions` is a plain view (always
 * live) and needs no refresh — see the migration's own comment.
 */
import { sql } from 'drizzle-orm';
import type { Db } from './client.js';

export async function refreshAnalyticsViews(db: Db): Promise<void> {
  await db.execute(sql`SELECT refresh_analytics_views()`);
}
