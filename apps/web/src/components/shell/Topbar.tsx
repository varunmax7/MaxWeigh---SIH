'use client';

import { Plus, Scale, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';
import type { LabMembership } from '@/server/queries/lab-memberships';
import { LabSwitcher } from './LabSwitcher';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

export function Topbar({
  labs,
  activeLabId,
  canCreateEvaluation,
  user,
  onOpenPalette,
}: {
  labs: LabMembership[];
  activeLabId: string;
  canCreateEvaluation: boolean;
  user: { name: string; email: string; role: string };
  onOpenPalette: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Link href={ROUTES.dashboard} className="flex items-center gap-1.5 font-semibold text-primary">
        <Scale aria-hidden="true" className="size-5" />
        Tula
      </Link>

      <LabSwitcher labs={labs} activeLabId={activeLabId} />

      <button
        type="button"
        onClick={onOpenPalette}
        className="flex h-8 flex-1 max-w-md items-center gap-2 rounded-[var(--radius-control)] border border-input bg-background px-3 text-sm text-muted-foreground hover:border-ring"
      >
        <Search aria-hidden="true" className="size-3.5" />
        Search reports, models, clauses…
        <kbd className="tabular ml-auto rounded border border-border bg-muted px-1 text-xs">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {canCreateEvaluation ? (
          <Button asChild size="sm">
            <Link href={ROUTES.evaluations}>
              <Plus className="size-4" />
              New evaluation
            </Link>
          </Button>
        ) : null}
        <NotificationBell />
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </header>
  );
}
