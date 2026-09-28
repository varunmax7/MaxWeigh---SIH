import { CheckCircle2, CircleDashed, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A per-test verdict (`@tula/engine`'s `Verdict`) or an evaluation's overall verdict (`EvaluationVerdict`). */
export type VerdictChipValue = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_APPLICABLE' | 'CONFORMS' | 'DOES_NOT_CONFORM';

const CONFIG: Record<
  VerdictChipValue,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  PASS: { label: 'Pass', icon: CheckCircle2, className: 'text-pass bg-pass-bg' },
  CONFORMS: { label: 'Conforms', icon: CheckCircle2, className: 'text-pass bg-pass-bg' },
  FAIL: { label: 'Fail', icon: XCircle, className: 'text-fail bg-fail-bg' },
  DOES_NOT_CONFORM: { label: 'Does not conform', icon: XCircle, className: 'text-fail bg-fail-bg' },
  INCOMPLETE: { label: 'Incomplete', icon: CircleDashed, className: 'text-pending bg-pending-bg' },
  NOT_APPLICABLE: {
    label: 'Not applicable',
    icon: MinusCircle,
    className: 'text-muted-foreground bg-muted',
  },
};

/**
 * Verdict = icon + text + colour, never colour alone (implementation.md
 * §7.7). Covers both a single test's `Verdict` and an evaluation's overall
 * `EvaluationVerdict` — the two vocabularies overlap in every state that
 * matters visually (pass-like / fail-like / pending / not applicable).
 */
export function VerdictChip({
  verdict,
  className,
}: {
  verdict: VerdictChipValue;
  className?: string;
}) {
  const { label, icon: Icon, className: toneClassName } = CONFIG[verdict];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-chip)] px-2 py-0.5 text-xs font-medium',
        toneClassName,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
