import { cn } from '@/lib/utils';

/**
 * The OIML accuracy class of an instrument (`AccuracyClass`: I/II/III/IIII)
 * or a reference weight set (`OimlWeightClass`: E1/E2/F1/F2/M1/M2/M3) — a
 * short code, set in monospace like the other IDs and clause numbers it
 * sits next to (implementation.md §7.3).
 */
export function ClassBadge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        'tabular inline-flex items-center rounded-[var(--radius-chip)] border border-border px-1.5 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      {value}
    </span>
  );
}
