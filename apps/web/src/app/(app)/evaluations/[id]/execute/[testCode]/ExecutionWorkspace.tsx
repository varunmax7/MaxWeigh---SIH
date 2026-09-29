'use client';

import type { InstrumentMetrology } from '@tula/engine';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { WeightSetOption } from '@/components/forms/StandardsPicker';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import { type BatteryTest, TestBatteryList } from '@/components/metrology';
import { SerialReadPanel } from '@/components/workspace/SerialReadPanel';
import { useEnvStream } from '@/components/workspace/useEnvStream';
import { startTestAction } from '@/server/actions/execution';
import { ExecutionHeader } from './ExecutionHeader';
import { FormDispatcher } from './FormDispatcher';
import { ShortcutsSheet } from './ShortcutsSheet';

interface TestRow {
  id: string;
  testCode: string;
  clause?: string;
  params: Record<string, unknown> | null;
  observations: Record<string, unknown> | null;
  rowVersion: number;
  envStart: unknown;
  envEnd: unknown;
  weightSetIds: string[] | null;
  status: string;
  startedAt: Date | null;
}

/**
 * The three-pane test execution workspace (implementation.md §7.5): test
 * battery, the active test's form, and (inside each form) the Inspector.
 * Starts the test (PENDING/REOPENED → IN_PROGRESS) once on mount — the
 * bench officer opening this page *is* starting the test, per §6.3's
 * "PLANNED --> IN_TESTING: first test started".
 */
export function ExecutionWorkspace({
  evaluationId,
  labId,
  refNo,
  modelLabel,
  spec,
  test,
  battery,
  activeRangeIndex,
  weightSets,
  readOnly,
}: {
  evaluationId: string;
  labId: string;
  refNo: string;
  modelLabel: string;
  spec: InstrumentMetrology;
  test: TestRow;
  battery: BatteryTest[];
  activeRangeIndex: number;
  weightSets: WeightSetOption[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const envStream = useEnvStream(labId);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Mirrored from the active form's own `useTestExecution` via
  // `onStatusChange`/`onSaveNowReady` — the header renders status and
  // triggers an immediate save without owning the autosave state itself
  // (each form still owns that, since only it knows its engine-shaped obs).
  const [headerStatus, setHeaderStatus] = useState<AutosaveStatus>({ kind: 'idle' });
  const saveNowRef = useRef<() => Promise<void>>(async () => {});

  // Deliberately keyed on `test.id` alone: a route change to a different
  // test remounts this component entirely (new [testCode]/[id] params), so
  // this effect only ever needs to run once per mounted test id, not
  // whenever `readOnly`/`test.status` happen to be recomputed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above.
  useEffect(() => {
    if (!readOnly && (test.status === 'PENDING' || test.status === 'REOPENED')) {
      void startTestAction({ testId: test.id });
    }
  }, [test.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;

      if (e.key === '?') {
        setShortcutsOpen(true);
        return;
      }
      if (e.key !== 'j' && e.key !== 'k') return;

      const applicable = battery.filter((t) => t.applicability === 'APPLICABLE');
      const currentIndex = applicable.findIndex(
        (t) => t.testCode === test.testCode && t.rangeIndex === activeRangeIndex,
      );
      if (currentIndex === -1) return;
      const nextIndex = e.key === 'j' ? currentIndex + 1 : currentIndex - 1;
      const next = applicable[nextIndex];
      if (next) {
        router.push(
          `/evaluations/${evaluationId}/execute/${next.testCode}?range=${next.rangeIndex}`,
        );
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [battery, test.testCode, activeRangeIndex, evaluationId, router]);

  return (
    <div className="space-y-4">
      <ExecutionHeader
        refNo={refNo}
        modelLabel={modelLabel}
        accuracyClass={spec.accuracyClass}
        max={spec.ranges[spec.ranges.length - 1]?.max ?? '0'}
        min={spec.min}
        e={spec.ranges[0]?.e ?? '0'}
        d={spec.ranges[0]?.d ?? '0'}
        displayUnit={spec.displayUnit}
        status={headerStatus}
        onSaveNow={() => void saveNowRef.current()}
        testCode={test.testCode}
        envStream={envStream}
      />

      {readOnly ? null : <SerialReadPanel />}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <TestBatteryList
          evaluationId={evaluationId}
          tests={battery}
          activeTestCode={test.testCode}
          activeRangeIndex={activeRangeIndex}
        />
        <FormDispatcher
          test={test}
          spec={spec}
          weightSets={weightSets}
          readOnly={readOnly}
          onStatusChange={setHeaderStatus}
          onSaveNowReady={(fn) => {
            saveNowRef.current = fn;
          }}
          liveReading={
            envStream.status === 'live' && envStream.reading
              ? {
                  tempC: envStream.reading.tempC,
                  rhPct: envStream.reading.rhPct,
                  sensorId: envStream.reading.sensorId,
                }
              : null
          }
        />
      </div>

      <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
