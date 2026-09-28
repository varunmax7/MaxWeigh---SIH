'use client';

import type { InstrumentMetrology, RowResult } from '@tula/engine';
import { useMemo } from 'react';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import { Inspector, VerdictChip, type VerdictChipValue } from '@/components/metrology';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { computeFastCompletionBlockers } from '@/lib/completion-blockers';

/**
 * Checklist items per §4.6 — hand-transcribed since neither test code's
 * catalog entry breaks its checklist into a machine-readable item list
 * (EXAM_MARKINGS names the mandatory markings in prose; EXAM_CONSTRUCTION
 * points to Annex A without itemizing it). Conservative, logged in
 * docs/QUESTIONS.md — a human should confirm this matches the source PDF.
 */
export const CHECKLIST_ITEMS: Record<string, { key: string; label: string }[]> = {
  EXAM_MARKINGS: [
    { key: 'manufacturer_mark', label: 'Manufacturer mark or name' },
    { key: 'accuracy_class', label: 'Accuracy class' },
    { key: 'max', label: 'Max' },
    { key: 'min', label: 'Min' },
    { key: 'e', label: 'e' },
    { key: 'd', label: 'd (if different from e)' },
    { key: 'tare_capacity', label: 'T, tare capacity (if applicable)' },
    { key: 'type_approval_sign', label: 'Type approval sign' },
    { key: 'serial_no', label: 'Serial number' },
    { key: 'temp_range', label: 'Temperature range (if different from −10/+40 °C)' },
    { key: 'power_supply', label: 'Power supply data' },
  ],
  EXAM_CONSTRUCTION: [
    { key: 'construction_vs_docs', label: 'Construction matches the approval documentation' },
    { key: 'sealing', label: 'Sealing provisions' },
    { key: 'software_identification', label: 'Software identification' },
  ],
};

export type ChecklistStatus = 'ok' | 'fail' | 'not_applicable';

interface ChecklistItemDraft {
  key: string;
  status: ChecklistStatus | '';
  note: string;
}

export interface ChecklistDraft {
  items: ChecklistItemDraft[];
}

function toEngineObs(draft: ChecklistDraft) {
  return {
    items: draft.items
      .filter((i) => i.status)
      .map((i) => ({ key: i.key, status: i.status as ChecklistStatus, note: i.note || undefined })),
  };
}

/** `EXAM_MARKINGS` / `EXAM_CONSTRUCTION` (§4.6): a checklist, not a measurement. */
export function ChecklistForm({
  testId,
  testCode,
  spec,
  clause,
  initialDraft,
  initialRowVersion,
  readOnly,
  onStatusChange,
  onSaveNowReady,
}: {
  testId: string;
  testCode: 'EXAM_MARKINGS' | 'EXAM_CONSTRUCTION';
  spec: InstrumentMetrology;
  clause?: string;
  initialDraft: ChecklistDraft;
  initialRowVersion: number;
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const exec = useTestExecution<ChecklistDraft>({
    testId,
    testCode,
    spec,
    initialDraft,
    toEngineObs,
    initialRowVersion,
    initialEnvStart: null,
    initialEnvEnd: null,
    initialWeightSetIds: [],
    onStatusChange,
    onSaveNowReady,
  });

  const items = CHECKLIST_ITEMS[testCode] ?? [];
  const resultByKey = useMemo(() => {
    const map = new Map<string, RowResult>();
    for (const row of exec.liveResult?.rows ?? []) map.set(row.rowId, row);
    return map;
  }, [exec.liveResult]);

  const summary = useMemo(() => {
    const rows = exec.liveResult?.rows ?? [];
    return {
      pass: rows.filter((r) => r.verdict === 'PASS').length,
      fail: rows.filter((r) => r.verdict === 'FAIL').length,
      open: items.length - rows.length,
      maxAbsEcInE: null,
    };
  }, [exec.liveResult, items]);

  const blockers = computeFastCompletionBlockers({
    testCode,
    result: exec.liveResult,
    envStart: null,
    envEnd: null,
  });

  function updateItem(key: string, patch: Partial<ChecklistItemDraft>) {
    exec.updateDraft({
      items: exec.draft.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-1">
        {items.map((item) => {
          const draftItem = exec.draft.items.find((i) => i.key === item.key);
          const result = resultByKey.get(item.key);
          return (
            <div
              key={item.key}
              className="flex flex-wrap items-center gap-3 border-b border-border py-2 last:border-0"
            >
              <p className="flex-1 text-sm">{item.label}</p>
              <Select
                value={draftItem?.status ?? ''}
                onValueChange={(v) => updateItem(item.key, { status: v as ChecklistStatus })}
                disabled={readOnly}
              >
                <SelectTrigger aria-label={`Status for ${item.label}`} className="w-36">
                  <SelectValue placeholder="Not checked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">Present and legible</SelectItem>
                  <SelectItem value="fail">Missing or illegible</SelectItem>
                  <SelectItem value="not_applicable">Not applicable</SelectItem>
                </SelectContent>
              </Select>
              {draftItem?.status === 'fail' ? (
                <Input
                  aria-label={`Note for ${item.label}`}
                  placeholder="Note"
                  value={draftItem.note}
                  onChange={(e) => updateItem(item.key, { note: e.target.value })}
                  disabled={readOnly}
                  className="w-48"
                />
              ) : null}
              {result ? <VerdictChip verdict={result.verdict as VerdictChipValue} /> : null}
            </div>
          );
        })}
      </div>

      <Inspector
        testId={testId}
        clause={clause}
        summary={summary}
        points={[]}
        blockers={blockers}
        readOnly={readOnly}
        canComplete={blockers.length === 0}
        onComplete={exec.complete}
        completing={exec.completing}
      />
    </div>
  );
}
