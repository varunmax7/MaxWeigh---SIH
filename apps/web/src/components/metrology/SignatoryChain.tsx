import { BadgeCheck, CircleDashed, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIER_LABEL } from '@/server/workflow';

export interface SignatoryEntry {
  tier: 1 | 2 | 3;
  decision: 'APPROVED' | 'RETURNED' | null;
  userName: string | null;
  decidedAt: Date | null;
}

/**
 * The signatory chain (implementation.md §7.5 "Report view": "tiers with
 * brass check marks when complete"). Brass is reserved for the tier that
 * actually signed — a returned or still-pending tier stays in the ordinary
 * pending/muted palette, never brass (§7.1: "nowhere else").
 */
export function SignatoryChain({ entries }: { entries: SignatoryEntry[] }) {
  const byTier = new Map(entries.map((e) => [e.tier, e]));

  return (
    <ol className="space-y-2">
      {([1, 2, 3] as const).map((tier) => {
        const entry = byTier.get(tier);
        const signed = entry?.decision === 'APPROVED';
        const returned = entry?.decision === 'RETURNED';
        return (
          <li
            key={tier}
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm',
              signed && 'border-seal/30 bg-seal-bg',
            )}
          >
            {signed ? (
              <BadgeCheck aria-hidden="true" className="size-4 text-seal" />
            ) : returned ? (
              <RotateCcw aria-hidden="true" className="size-4 text-pending" />
            ) : (
              <CircleDashed aria-hidden="true" className="size-4 text-muted-foreground" />
            )}
            <div className="flex-1">
              <p className={cn('font-medium', signed && 'text-seal')}>{TIER_LABEL[tier]}</p>
              {entry?.userName ? (
                <p className="text-xs text-muted-foreground">
                  {entry.userName}
                  {entry.decidedAt ? ` · ${entry.decidedAt.toISOString().slice(0, 10)}` : ''}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not yet decided</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
