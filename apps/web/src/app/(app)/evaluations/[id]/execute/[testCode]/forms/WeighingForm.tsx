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

interface WeighingRow {
  rowId: string;
  L: string;
  I: string | null;
  deltaL: string | null;
}

export interface WeighingDraft {
  zeroRef: { L: string; I: string; deltaL: string };
  ascending: WeighingRow[];
  descending: WeighingRow[];
}

function toEngineObs(draft: WeighingDraft) {
  return {
    zeroRef: {
      L: draft.zeroRef.L,
      I: draft.zeroRef.I || undefined,
      deltaL: draft.zeroRef.deltaL || undefined,
    },
    ascending: draft.ascending
      .filter((r) => r.I)
      .map((r) => ({ rowId: r.rowId, L: r.L, I: r.I as string, deltaL: r.deltaL || undefined })),
    descending: draft.descending
      .filter((r) => r.I)
      .map((r) => ({ rowId: r.rowId, L: r.L, I: r.I as string, deltaL: r.deltaL || undefined })),
  };
}

function toGridRows(rows: WeighingRow[], direction: 'up' | 'down', prefix: string): GridRow[] {
  return rows.map((r) => ({
    rowId: r.rowId,
    resultKey: `${prefix}-${r.rowId}`,
    label: r.L,
    direction,
    L: r.L,
    I: r.I,
    deltaL: r.deltaL,
  }));
}

/**
 * `WEIGHING` — the flagship test form (implementation.md §7.5's reference
 * layout). Prefilled from the plan; the tester types only `I` and `ΔL`.
 */
export function WeighingForm({
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
  liveReading,
}: {
  testId: string;
  spec: InstrumentMetrology;
  clause?: string;
  initialDraft: WeighingDraft;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  initialWeightSetIds: string[];
  weightSets: WeightSetOption[];
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
  liveReading?: { tempC: number; rhPct: number; sensorId: string } | null;
}) {
  const exec = useTestExecution<WeighingDraft>({
    testId,
    testCode: 'WEIGHING',
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

  const loads = useMemo(
    () => [...exec.draft.ascending.map((r) => r.L), ...exec.draft.descending.map((r) => r.L)],
    [exec.draft],
  );

  const points = useMemo<EnvelopePoint[]>(() => {
    const build = (rows: WeighingRow[], direction: 'up' | 'down', prefix: string) =>
      rows.flatMap((r): EnvelopePoint[] => {
        const result = results.get(`${prefix}-${r.rowId}`);
        if (!result?.Ec || !result.mpe) return [];
        return [
          {
            rowId: `${prefix}-${r.rowId}`,
            L: Number(r.L),
            Ec: Number(result.Ec),
            mpe: Number(result.mpe),
            direction,
          },
        ];
      });
    return [
      ...build(exec.draft.ascending, 'up', 'asc'),
      ...build(exec.draft.descending, 'down', 'desc'),
    ];
  }, [exec.draft, results]);

  const summary = useMemo(() => {
    const rows = exec.liveResult?.rows ?? [];
    return {
      pass: rows.filter((r) => r.verdict === 'PASS').length,
      fail: rows.filter((r) => r.verdict === 'FAIL').length,
      open: exec.draft.ascending.length + exec.draft.descending.length - rows.length,
      maxAbsEcInE: exec.liveResult?.summary.maxAbsEc
        ? (rows.find((r) => r.Ec === exec.liveResult?.summary.maxAbsEc)?.EcInE ?? null)
        : null,
    };
  }, [exec.liveResult, exec.draft]);

  const blockers = computeFastCompletionBlockers({
    testCode: 'WEIGHING',
    result: exec.liveResult,
    envStart: exec.envStart,
    envEnd: exec.envEnd,
  });

  // The zero-ref row's own P/E/E0, via the same engine call the server uses
  // (computeZeroReference wraps this identically) — not re-implemented, just
  // invoked again on demand for display, since `RowResult` carries no
  // "zero row" entry of its own.
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

  function updateRow(
    direction: 'ascending' | 'descending',
    rowId: string,
    patch: Partial<WeighingRow>,
  ) {
    exec.updateDraft({
      ...exec.draft,
      [direction]: exec.draft[direction].map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
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

        <div className="space-y-2">
          <p className="text-sm font-medium">Ascending</p>
          <ObservationGrid
            rows={toGridRows(exec.draft.ascending, 'up', 'asc')}
            results={results}
            onChangeI={(rowId, v) => updateRow('ascending', rowId, { I: v })}
            onChangeDeltaL={(rowId, v) => updateRow('ascending', rowId, { deltaL: v })}
            disabled={readOnly}
          />
        </div>

        {exec.draft.descending.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Descending</p>
            <ObservationGrid
              rows={toGridRows(exec.draft.descending, 'down', 'desc')}
              results={results}
              onChangeI={(rowId, v) => updateRow('descending', rowId, { I: v })}
              onChangeDeltaL={(rowId, v) => updateRow('descending', rowId, { deltaL: v })}
              disabled={readOnly}
            />
          </div>
        ) : null}

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
