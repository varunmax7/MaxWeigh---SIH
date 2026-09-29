'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { globalSearchAction } from '@/server/actions/search';
import type { SearchResult } from '@/server/queries/search';
import { NAV_ICONS } from './icons';
import type { NavItem } from './nav-config';

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  evaluation: 'Evaluations',
  report: 'Reports',
  model: 'Instrument models',
  manufacturer: 'Manufacturers',
};

const SEARCH_DEBOUNCE_MS = 200;

/**
 * ⌘K palette (implementation.md §7.4, §10 P9: "wired to search (reports,
 * evaluations, models, manufacturers)"). Static "Go to"/"Actions" groups
 * stay for an empty query; typing ≥ 2 characters switches to ranked search
 * results grouped by kind.
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void globalSearchAction(trimmed).then((rows) => {
        if (!cancelled) setResults(rows);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const grouped = new Map<SearchResult['kind'], SearchResult[]>();
  for (const result of results) {
    const list = grouped.get(result.kind) ?? [];
    list.push(result);
    grouped.set(result.kind, list);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search reports, evaluations, models, manufacturers…"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {query.trim().length >= 2 ? (
          [...grouped.entries()].map(([kind, rows]) => (
            <CommandGroup key={kind} heading={KIND_LABEL[kind]}>
              {rows.map((row) => (
                <CommandItem key={`${kind}-${row.id}`} onSelect={() => go(row.href)}>
                  <span className="tabular">{row.title}</span>
                  <span className="ml-2 truncate text-muted-foreground">{row.subtitle}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))
        ) : (
          <>
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
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
