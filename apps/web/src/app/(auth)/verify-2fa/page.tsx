import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyTotpAction } from './actions';

export const metadata: Metadata = { title: 'Verify your identity' };

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Enter the 6-digit code from your authenticator app.',
  invalid: 'That code did not match. Try the next code your app generates.',
};

/**
 * The TOTP challenge shown after a password sign-in for an account with
 * two-factor authentication enabled (implementation.md §9).
 */
export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Verification failed.') : null;

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section
        className="w-full max-w-sm rounded-[var(--radius-panel)] border border-border bg-card p-8"
        aria-labelledby="verify-heading"
      >
        <h1 id="verify-heading" className="text-2xl font-semibold text-primary">
          Verify your identity
        </h1>
        <p className="mt-3 text-sm leading-5 text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>

        <form action={verifyTotpAction} className="mt-6 space-y-4" noValidate>
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={6}
              maxLength={6}
              required
              className="tabular"
            />
          </div>

          <Button type="submit" className="w-full">
            Verify
          </Button>
        </form>
      </section>
    </main>
  );
}
