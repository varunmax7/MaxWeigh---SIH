import type { Metadata } from 'next';
import { requireSession } from '@/server/session';
import { EnrollForm } from './EnrollForm';

export const metadata: Metadata = { title: 'Set up two-factor authentication' };

/**
 * Shown instead of the dashboard when a privileged role signs in without
 * TOTP enabled yet (implementation.md §9: mandatory for ADMIN, STO, CMO,
 * CONTROLLER). Reachable only with a session — `proxy.ts` is what redirects
 * privileged, unenrolled users here in the first place.
 */
export default async function EnrollTwoFactorPage() {
  const session = await requireSession();

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section
        className="w-full max-w-sm rounded-[var(--radius-panel)] border bg-card p-8"
        aria-labelledby="enroll-heading"
      >
        <h1 id="enroll-heading" className="text-2xl font-semibold text-primary">
          Set up two-factor authentication
        </h1>
        <p className="mt-3 text-sm leading-5 text-muted-foreground">
          Your role ({session.user.role.replaceAll('_', ' ').toLowerCase()}) requires an
          authenticator app before you can continue.
        </p>
        <EnrollForm />
      </section>
    </main>
  );
}
