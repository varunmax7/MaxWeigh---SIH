'use client';

import type { InstrumentMetrology, RowResult } from '@tula/engine';
import { useMemo } from 'react';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import { Inspector, VerdictChip, type VerdictChipValue } from '@/components/metrology';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { computeFastCompletionBlockers } from '@/lib/completion-blockers';

interface TempReadingDraft {
  tempC: number;
  i0: string | null;
}

export interface TempNoLoadDraft {
  readings: TempReadingDraft[];
}

function toEngineObs(draft: TempNoLoadDraft) {
  return {
    readings: draft.readings
      .filter((r) => r.i0)
      .map((r) => ({ tempC: r.tempC, i0: r.i0 as string })),
  };
}

/**
 * `TEMP_NO_LOAD` (§4.6, clause 3.9.2.3): reuses the sequence
 * `20 °C → high → low → 5 °C → 20 °C`. Pass, relative to the first
 * reading: class I ≤ 1 e per 1 °C; classes II–IIII ≤ 1 e per 5 °C.
 */
export function TempNoLoadForm({
  testId,
  spec,
  clause,
  initialDraft,
  initialRowVersion,
  readOnly,
  onStatusChange,
  onSaveNowReady,
}: {
  testId: string;
  spec: InstrumentMetrology;
  clause?: string;
  initialDraft: TempNoLoadDraft;
  initialRowVersion: number;
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const exec = useTestExecution<TempNoLoadDraft>({
    testId,
    testCode: 'TEMP_NO_LOAD',
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

  const results = useMemo(() => {
    const map = new Map<string, RowResult>();
    for (const row of exec.liveResult?.rows ?? []) map.set(row.rowId, row);
    return map;
  }, [exec.liveResult]);

  const summary = useMemo(() => {
    const rows = exec.liveResult?.rows ?? [];
    return {
      pass: rows.filter((r) => r.verdict === 'PASS').length,
      fail: rows.filter((r) => r.verdict === 'FAIL').length,
      open: exec.draft.readings.length - rows.length,
      maxAbsEcInE: null,
    };
  }, [exec.liveResult, exec.draft]);

  const blockers = computeFastCompletionBlockers({
    testCode: 'TEMP_NO_LOAD',
    result: exec.liveResult,
    envStart: null,
    envEnd: null,
  });

  function updateReading(index: number, value: string) {
    exec.updateDraft({
      readings: exec.draft.readings.map((r, i) => (i === index ? { ...r, i0: value } : r)),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No-load indication at each temperature step (reuses the temperature-sequence readings).
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Temperature</TableHead>
              <TableHead>I0</TableHead>
              <TableHead>ΔI0</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exec.draft.readings.map((reading, index) => {
              const result = results.get(`temp-${index}-${reading.tempC}C`);
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: the temperature sequence is fixed-length and never reordered/inserted (it mirrors the rule pack's own planTemperatureSequence order, which the engine itself keys rows by index for — see toEngineObs above).
                <TableRow key={`${reading.tempC}-${index}`}>
                  <TableCell className="tabular">{reading.tempC} °C</TableCell>
                  <TableCell>
                    <Input
                      aria-label={`No-load indication at ${reading.tempC} °C`}
                      value={reading.i0 ?? ''}
                      onChange={(e) => updateReading(index, e.target.value)}
                      disabled={readOnly}
                      inputMode="decimal"
                      className="tabular w-24"
                    />
                  </TableCell>
                  <TableCell className="tabular">{result?.Ec ?? '—'}</TableCell>
                  <TableCell>
                    {result ? (
                      <VerdictChip verdict={result.verdict as VerdictChipValue} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
