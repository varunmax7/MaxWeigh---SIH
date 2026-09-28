'use client';

import type { InstrumentMetrology } from '@tula/engine';
import { useEffect, useState } from 'react';
import { EnvConditions, type EnvConditionsValue } from '@/components/forms/EnvConditions';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import { Inspector, VerdictChip, type VerdictChipValue } from '@/components/metrology';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeFastCompletionBlockers } from '@/lib/completion-blockers';

interface CreepReadingDraft {
  tMin: number;
  i: string | null;
}

export interface CreepDraft {
  L: string;
  readings: CreepReadingDraft[];
}

function toEngineObs(draft: CreepDraft) {
  return {
    L: draft.L,
    readings: draft.readings.filter((r) => r.i).map((r) => ({ tMin: r.tMin, i: r.i as string })),
  };
}

function useElapsedMinutes(startedAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  return (now - new Date(startedAt).getTime()) / 60_000;
}

/**
 * `CREEP` (§4.6, clause 3.9.4.1): readings at 0/5/15/30 (optional 4 h)
 * minutes near Max. Shows elapsed time against the schedule as a prompt —
 * informational only, entry is never blocked on it, so this form stays
 * usable without waiting out the real clock during development/testing.
 */
export function CreepForm({
  testId,
  spec,
  clause,
  initialDraft,
  initialRowVersion,
  initialEnvStart,
  initialEnvEnd,
  startedAt,
  readOnly,
  onStatusChange,
  onSaveNowReady,
}: {
  testId: string;
  spec: InstrumentMetrology;
  clause?: string;
  initialDraft: CreepDraft;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  startedAt: string | null;
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const exec = useTestExecution<CreepDraft>({
    testId,
    testCode: 'CREEP',
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

  const elapsed = useElapsedMinutes(startedAt);
  const row = exec.liveResult?.rows[exec.liveResult.rows.length - 1];

  const summary = {
    pass: exec.liveResult?.verdict === 'PASS' ? 1 : 0,
    fail: exec.liveResult?.verdict === 'FAIL' ? 1 : 0,
    open: exec.liveResult ? 0 : 1,
    maxAbsEcInE: row?.EcInE ?? null,
  };

  const blockers = computeFastCompletionBlockers({
    testCode: 'CREEP',
    result: exec.liveResult,
    envStart: exec.envStart,
    envEnd: exec.envEnd,
  });

  function updateReading(tMin: number, value: string) {
    exec.updateDraft({
      ...exec.draft,
      readings: exec.draft.readings.map((r) => (r.tMin === tMin ? { ...r, i: value } : r)),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Load <span className="tabular font-medium">{exec.draft.L} g</span> applied near Max.
          {elapsed !== null ? (
            <span className="tabular"> Elapsed {elapsed.toFixed(1)} min.</span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-3">
          {exec.draft.readings.map((reading) => {
            const due = elapsed !== null && elapsed >= reading.tMin;
            return (
              <div key={reading.tMin} className="space-y-1">
                <Label htmlFor={`creep-${reading.tMin}`} className="text-xs text-muted-foreground">
                  t = {reading.tMin} min {elapsed !== null && !due ? '(not yet due)' : ''}
                </Label>
                <Input
                  id={`creep-${reading.tMin}`}
                  value={reading.i ?? ''}
                  onChange={(e) => updateReading(reading.tMin, e.target.value)}
                  disabled={readOnly}
                  inputMode="decimal"
                  className="tabular w-24"
                />
              </div>
            );
          })}
        </div>
        {exec.liveResult ? (
          <p className="flex items-center gap-2 text-sm">
            <VerdictChip verdict={exec.liveResult.verdict as VerdictChipValue} />
            {row?.Ec ? (
              <span className="tabular text-muted-foreground">drift {row.Ec} g</span>
            ) : null}
          </p>
        ) : null}
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
