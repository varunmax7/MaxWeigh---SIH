'use client';

import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { ROUTES } from '@/lib/routes';
import { NAV_ICONS } from './icons';
import type { NavItem } from './nav-config';

/**
 * ⌘K palette (implementation.md §7.4): static actions for P3 — jumping to
 * an evaluation/report by number or model comes with the search index (P9).
 */
export function CommandPalette({
  items,
  open,
  onOpenChange,
}: {
  items: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandInput placeholder="Search reports, models, clauses…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            return (
              <CommandItem key={item.key} onSelect={() => go(item.href)}>
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go(ROUTES.evaluations)}>
            New evaluation
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
