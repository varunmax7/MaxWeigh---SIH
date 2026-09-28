'use client';

import { errorOfIndication, type InstrumentMetrology, type RowResult } from '@tula/engine';
import { OIML_R76_1_2006 } from '@tula/rulepacks';
import { useMemo } from 'react';
import type { EnvelopePoint } from '@/components/charts/ErrorEnvelopeChart';
import { EnvConditions, type EnvConditionsValue } from '@/components/forms/EnvConditions';
import { StandardsPicker, type WeightSetOption } from '@/components/forms/StandardsPicker';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import { type GridRow, Inspector, ObservationGrid, ZeroRefRow } from '@/components/metrology';
import { computeFastCompletionBlockers } from '@/lib/completion-blockers';

interface PositionRow {
  position: string;
  L: string;
  I: string | null;
  deltaL: string | null;
}

export interface EccentricityDraft {
  zeroRef: { L: string; I: string; deltaL: string };
  positions: PositionRow[];
}

function toEngineObs(draft: EccentricityDraft) {
  return {
    zeroRef: {
      L: draft.zeroRef.L,
      I: draft.zeroRef.I || undefined,
      deltaL: draft.zeroRef.deltaL || undefined,
    },
    positions: draft.positions
      .filter((p) => p.I)
      .map((p) => ({
        position: p.position,
        L: p.L,
        I: p.I as string,
        deltaL: p.deltaL || undefined,
      })),
  };
}

/** `ECCENTRICITY` (implementation.md §4.6): every position judged against `mpe(L)`, the same shape WEIGHING uses. */
export function EccentricityForm({
  testId,
  spec,
  clause,
  initialDraft,
  initialRowVersion,
  initialEnvStart,
  initialEnvEnd,
  initialWeightSetIds,
  weightSets,
  readOnly,
  onStatusChange,
  onSaveNowReady,
}: {
  testId: string;
  spec: InstrumentMetrology;
  clause?: string;
  initialDraft: EccentricityDraft;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  initialWeightSetIds: string[];
  weightSets: WeightSetOption[];
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const exec = useTestExecution<EccentricityDraft>({
    testId,
    testCode: 'ECCENTRICITY',
    spec,
    initialDraft,
    toEngineObs,
    initialRowVersion,
    initialEnvStart,
    initialEnvEnd,
    initialWeightSetIds,
    onStatusChange,
    onSaveNowReady,
  });

  const results = useMemo(() => {
    const map = new Map<string, RowResult>();
    for (const row of exec.liveResult?.rows ?? []) map.set(row.rowId, row);
    return map;
  }, [exec.liveResult]);

  const loads = useMemo(() => exec.draft.positions.map((p) => p.L), [exec.draft]);

  const gridRows = useMemo<GridRow[]>(
    () =>
      exec.draft.positions.map((p) => ({
        rowId: p.position,
        resultKey: p.position,
        label: `${p.position} · ${p.L}`,
        L: p.L,
        I: p.I,
        deltaL: p.deltaL,
      })),
    [exec.draft],
  );

  const points = useMemo<EnvelopePoint[]>(
    () =>
      exec.draft.positions.flatMap((p): EnvelopePoint[] => {
        const result = results.get(p.position);
        if (!result?.Ec || !result.mpe) return [];
        return [
          {
            rowId: p.position,
            L: Number(p.L),
            Ec: Number(result.Ec),
            mpe: Number(result.mpe),
            direction: 'up',
          },
        ];
      }),
    [exec.draft, results],
  );

  const summary = useMemo(() => {
    const rows = exec.liveResult?.rows ?? [];
    return {
      pass: rows.filter((r) => r.verdict === 'PASS').length,
      fail: rows.filter((r) => r.verdict === 'FAIL').length,
      open: exec.draft.positions.length - rows.length,
      maxAbsEcInE: exec.liveResult?.summary.maxAbsEc
        ? (rows.find((r) => r.Ec === exec.liveResult?.summary.maxAbsEc)?.EcInE ?? null)
        : null,
    };
  }, [exec.liveResult, exec.draft]);

  const blockers = computeFastCompletionBlockers({
    testCode: 'ECCENTRICITY',
    result: exec.liveResult,
    envStart: exec.envStart,
    envEnd: exec.envEnd,
  });

  const zeroRefResult = useMemo(() => {
    const range = spec.ranges[0];
    if (!range || !exec.draft.zeroRef.I) return null;
    return errorOfIndication(
      {
        L: exec.draft.zeroRef.L,
        I: exec.draft.zeroRef.I,
        deltaL: exec.draft.zeroRef.deltaL || undefined,
      },
      range,
      OIML_R76_1_2006,
    );
  }, [spec, exec.draft.zeroRef]);

  function updatePosition(position: string, patch: Partial<PositionRow>) {
    exec.updateDraft({
      ...exec.draft,
      positions: exec.draft.positions.map((p) =>
        p.position === position ? { ...p, ...patch } : p,
      ),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <ZeroRefRow
          value={exec.draft.zeroRef}
          onChange={(zeroRef) => exec.updateDraft({ ...exec.draft, zeroRef })}
          e0={zeroRefResult?.E ?? null}
          steps={zeroRefResult?.steps ?? []}
          disabled={readOnly}
        />
        <ObservationGrid
          rows={gridRows}
          results={results}
          onChangeI={(rowId, v) => updatePosition(rowId, { I: v })}
          onChangeDeltaL={(rowId, v) => updatePosition(rowId, { deltaL: v })}
          disabled={readOnly}
        />
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
        <StandardsPicker
          weightSets={weightSets}
          selectedIds={exec.weightSetIds}
          onChange={exec.setWeightSetIds}
          loads={loads}
          spec={spec}
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
