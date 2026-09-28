'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The error-boundary pattern for every `(app)` route (implementation.md §7,
 * §10 P3). Errors state what went wrong; this one can only say that
 * something did, since the underlying cause varies per page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card py-16 text-center"
    >
      <AlertTriangle aria-hidden="true" className="size-8 text-fail" />
      <p className="text-sm font-medium">Something went wrong loading this page</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        The error has been logged. Try again, or go back and re-enter what you were doing.
      </p>
      <Button onClick={reset} size="sm">
        Try again
      </Button>
    </div>
  );
}
