import { TOTP_MANDATORY_ROLES } from '@tula/db';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ROUTES } from '@/lib/routes';
import { requireSession } from '@/server/session';

/**
 * The authoritative guard for every `(app)` page (implementation.md §9,
 * §10 P2): `proxy.ts` only checks that a session cookie is present (it runs
 * in the Edge runtime and cannot reach Postgres); this runs as a Server
 * Component in the Node.js runtime, so it is where the 8-hour absolute
 * session cap (`requireSession()`) and the mandatory-TOTP-enrolment redirect
 * actually get enforced.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  const needsEnrollment =
    (TOTP_MANDATORY_ROLES as readonly string[]).includes(session.user.role) &&
    !session.user.twoFactorEnabled;

  if (needsEnrollment) {
    redirect(ROUTES.enrollTwoFactor);
  }

  return children;
}
