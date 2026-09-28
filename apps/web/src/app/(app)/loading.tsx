import { Skeleton } from '@/components/ui/skeleton';

/**
 * The loading pattern for every `(app)` route (implementation.md §7.7:
 * "skeletons shaped like the content; no spinners on full pages"). Shaped
 * like a generic page: header, then a few content blocks — the closest
 * approximation available before a specific route has its own.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2 border-b border-border pb-4">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-10 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-10 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-10 w-3/4 rounded-[var(--radius-panel)]" />
      </div>
    </div>
  );
}
