'use client';

import type { InstrumentMetrology } from '@tula/engine';
import { useMemo } from 'react';
import type { EnvConditionsValue } from '@/components/forms/EnvConditions';
import type { WeightSetOption } from '@/components/forms/StandardsPicker';
import type { AutosaveStatus } from '@/components/forms/useAutosave';
import {
  buildChecklistDraft,
  buildCreepDraft,
  buildDiscriminationDraft,
  buildEccentricityDraft,
  buildRepeatabilityDraft,
  buildTempNoLoadDraft,
  buildWeighingDraft,
  buildZeroBasedDraft,
  buildZeroReturnDraft,
} from './build-draft';
import { CHECKLIST_ITEMS, ChecklistForm } from './forms/ChecklistForm';
import { CreepForm } from './forms/CreepForm';
import { DiscriminationForm } from './forms/DiscriminationForm';
import { EccentricityForm } from './forms/EccentricityForm';
import { RepeatabilityForm } from './forms/RepeatabilityForm';
import { SingleMeasurementForm } from './forms/SingleMeasurementForm';
import { TempNoLoadForm } from './forms/TempNoLoadForm';
import { WeighingForm } from './forms/WeighingForm';
import { ZeroReturnForm } from './forms/ZeroReturnForm';

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
 * Dispatches by test code to its form (implementation.md §10 P6: "Build
 * MVP tests first"). `EXAM_MARKINGS`/`EXAM_CONSTRUCTION`/`ZERO_ACCURACY`/
 * `WEIGHING`/`ECCENTRICITY`/`DISCRIMINATION`/`REPEATABILITY`/`CREEP`/
 * `ZERO_RETURN`/`TEMP_NO_LOAD` are the MVP set; `TARE_ACCURACY` is
 * implemented too (registered in the engine, not MVP-flagged); every other
 * catalog code shows a placeholder rather than crashing — its evaluator
 * isn't registered yet (§10 P1 follow-up, docs/QUESTIONS.md #12), so there
 * is nothing this dispatcher could correctly render for it.
 */
export function FormDispatcher({
  test,
  spec,
  weightSets,
  readOnly,
  onStatusChange,
  onSaveNowReady,
  liveReading,
}: {
  test: TestRow;
  spec: InstrumentMetrology;
  weightSets: WeightSetOption[];
  readOnly: boolean;
  onStatusChange?: (status: AutosaveStatus) => void;
  onSaveNowReady?: (saveNow: () => Promise<void>) => void;
  /** A live env-sensor reading (implementation.md §10 P10) — passed through to whichever form renders `EnvConditions`. */
  liveReading?: { tempC: number; rhPct: number; sensorId: string } | null;
}) {
  const common = {
    testId: test.id,
    spec,
    clause: test.clause,
    initialRowVersion: test.rowVersion,
    readOnly,
    onStatusChange,
    onSaveNowReady,
    liveReading,
  };
  const initialEnvStart = (test.envStart as EnvConditionsValue | null) ?? null;
  const initialEnvEnd = (test.envEnd as EnvConditionsValue | null) ?? null;
  const initialWeightSetIds = test.weightSetIds ?? [];
  const startedAt = test.startedAt ? test.startedAt.toISOString() : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: test.params/observations are stable for this test's lifetime on the page (a fresh mount handles switching tests).
  const draft = useMemo(() => {
    switch (test.testCode) {
      case 'WEIGHING':
        return {
          kind: 'weighing' as const,
          value: buildWeighingDraft(test.params, test.observations),
        };
      case 'ECCENTRICITY':
        return {
          kind: 'eccentricity' as const,
          value: buildEccentricityDraft(test.params, test.observations, spec),
        };
      case 'ZERO_ACCURACY':
      case 'TARE_ACCURACY':
        return { kind: 'zeroBased' as const, value: buildZeroBasedDraft(test.observations, spec) };
      case 'ZERO_RETURN':
        return { kind: 'zeroReturn' as const, value: buildZeroReturnDraft(test.observations) };
      case 'DISCRIMINATION':
        return {
          kind: 'discrimination' as const,
          value: buildDiscriminationDraft(test.params, test.observations),
        };
      case 'REPEATABILITY':
        return {
          kind: 'repeatability' as const,
          value: buildRepeatabilityDraft(test.params, test.observations),
        };
      case 'CREEP':
        return { kind: 'creep' as const, value: buildCreepDraft(test.params, test.observations) };
      case 'TEMP_NO_LOAD':
        return {
          kind: 'tempNoLoad' as const,
          value: buildTempNoLoadDraft(test.params, test.observations),
        };
      case 'EXAM_MARKINGS':
      case 'EXAM_CONSTRUCTION':
        return {
          kind: 'checklist' as const,
          value: buildChecklistDraft(test.testCode, test.observations, CHECKLIST_ITEMS),
        };
      default:
        return { kind: 'unimplemented' as const, value: null };
    }
  }, [test.testCode]);

  switch (draft.kind) {
    case 'weighing':
      return (
        <WeighingForm
          {...common}
          initialDraft={draft.value}
          initialEnvStart={initialEnvStart}
          initialEnvEnd={initialEnvEnd}
          initialWeightSetIds={initialWeightSetIds}
          weightSets={weightSets}
        />
      );
    case 'eccentricity':
      return (
        <EccentricityForm
          {...common}
          initialDraft={draft.value}
          initialEnvStart={initialEnvStart}
          initialEnvEnd={initialEnvEnd}
          initialWeightSetIds={initialWeightSetIds}
          weightSets={weightSets}
        />
      );
    case 'zeroBased':
      return (
        <SingleMeasurementForm
          {...common}
          testCode={test.testCode}
          rowLabel={
            test.testCode === 'TARE_ACCURACY'
              ? 'Reading with the tare vessel balanced to zero.'
              : 'Reading at (near-)zero load.'
          }
          initialDraft={draft.value}
          initialEnvStart={initialEnvStart}
          initialEnvEnd={initialEnvEnd}
        />
      );
    case 'zeroReturn':
      return (
        <ZeroReturnForm
          {...common}
          initialDraft={draft.value}
          initialEnvStart={initialEnvStart}
          initialEnvEnd={initialEnvEnd}
        />
      );
    case 'discrimination':
      return (
        <DiscriminationForm
          {...common}
          initialDraft={draft.value}
          initialEnvStart={initialEnvStart}
          initialEnvEnd={initialEnvEnd}
        />
      );
    case 'repeatability':
      return (
        <RepeatabilityForm
          {...common}
          initialDraft={draft.value}
          initialEnvStart={initialEnvStart}
          initialEnvEnd={initialEnvEnd}
        />
      );
    case 'creep':
      return (
        <CreepForm
          {...common}
          initialDraft={draft.value}
          initialEnvStart={initialEnvStart}
          initialEnvEnd={initialEnvEnd}
          startedAt={startedAt}
        />
      );
    case 'tempNoLoad':
      return <TempNoLoadForm {...common} initialDraft={draft.value} />;
    case 'checklist':
      return (
        <ChecklistForm
          {...common}
          testCode={test.testCode as 'EXAM_MARKINGS' | 'EXAM_CONSTRUCTION'}
          initialDraft={draft.value}
        />
      );
    default:
      return (
        <p className="rounded-[var(--radius-panel)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No observation form is implemented for {test.testCode} yet.
        </p>
      );
  }
}
