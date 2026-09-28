'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { LabMembership } from '@/server/queries/lab-memberships';
import { CommandPalette } from './CommandPalette';
import type { NavItem } from './nav-config';
import { SidebarNav } from './SidebarNav';
import { Topbar } from './Topbar';

export function AppShellClient({
  primaryItems,
  secondaryItems,
  labs,
  activeLabId,
  canCreateEvaluation,
  user,
  ledgerVerified,
  ledgerHeadShort,
  children,
}: {
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  labs: LabMembership[];
  activeLabId: string;
  canCreateEvaluation: boolean;
  user: { name: string; email: string; role: string };
  ledgerVerified: boolean;
  ledgerHeadShort: string;
  children: ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <Topbar
        labs={labs}
        activeLabId={activeLabId}
        canCreateEvaluation={canCreateEvaluation}
        user={user}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        <SidebarNav
          primaryItems={primaryItems}
          secondaryItems={secondaryItems}
          ledgerVerified={ledgerVerified}
          ledgerHeadShort={ledgerHeadShort}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <CommandPalette items={primaryItems} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
