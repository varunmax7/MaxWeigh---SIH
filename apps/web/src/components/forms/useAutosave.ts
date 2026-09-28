'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveObservationsAction } from '@/server/actions/execution';
import type { EnvConditionsValue } from './EnvConditions';

const DEBOUNCE_MS = 800;

export type AutosaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'retrying'; at: Date }
  | { kind: 'conflict' };

/**
 * Debounced, optimistic autosave for one test's already-engine-shaped
 * observations (implementation.md §7.7: "debounced 800 ms, optimistic,
 * row_version conflict detection"). Deliberately does not own the value
 * being saved — the caller (`useTestExecution`) decides *when* to call
 * `schedule`, so a form's own raw draft state (which may have empty/partial
 * rows the engine schema would reject) never has to match what gets sent
 * on the wire. A save that lands with a stale `rowVersion` stops retrying
 * and surfaces `conflict` instead of silently overwriting someone else's
 * change.
 */
export function useAutosave({
  testId,
  initialRowVersion,
  envStart,
  envEnd,
  weightSetIds,
}: {
  testId: string;
  initialRowVersion: number;
  envStart?: EnvConditionsValue;
  envEnd?: EnvConditionsValue;
  weightSetIds?: string[];
}) {
  const [rowVersion, setRowVersion] = useState(initialRowVersion);
  const [status, setStatus] = useState<AutosaveStatus>({ kind: 'idle' });
  const [lastVerdict, setLastVerdict] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ obs: unknown; rowVersion: number } | null>(null);
  const savingRef = useRef(false);

  // Always-latest env/standards, read inside `flush` without needing them
  // as reactive dependencies (they change independently of when a save
  // actually fires).
  const metaRef = useRef({ envStart, envEnd, weightSetIds });
  metaRef.current = { envStart, envEnd, weightSetIds };

  const flush = useCallback(async () => {
    if (savingRef.current || !pendingRef.current) return;
    const { obs, rowVersion: baseVersion } = pendingRef.current;
    pendingRef.current = null;
    savingRef.current = true;
    setStatus({ kind: 'saving' });

    const meta = metaRef.current;
    const result = await saveObservationsAction({
      testId,
      observations: obs,
      rowVersion: baseVersion,
      ...(meta.envStart ? { envStart: meta.envStart } : {}),
      ...(meta.envEnd ? { envEnd: meta.envEnd } : {}),
      ...(meta.weightSetIds ? { weightSetIds: meta.weightSetIds } : {}),
    });

    savingRef.current = false;
    if (result.ok) {
      setRowVersion(result.data.rowVersion);
      setLastVerdict(result.data.verdict);
      setStatus({ kind: 'saved', at: new Date() });
      // A newer edit queued while this save was in flight — flush it too.
      if (pendingRef.current) void flush();
    } else if (result.code === 'CONFLICT') {
      setStatus({ kind: 'conflict' });
    } else if (result.code === 'RULE') {
      // `saveObservationsAction` uses `RULE` for exactly one case: the
      // observation isn't complete enough yet to validate against its
      // schema (e.g. a load row filled in before the required zero
      // reference). That's routine mid-typing, not a failure — go back to
      // idle rather than retry-looping a payload that can only become
      // valid via the tester's *next* edit, which will schedule its own,
      // superseding save anyway.
      setStatus({ kind: 'idle' });
    } else {
      setStatus({ kind: 'retrying', at: new Date() });
      pendingRef.current = { obs, rowVersion: baseVersion };
      timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    }
  }, [testId]);

  const schedule = useCallback(
    (obs: unknown) => {
      pendingRef.current = { obs, rowVersion };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [rowVersion, flush],
  );

  const saveNow = useCallback(
    (obs: unknown) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingRef.current = { obs, rowVersion };
      return flush();
    },
    [rowVersion, flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { status, rowVersion, schedule, saveNow, lastVerdict };
}
