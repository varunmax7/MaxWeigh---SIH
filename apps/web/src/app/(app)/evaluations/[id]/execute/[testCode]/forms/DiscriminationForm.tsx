'use client';

import type { InstrumentMetrology, RowResult } from '@tula/engine';
import { useMemo } from 'react';
import { EnvConditions, type EnvConditionsValue } from '@/components/forms/EnvConditions';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import {
  CalcExplainer,
  Inspector,
  VerdictChip,
  type VerdictChipValue,
} from '@/components/metrology';
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

interface DiscriminationRow {
  rowId: string;
  L: string;
  iBefore: string | null;
  iAfter: string | null;
}

export interface DiscriminationDraft {
  rows: DiscriminationRow[];
  extraLoad: string;
}

function toEngineObs(draft: DiscriminationDraft) {
  return {
    rows: draft.rows
      .filter((r) => r.iBefore && r.iAfter)
      .map((r) => ({ rowId: r.rowId, iBefore: r.iBefore as string, iAfter: r.iAfter as string })),
  };
}

/** `DISCRIMINATION` (§4.6, clause 3.8): at Min/½Max/Max, adding `1.4 d` must move the indication by exactly one `d`. */
export function DiscriminationForm({
  testId,
  spec,
  clause,
  initialDraft,
  initialRowVersion,
  initialEnvStart,
  initialEnvEnd,
  readOnly,
  onStatusChange,
  onSaveNowReady,
  liveReading,
}: {
  testId: string;
  spec: InstrumentMetrology;
  clause?: string;
  initialDraft: DiscriminationDraft;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
  liveReading?: { tempC: number; rhPct: number; sensorId: string } | null;
}) {
  const exec = useTestExecution<DiscriminationDraft>({
    testId,
    testCode: 'DISCRIMINATION',
    spec,
    initialDraft,
    toEngineObs,
    initialRowVersion,
    initialEnvStart,
    initialEnvEnd,
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
      open: exec.draft.rows.length - rows.length,
      maxAbsEcInE: null,
    };
  }, [exec.liveResult, exec.draft]);

  const blockers = computeFastCompletionBlockers({
    testCode: 'DISCRIMINATION',
    result: exec.liveResult,
    envStart: exec.envStart,
    envEnd: exec.envEnd,
  });

  function updateRow(rowId: string, patch: Partial<DiscriminationRow>) {
    exec.updateDraft({
      ...exec.draft,
      rows: exec.draft.rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add an extra load of <span className="tabular font-medium">{exec.draft.extraLoad} g</span>{' '}
          to each reading, then record the indication before and after.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Load L</TableHead>
              <TableHead>I before</TableHead>
              <TableHead>I after</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exec.draft.rows.map((row) => {
              const result = results.get(row.rowId);
              return (
                <TableRow key={row.rowId}>
                  <TableCell className="tabular">{row.L}</TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Indication before, load `}
                      data-serial-target="true"
                      value={row.iBefore ?? ''}
                      onChange={(e) => updateRow(row.rowId, { iBefore: e.target.value })}
                      disabled={readOnly}
                      inputMode="decimal"
                      className="tabular w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Indication after, load `}
                      data-serial-target="true"
                      value={row.iAfter ?? ''}
                      onChange={(e) => updateRow(row.rowId, { iAfter: e.target.value })}
                      disabled={readOnly}
                      inputMode="decimal"
                      className="tabular w-24"
                    />
                  </TableCell>
                  <TableCell className="tabular">{result?.Ec ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {result ? (
                        <VerdictChip verdict={result.verdict as VerdictChipValue} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      <CalcExplainer steps={result?.steps ?? []} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <EnvConditions
          label="Start conditions"
          value={exec.envStart}
          onChange={exec.setEnvStart}
          liveReading={liveReading}
          disabled={readOnly}
        />
        <EnvConditions
          label="End conditions"
          value={exec.envEnd}
          onChange={exec.setEnvEnd}
          liveReading={liveReading}
          disabled={readOnly}
        />
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
