import {
  BadgeCheck,
  Ban,
  CircleDashed,
  Clock,
  FileEdit,
  FlaskConical,
  RotateCcw,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** implementation.md §6.3's evaluation states plus §5's `evaluation_tests.status`. */
export type StatusChipValue =
  | 'DRAFT'
  | 'PLANNED'
  | 'IN_TESTING'
  | 'PENDING_T1'
  | 'PENDING_T2'
  | 'PENDING_T3'
  | 'ISSUED'
  | 'RETURNED'
  | 'REVOKED'
  | 'AMENDING'
  | 'CANCELLED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REOPENED';

const LABELS: Record<StatusChipValue, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  IN_TESTING: 'In testing',
  PENDING_T1: 'Pending tier 1',
  PENDING_T2: 'Pending tier 2',
  PENDING_T3: 'Pending tier 3',
  ISSUED: 'Issued',
  RETURNED: 'Returned',
  REVOKED: 'Revoked',
  AMENDING: 'Amending',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REOPENED: 'Reopened',
};

const ICONS: Record<StatusChipValue, LucideIcon> = {
  DRAFT: FileEdit,
  PLANNED: Clock,
  IN_TESTING: FlaskConical,
  PENDING_T1: Clock,
  PENDING_T2: Clock,
  PENDING_T3: Clock,
  ISSUED: BadgeCheck,
  RETURNED: RotateCcw,
  REVOKED: ShieldAlert,
  AMENDING: FlaskConical,
  CANCELLED: Ban,
  PENDING: CircleDashed,
  IN_PROGRESS: FlaskConical,
  COMPLETED: BadgeCheck,
  REOPENED: RotateCcw,
};

/**
 * Sealed/legally-final states (`ISSUED`) use brass — nowhere else
 * (implementation.md §7.1). Everything else maps onto the ordinary
 * pending/active/fail/muted family.
 */
const TONE: Record<StatusChipValue, string> = {
  DRAFT: 'text-muted-foreground bg-muted',
  PLANNED: 'text-active bg-active-bg',
  IN_TESTING: 'text-active bg-active-bg',
  PENDING_T1: 'text-pending bg-pending-bg',
  PENDING_T2: 'text-pending bg-pending-bg',
  PENDING_T3: 'text-pending bg-pending-bg',
  ISSUED: 'text-seal bg-seal-bg',
  RETURNED: 'text-pending bg-pending-bg',
  REVOKED: 'text-fail bg-fail-bg',
  AMENDING: 'text-active bg-active-bg',
  CANCELLED: 'text-muted-foreground bg-muted',
  PENDING: 'text-muted-foreground bg-muted',
  IN_PROGRESS: 'text-active bg-active-bg',
  COMPLETED: 'text-pass bg-pass-bg',
  REOPENED: 'text-pending bg-pending-bg',
};

/** A workflow status = icon + text + colour, never colour alone (implementation.md §7.7). */
export function StatusChip({
  status,
  className,
}: {
  status: StatusChipValue;
  className?: string;
}) {
  const Icon = ICONS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-chip)] px-2 py-0.5 text-xs font-medium',
        TONE[status],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {LABELS[status]}
    </span>
  );
}
