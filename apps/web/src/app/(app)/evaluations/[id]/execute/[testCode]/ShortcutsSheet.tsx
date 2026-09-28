'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const SHORTCUTS = [
  { keys: 'Enter', description: 'Next row, same column' },
  { keys: 'Tab', description: 'Next field' },
  { keys: 'J / K', description: 'Next / previous test in the battery' },
  { keys: '?', description: 'Show this list' },
];

/** implementation.md §7.7: "Keyboard shortcuts and a `?` sheet." */
export function ShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>Available in the test execution workspace.</SheetDescription>
        </SheetHeader>
        <ul className="space-y-2 px-4">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.description}</span>
              <kbd className="tabular rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
