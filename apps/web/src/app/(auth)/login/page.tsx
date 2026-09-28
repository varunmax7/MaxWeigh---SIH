import { Scale } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInAction } from './actions';

export const metadata: Metadata = { title: 'Sign in' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Enter your email and password.',
  invalid: 'Incorrect email or password.',
};

/**
 * Email + password sign-in (implementation.md §7.5, §9, §10 P2/P3). A user
 * whose account has TOTP enabled is sent on to `/verify-2fa` instead of a
 * session being created directly. No self-service password reset — resets
 * are admin-initiated (implementation.md §9).
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
        className="w-full max-w-sm rounded-[var(--radius-panel)] border border-border bg-card p-8"
        aria-labelledby="login-heading"
      >
        <div className="flex items-center gap-2 text-primary">
          <Scale aria-hidden="true" className="size-6" />
          <h1 id="login-heading" className="text-2xl font-semibold">
            Tula
          </h1>
        </div>
        <p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground">
          Legal Metrology · Type evaluation
        </p>
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

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Forgot your password? Contact your lab administrator.
        </p>
      </section>
    </main>
  );
}
