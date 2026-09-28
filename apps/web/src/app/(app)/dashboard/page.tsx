import type { Metadata } from 'next';
import { requireSession } from '@/server/session';
import { signOutAction } from './actions';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Placeholder landing page — P3 builds the real app shell and dashboard
 * widgets. It exists in P2 so a sign-in has somewhere real to land, proving
 * the session/RBAC pipeline end-to-end.
 */
export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section
        className="w-full max-w-sm rounded-[var(--radius-panel)] border bg-card p-8"
        aria-labelledby="dashboard-heading"
      >
        <h1 id="dashboard-heading" className="text-2xl font-semibold text-primary">
          Signed in
        </h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{session.user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="tabular">{session.user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd>{session.user.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">2FA</dt>
            <dd>{session.user.twoFactorEnabled ? 'Enabled' : 'Not enabled'}</dd>
          </div>
        </dl>
        <p className="mt-6 rounded-[var(--radius-control)] bg-muted px-3 py-2 text-sm text-muted-foreground">
          The app shell, navigation and real dashboard arrive in P3.
        </p>
        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
