'use client';

import type { InstrumentMetrology } from '@tula/engine';
import { useMemo } from 'react';
import { EnvConditions, type EnvConditionsValue } from '@/components/forms/EnvConditions';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { useTestExecution } from '@/components/forms/useTestExecution';
import { Inspector } from '@/components/metrology';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeFastCompletionBlockers } from '@/lib/completion-blockers';

export interface ZeroReturnDraft {
  i0Before: string;
  i0After: string;
}

function toEngineObs(draft: ZeroReturnDraft) {
  return draft.i0Before && draft.i0After
    ? { i0Before: draft.i0Before, i0After: draft.i0After }
    : null;
}

/** `ZERO_RETURN` (§4.6, clause 3.9.4.2): `|ΔI0| ≤ 0.5 e`, before/after a 30-minute load. */
export function ZeroReturnForm({
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
  initialDraft: ZeroReturnDraft;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const exec = useTestExecution<ZeroReturnDraft>({
    testId,
    testCode: 'ZERO_RETURN',
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

  const summary = useMemo(
    () => ({
      pass: row?.verdict === 'PASS' ? 1 : 0,
      fail: row?.verdict === 'FAIL' ? 1 : 0,
      open: row ? 0 : 1,
      maxAbsEcInE: row?.EcInE ?? null,
    }),
    [row],
  );

  const blockers = computeFastCompletionBlockers({
    testCode: 'ZERO_RETURN',
    result: exec.liveResult,
    envStart: exec.envStart,
    envEnd: exec.envEnd,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] border border-border p-2">
          <div className="space-y-1">
            <Label htmlFor="i0-before" className="text-xs text-muted-foreground">
              I0 before the 30-minute load
            </Label>
            <Input
              id="i0-before"
              value={exec.draft.i0Before}
              onChange={(e) => exec.updateDraft({ ...exec.draft, i0Before: e.target.value })}
              disabled={readOnly}
              inputMode="decimal"
              className="tabular w-28"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="i0-after" className="text-xs text-muted-foreground">
              I0 after removal (stable)
            </Label>
            <Input
              id="i0-after"
              value={exec.draft.i0After}
              onChange={(e) => exec.updateDraft({ ...exec.draft, i0After: e.target.value })}
              disabled={readOnly}
              inputMode="decimal"
              className="tabular w-28"
            />
          </div>
          <div className="pb-1.5 text-sm">
            <span className="text-muted-foreground">→ ΔI0</span>{' '}
            <span className="tabular font-medium">{row?.Ec ?? '—'} g</span>
          </div>
        </div>
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
