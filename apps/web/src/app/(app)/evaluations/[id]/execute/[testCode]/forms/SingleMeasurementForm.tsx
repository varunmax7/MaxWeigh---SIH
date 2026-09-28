'use client';

import type { InstrumentMetrology } from '@tula/engine';
import { useMemo } from 'react';
import type { EnvelopePoint } from '@/components/charts/ErrorEnvelopeChart';
import { EnvConditions, type EnvConditionsValue } from '@/components/forms/EnvConditions';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import { Inspector, ZeroRefRow } from '@/components/metrology';
import { computeFastCompletionBlockers } from '@/lib/completion-blockers';

export interface SingleMeasurementDraft {
  L: string;
  I: string;
  deltaL: string;
}

function toEngineObs(draft: SingleMeasurementDraft) {
  return { L: draft.L, I: draft.I || undefined, deltaL: draft.deltaL || undefined };
}

/**
 * `ZERO_ACCURACY` (§4.6: `|E0| ≤ 0.25 e`) and `TARE_ACCURACY` (§4.6: `≤ 0.25
 * e` after tare balancing) — both a single near-zero reading judged against
 * a fixed multiple of `e`, not `mpe(L)`, so no standards picker applies.
 */
export function SingleMeasurementForm({
  testId,
  testCode,
  spec,
  clause,
  rowLabel,
  initialDraft,
  initialRowVersion,
  initialEnvStart,
  initialEnvEnd,
  readOnly,
  onStatusChange,
  onSaveNowReady,
}: {
  testId: string;
  testCode: string;
  spec: InstrumentMetrology;
  clause?: string;
  rowLabel: string;
  initialDraft: SingleMeasurementDraft;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const exec = useTestExecution<SingleMeasurementDraft>({
    testId,
    testCode,
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

  const row = exec.liveResult?.rows[0];

  const points = useMemo<EnvelopePoint[]>(() => {
    if (!row?.Ec || !row.mpe) return [];
    return [
      {
        rowId: 'measurement',
        L: Number(exec.draft.L),
        Ec: Number(row.Ec),
        mpe: Number(row.mpe),
        direction: 'up',
      },
    ];
  }, [row, exec.draft.L]);

  const summary = {
    pass: row?.verdict === 'PASS' ? 1 : 0,
    fail: row?.verdict === 'FAIL' ? 1 : 0,
    open: row ? 0 : 1,
    maxAbsEcInE: row?.EcInE ?? null,
  };

  const blockers = computeFastCompletionBlockers({
    testCode,
    result: exec.liveResult,
    envStart: exec.envStart,
    envEnd: exec.envEnd,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <ZeroRefRow
          value={{ L: exec.draft.L, I: exec.draft.I, deltaL: exec.draft.deltaL }}
          onChange={(v) => exec.updateDraft(v)}
          e0={row?.Ec ?? null}
          steps={row?.steps ?? []}
          disabled={readOnly}
        />
        <p className="text-sm text-muted-foreground">{rowLabel}</p>
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
        points={points}
        blockers={blockers}
        readOnly={readOnly}
        canComplete={blockers.length === 0}
        onComplete={exec.complete}
        completing={exec.completing}
      />
    </div>
  );
}
