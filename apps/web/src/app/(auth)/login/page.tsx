import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Placeholder sign-in screen.
 *
 * P2 replaces this with the Better Auth email + password form and TOTP step;
 * P3 gives it the finished layout. It exists in P0 so the app has a reachable
 * entry point and `/` has somewhere to redirect to.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section
        className="w-full max-w-sm rounded-[var(--radius-panel)] border bg-card p-8"
        aria-labelledby="login-heading"
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          Legal Metrology · Type evaluation
        </p>
        <h1 id="login-heading" className="mt-2 text-2xl font-semibold text-primary">
          Tula
        </h1>
        <p className="mt-3 text-sm leading-5 text-muted-foreground">
          Type evaluation and test reporting for non-automatic weighing instruments under OIML
          R&nbsp;76-1:2006.
        </p>
        <p className="mt-6 rounded-[var(--radius-control)] bg-muted px-3 py-2 text-sm text-muted-foreground">
          Sign-in arrives in P2, with the authentication and role model.
        </p>
      </section>
    </main>
  );
}
