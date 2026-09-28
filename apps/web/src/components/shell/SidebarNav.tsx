'use client';

import { CheckCircle2, ChevronsLeft, ChevronsRight, XCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { NAV_ICONS } from './icons';
import type { NavItem } from './nav-config';

const COLLAPSE_STORAGE_KEY = 'tula:sidebar-collapsed';

function NavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = NAV_ICONS[item.icon];
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-active-bg text-active'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({
  primaryItems,
  secondaryItems,
  ledgerVerified,
  ledgerHeadShort,
}: {
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  ledgerVerified: boolean;
  ledgerHeadShort: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // localStorage unavailable (private browsing) — collapse state just won't persist.
      }
      return next;
    });
  }

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-card transition-[width]',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {primaryItems.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </div>

      <div className="space-y-0.5 border-t border-border p-2">
        {secondaryItems.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}

        <Link
          href={ROUTES.audit}
          className={cn(
            'flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted',
            collapsed && 'justify-center px-2',
          )}
        >
          {ledgerVerified ? (
            <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0 text-pass" />
          ) : (
            <XCircle aria-hidden="true" className="size-3.5 shrink-0 text-fail" />
          )}
          {collapsed ? (
            <span className="sr-only">Ledger {ledgerVerified ? 'verified' : 'unverified'}</span>
          ) : (
            <span className="tabular">
              Ledger: {ledgerVerified ? '✓' : '✕'} {ledgerHeadShort}
            </span>
          )}
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className={cn(
            'w-full',
            collapsed ? 'justify-center px-2' : 'justify-start gap-2.5 px-2.5',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {collapsed ? null : 'Collapse'}
        </Button>
      </div>
    </nav>
  );
}
