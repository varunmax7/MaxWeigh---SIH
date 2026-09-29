'use server';

import { countUnreadNotifications, listMyNotifications } from '@/server/queries/review';
import { getSession } from '@/server/session';
import { presignGetUrl } from '@/server/storage';

/** A read, not a mutation — same rationale as `getInstrumentModelSpecAction`. */
export async function getMyNotificationsAction() {
  const session = await getSession();
  if (!session) return { rows: [], unread: 0 };
  const [rows, unread] = await Promise.all([
    listMyNotifications(session.user.id),
    countUnreadNotifications(session.user.id),
  ]);
  return { rows, unread };
}

/**
 * The bell's "Download ZIP" action on a `reports.export_ready` notification.
 * The key comes only from a notification row written, for this same user,
 * by the `reports.export` job — never from client input — so this is safe
 * to presign without a separate ownership check.
 */
export async function getNotificationDownloadUrlAction(zipKey: string) {
  const session = await getSession();
  if (!session) return null;
  return presignGetUrl(zipKey);
}
