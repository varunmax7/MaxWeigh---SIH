import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';

/** Renders inside the app shell (implementation.md §10 P3) — e.g. a route not built yet. */
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border py-16 text-center">
      <FileQuestion aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Page not found</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page doesn't exist or hasn't been built yet.
      </p>
      <Button asChild size="sm">
        <Link href={ROUTES.dashboard}>Back to dashboard</Link>
      </Button>
    </div>
  );
}
