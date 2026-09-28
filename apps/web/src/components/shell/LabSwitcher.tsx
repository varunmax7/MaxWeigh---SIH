'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { LabMembership } from '@/server/queries/lab-memberships';
import { setActiveLabAction } from './actions';

/** Only rendered for users in more than one lab (implementation.md §7.4). */
export function LabSwitcher({ labs, activeLabId }: { labs: LabMembership[]; activeLabId: string }) {
  const [pending, startTransition] = useTransition();
  if (labs.length <= 1) return null;

  const active = labs.find((lab) => lab.id === activeLabId) ?? labs[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} className="gap-1.5 font-medium">
          {active?.name}
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {labs.map((lab) => (
          <DropdownMenuItem
            key={lab.id}
            onSelect={() => startTransition(() => setActiveLabAction(lab.id))}
          >
            <span className="flex-1">{lab.name}</span>
            {lab.id === active?.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
