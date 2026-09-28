/**
 * Workflow notifications (implementation.md §7.4 NotificationBell, §10 P7
 * "Notifications: in-app + email via `notify.email` job").
 *
 * Rows are inserted **inside the transaction that made the state change**,
 * never enqueued as a pg-boss job from the handler. pg-boss writes to its own
 * tables through its own pool, so a job sent from inside our transaction
 * survives a rollback — an email announcing a tier approval that never
 * happened. The worker's `notify.email` job instead claims rows whose
 * `emailed_at` is still null, so a rolled-back transition produces no
 * notification at all and a committed one is picked up on the next sweep.
 */
import { type DbTx, labMembers, notifications, user as userTable } from '@tula/db';
import type { NotificationType } from '@tula/schemas';
import { and, eq, inArray } from 'drizzle-orm';

export interface NotificationPayload extends Record<string, unknown> {
  evaluationId: string;
  refNo: string;
  /** One sentence, already in §7.8's voice — the bell and the email both show it verbatim. */
  message: string;
}

/** Writes one notification per recipient. A user is never notified of their own action. */
export async function notifyUsers(
  tx: DbTx,
  {
    userIds,
    type,
    payload,
    exceptUserId,
  }: {
    userIds: readonly string[];
    type: NotificationType;
    payload: NotificationPayload;
    exceptUserId?: string;
  },
): Promise<number> {
  const recipients = [...new Set(userIds)].filter((id) => id !== exceptUserId);
  if (recipients.length === 0) return 0;

  await tx.insert(notifications).values(recipients.map((userId) => ({ userId, type, payload })));
  return recipients.length;
}

/**
 * Everyone in `labId` holding `role` — the recipients of "this is now waiting
 * on tier N". Scoped to the lab, like every other read (§11).
 */
export async function labMembersWithRole(tx: DbTx, labId: string, role: string): Promise<string[]> {
  const rows = await tx
    .select({ id: userTable.id })
    .from(labMembers)
    .innerJoin(userTable, eq(labMembers.userId, userTable.id))
    .where(
      and(eq(labMembers.labId, labId), eq(userTable.role, role), eq(userTable.isActive, true)),
    );
  return rows.map((row) => row.id);
}

/** Resolves display names for a set of user ids, for the review screen's bylines. */
export async function userNames(tx: DbTx, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(inArray(userTable.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row.name]));
}
