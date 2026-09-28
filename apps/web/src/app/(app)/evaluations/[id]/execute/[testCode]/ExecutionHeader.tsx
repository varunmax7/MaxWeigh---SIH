'use client';

import type { AccuracyClass, Dec, DisplayUnit } from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { Save } from 'lucide-react';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { SpecLine } from '@/components/metrology';
import { Button } from '@/components/ui/button';

function statusText(status: AutosaveStatus): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return `Saved ${status.at.toLocaleTimeString()}`;
    case 'retrying':
      return 'Not saved — retrying';
    case 'conflict':
      return 'Someone else changed this test. Reload to see their changes.';
  }
}

/**
 * The execution workspace header (implementation.md §7.5's reference
 * layout): ref no + instrument summary, autosave status (§7.7: "Status in
 * header"), save-now action. `aria-live="polite"` on the status line
 * (§7.9: "aria-live for autosave and verdict changes").
 */
export function ExecutionHeader({
  refNo,
  modelLabel,
  accuracyClass,
  max,
  min,
  e,
  d,
  displayUnit,
  status,
  onSaveNow,
  testCode,
}: {
  refNo: string;
  modelLabel: string;
  accuracyClass: AccuracyClass;
  max: Dec;
  min: Dec;
  e: Dec;
  d: Dec;
  displayUnit: DisplayUnit;
  status: AutosaveStatus;
  onSaveNow: () => void;
  testCode: string;
}) {
  const testTitle = OIML_R76_1_2006.tests.find((t) => t.code === testCode)?.title ?? testCode;
  return (
    <div className="space-y-2 border-b border-border pb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="tabular text-sm font-medium">
            {refNo} <span className="text-muted-foreground">{modelLabel}</span>
          </p>
          <p className="text-sm text-muted-foreground">{testTitle}</p>
        </div>
        <SpecLine
          accuracyClass={accuracyClass}
          max={max}
          maxUnit={displayUnit}
          min={min}
          e={e}
          d={d}
          smallUnit="g"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p aria-live="polite" className="tabular text-xs text-muted-foreground">
          {statusText(status)}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onSaveNow}>
          <Save className="size-4" />
          Save draft
        </Button>
      </div>
    </div>
  );
}
