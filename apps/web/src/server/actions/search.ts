'use server';

import { getActiveLabId } from '@/server/active-lab';
import { globalSearch } from '@/server/queries/search';
import { getSession } from '@/server/session';

/**
 * A read, not a mutation — same rationale as `getInstrumentModelSpecAction`:
 * the ⌘K palette (a Client Component) cannot import `server/queries/*`
 * directly (those pull in `@tula/db`).
 */
export async function globalSearchAction(q: string) {
  const session = await getSession();
  if (!session) return [];
  const labId = await getActiveLabId();
  return globalSearch(labId, q);
}
