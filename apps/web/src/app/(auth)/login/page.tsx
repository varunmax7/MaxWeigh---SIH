import type { Metadata } from 'next';
import { signInAction } from './actions';

export const metadata: Metadata = { title: 'Sign in' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Enter your email and password.',
  invalid: 'Incorrect email or password.',
};

/**
 * Email + password sign-in (implementation.md §9, §10 P2). A user whose
 * account has TOTP enabled is sent on to `/verify-2fa` instead of a session
 * being created directly; P3 replaces this layout without changing the form.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Sign-in failed.') : null;

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

        <form action={signInAction} className="mt-6 space-y-4" noValidate>
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-[var(--radius-control)] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
