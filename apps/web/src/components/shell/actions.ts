'use server';

import { labMembers } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { ACTIVE_LAB_COOKIE } from '@/server/active-lab';
import { db } from '@/server/db';
import { getSession } from '@/server/session';

/**
 * Sets the active lab (implementation.md §7.4: "Every query is scoped to the
 * active lab"). Every read this cookie later drives (`getActiveLabId()`,
 * called directly by `evaluations`/`reports`/`dashboard`/`search` queries)
 * trusts its value as already lab-scoped per §11 — so this is the one place
 * that must actually check membership before writing it, not just the UI
 * that happens to only ever offer the user's own labs. Silently does nothing
 * for a non-member `labId`, matching how a denied read elsewhere in this
 * codebase (e.g. `getReportDownloadUrlsAction`) fails closed rather than
 * throwing.
 */
export async function setActiveLabAction(labId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const [membership] = await db
    .select({ labId: labMembers.labId })
    .from(labMembers)
    .where(and(eq(labMembers.userId, session.user.id), eq(labMembers.labId, labId)));
  if (!membership) return;

  const store = await cookies();
  store.set(ACTIVE_LAB_COOKIE, labId, { httpOnly: true, sameSite: 'lax', path: '/' });
  revalidatePath('/', 'layout');
}
