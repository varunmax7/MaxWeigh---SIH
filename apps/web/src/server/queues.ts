/**
 * Queue names the web app enqueues into (implementation.md §3.3). Kept in
 * sync by hand with `apps/worker/src/queues.ts`'s `QUEUES` — an app isn't a
 * workspace package another app can import from, so there is nowhere
 * shared to put one source of truth without a new package for a handful of
 * string constants.
 */
export const QUEUES = {
  thumbMake: 'thumb.make',
} as const;
