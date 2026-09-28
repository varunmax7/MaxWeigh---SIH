'use client';

import type { InstrumentMetrology, RowResult } from '@tula/engine';
import { useMemo } from 'react';
import { EnvConditions, type EnvConditionsValue } from '@/components/forms/EnvConditions';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import { Inspector, VerdictChip, type VerdictChipValue } from '@/components/metrology';
import { Input } from '@/components/ui/input';
import { computeFastCompletionBlockers } from '@/lib/completion-blockers';

interface ReadingDraft {
  rowId: string;
  I: string | null;
}

interface SeriesDraft {
  L: string;
  readings: ReadingDraft[];
}

export interface RepeatabilityDraft {
  series: SeriesDraft[];
}

function toEngineObs(draft: RepeatabilityDraft) {
  return {
    series: draft.series.map((s) => ({
      L: s.L,
      readings: s.readings.filter((r) => r.I).map((r) => ({ rowId: r.rowId, I: r.I as string })),
    })),
  };
}

/** `REPEATABILITY` (§4.6, clause 3.6.1): per series, `max(P) − min(P) ≤ |mpe(L)|`. */
export function RepeatabilityForm({
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
}: {
  testId: string;
  spec: InstrumentMetrology;
  clause?: string;
  initialDraft: RepeatabilityDraft;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const exec = useTestExecution<RepeatabilityDraft>({
    testId,
    testCode: 'REPEATABILITY',
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

  const seriesResults = useMemo(() => {
    const map = new Map<string, RowResult>();
    for (const row of exec.liveResult?.rows ?? []) map.set(row.rowId, row);
    return map;
  }, [exec.liveResult]);

  const summary = useMemo(() => {
    const rows = exec.liveResult?.rows ?? [];
    return {
      pass: rows.filter((r) => r.verdict === 'PASS').length,
      fail: rows.filter((r) => r.verdict === 'FAIL').length,
      open: exec.draft.series.length - rows.length,
      maxAbsEcInE: null,
    };
  }, [exec.liveResult, exec.draft]);

  const blockers = computeFastCompletionBlockers({
    testCode: 'REPEATABILITY',
    result: exec.liveResult,
    envStart: exec.envStart,
    envEnd: exec.envEnd,
  });

  function updateReading(seriesIndex: number, rowId: string, value: string) {
    exec.updateDraft({
      series: exec.draft.series.map((s, i) =>
        i === seriesIndex
          ? { ...s, readings: s.readings.map((r) => (r.rowId === rowId ? { ...r, I: value } : r)) }
          : s,
      ),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {exec.draft.series.map((series, seriesIndex) => {
          const result = seriesResults.get(`series-${seriesIndex}`);
          return (
            <div key={series.L} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Series at <span className="tabular">{series.L} g</span>
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="tabular text-muted-foreground">
                    spread {result?.Ec ?? '—'} (mpe ±{result?.mpe ?? '—'})
                  </span>
                  {result ? <VerdictChip verdict={result.verdict as VerdictChipValue} /> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {series.readings.map((reading, i) => (
                  <div key={reading.rowId} className="space-y-1">
                    <label
                      htmlFor={`${series.L}-${reading.rowId}`}
                      className="text-xs text-muted-foreground"
                    >
                      #{i + 1}
                    </label>
                    <Input
                      id={`${series.L}-${reading.rowId}`}
                      value={reading.I ?? ''}
                      onChange={(e) => updateReading(seriesIndex, reading.rowId, e.target.value)}
                      disabled={readOnly}
                      inputMode="decimal"
                      className="tabular w-20"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <EnvConditions
          label="Start conditions"
          value={exec.envStart}
          onChange={exec.setEnvStart}
          disabled={readOnly}
        />
        <EnvConditions
          label="End conditions"
          value={exec.envEnd}
          onChange={exec.setEnvEnd}
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
