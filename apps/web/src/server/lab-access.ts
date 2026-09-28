import { labMembers } from '@tula/db';
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';

/**
 * Server Component equivalent of `action.ts`'s `assertLabAccess` (implementation.md
 * §11: "every read query is scoped to the user's labs" — §6.2's matrix names
 * `evaluation.read` itself as "(own labs)", not a blanket read). `action()`'s
 * version throws an `ActionError` for a mutation's `{ ok: false }` result;
 * a Server Component has no such envelope, so this calls `notFound()`
 * instead — a user outside the lab sees the same 404 as a nonexistent
 * evaluation, not a 403 that would confirm the id exists.
 */
export async function assertLabMember(userId: string, labId: string): Promise<void> {
  const [membership] = await db
    .select({ userId: labMembers.userId })
    .from(labMembers)
    .where(and(eq(labMembers.userId, userId), eq(labMembers.labId, labId)));
  if (!membership) notFound();
}
