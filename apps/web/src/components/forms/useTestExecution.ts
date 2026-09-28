'use client';

import type { InstrumentMetrology } from '@tula/engine';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { liveEvaluate } from '@/lib/live-evaluate';
import { completeTestAction } from '@/server/actions/execution';
import type { EnvConditionsValue } from './EnvConditions';
import { type AutosaveStatus, useAutosave } from './useAutosave';

/**
 * The orchestration every test form shares (implementation.md §10 P6).
 * Owns two distinct pieces of state on purpose:
 *
 * - `draft` — whatever shape a form's own inputs need to render (planned
 *   rows always present, `I`/`ΔL` nullable while unfilled). This is never
 *   sent to the server as-is.
 * - the engine-shaped observation, derived from `draft` via `toEngineObs`
 *   (filtered to only the rows actually entered) — what powers the live
 *   preview and what autosave actually persists. Conflating the two would
 *   mean either rendering breaks (rows with `I: null` aren't valid engine
 *   input) or the save payload fails the server's Zod schema (which has no
 *   notion of "not yet typed").
 */
export function useTestExecution<Draft>({
  testId,
  testCode,
  spec,
  initialDraft,
  toEngineObs,
  initialRowVersion,
  initialEnvStart,
  initialEnvEnd,
  initialWeightSetIds,
  onStatusChange,
  onSaveNowReady,
}: {
  testId: string;
  testCode: string;
  spec: InstrumentMetrology;
  initialDraft: Draft;
  toEngineObs: (draft: Draft) => unknown;
  initialRowVersion: number;
  initialEnvStart: EnvConditionsValue | null;
  initialEnvEnd: EnvConditionsValue | null;
  initialWeightSetIds: string[];
  /** Lets a shared header outside this form mirror the autosave status (implementation.md §7.7: "Status in header"). */
  onStatusChange?: (status: AutosaveStatus) => void;
  /** Hands the header a way to flush this form's pending save immediately (its own "Save draft" button). */
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [envStart, setEnvStart] = useState(initialEnvStart);
  const [envEnd, setEnvEnd] = useState(initialEnvEnd);
  const [weightSetIds, setWeightSetIds] = useState(initialWeightSetIds);
  const [completing, setCompleting] = useState(false);

  const autosave = useAutosave({
    testId,
    initialRowVersion,
    envStart: envStart ?? undefined,
    envEnd: envEnd ?? undefined,
    weightSetIds,
  });

  const engineObs = useMemo(() => toEngineObs(draft), [draft, toEngineObs]);
  const liveResult = useMemo(
    () => liveEvaluate(testCode, engineObs, spec),
    [testCode, engineObs, spec],
  );

  // Schedules a save whenever the engine-shaped observation, env
  // conditions, or selected standards change — not on the very first
  // render (that would resave the untouched initial state). `scheduleRef`
  // keeps this effect from needing `autosave.schedule` as a dependency:
  // that reference changes after every successful save (it closes over
  // `rowVersion`), and including it would re-fire this effect right after
  // saving — a self-sustaining autosave loop.
  const isFirstRender = useRef(true);
  const scheduleRef = useRef(autosave.schedule);
  scheduleRef.current = autosave.schedule;
  // biome-ignore lint/correctness/useExhaustiveDependencies: envStart/envEnd/weightSetIds are deliberate re-save triggers, not read in the effect body (flush reads them via metaRef); scheduleRef is a ref, not a reactive dependency.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scheduleRef.current(engineObs);
  }, [engineObs, envStart, envEnd, weightSetIds]);

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  useEffect(() => {
    onStatusChangeRef.current?.(autosave.status);
  }, [autosave.status]);

  const onSaveNowReadyRef = useRef(onSaveNowReady);
  onSaveNowReadyRef.current = onSaveNowReady;
  // biome-ignore lint/correctness/useExhaustiveDependencies: hands up a fresh closure whenever engineObs changes (so the header's button always flushes the latest draft); onSaveNowReadyRef/autosave.saveNow deliberately excluded — saveNow is stable per autosave's own memoization and reading it via the ref pattern would only add noise.
  useEffect(() => {
    onSaveNowReadyRef.current?.(async () => {
      await autosave.saveNow(engineObs);
    });
  }, [engineObs]);

  async function complete() {
    setCompleting(true);
    await autosave.saveNow(engineObs);
    const result = await completeTestAction({ testId, rowVersion: autosave.rowVersion });
    setCompleting(false);
    if (!result.ok) {
      toast.error(
        result.code === 'RULE'
          ? 'Fix the listed issues before completing.'
          : 'Could not mark this test complete.',
      );
      return;
    }
    toast.success('Test marked complete');
    router.refresh();
  }

  return {
    draft,
    updateDraft: setDraft,
    engineObs,
    liveResult,
    status: autosave.status,
    saveNow: () => autosave.saveNow(engineObs),
    envStart,
    setEnvStart,
    envEnd,
    setEnvEnd,
    weightSetIds,
    setWeightSetIds,
    complete,
    completing,
  };
}
