import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Brass — reserved for legal finality: a sealed certificate, a completed
 * signatory tier, a VALID verification (implementation.md §7.1). Never used
 * for anything else, including "in progress toward sealed".
 */
export function SealMark({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-seal-bg px-2 py-0.5 text-xs font-semibold text-seal',
        className,
      )}
    >
      <BadgeCheck aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
