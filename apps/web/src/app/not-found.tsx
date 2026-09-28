import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ENTRY_ROUTE } from '@/lib/routes';

/** Root-level 404 — reached for an unmatched path outside `(app)` (implementation.md §10 P3). */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card p-8 text-center">
        <FileQuestion aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Button asChild size="sm">
          <Link href={ENTRY_ROUTE}>Go to sign in</Link>
        </Button>
      </section>
    </main>
  );
}
