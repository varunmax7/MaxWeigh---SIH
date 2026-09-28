'use client';

import { type EVALUATION_PRIORITIES, instrumentMetrologySchema } from '@tula/schemas';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';
import { classifyInstrument, hasBlockingIssues } from '@/lib/classify';
import {
  emptySpecState,
  type SpecState,
  specStateFromMetrology,
  toInstrumentMetrology,
} from '@/lib/spec-state';
import {
  getInstrumentModelSpecAction,
  saveDraftEvaluationAction,
  submitEvaluationAction,
} from '@/server/actions/evaluations';
import type { getEvaluationDraft, listTesters } from '@/server/queries/evaluations';
import type {
  listApplicants,
  listInstrumentModels,
  listManufacturers,
} from '@/server/queries/masterdata';
import { Step1ApplicantManufacturer } from './steps/Step1ApplicantManufacturer';
import { Step2Instrument } from './steps/Step2Instrument';
import { Step3Metrology } from './steps/Step3Metrology';
import { Step4TestPlan } from './steps/Step4TestPlan';
import { Step5Assignment } from './steps/Step5Assignment';

type Manufacturer = Awaited<ReturnType<typeof listManufacturers>>[number];
type Applicant = Awaited<ReturnType<typeof listApplicants>>[number];
type Model = Awaited<ReturnType<typeof listInstrumentModels>>[number];
type Tester = Awaited<ReturnType<typeof listTesters>>[number];
type Draft = Awaited<ReturnType<typeof getEvaluationDraft>>;
type Priority = (typeof EVALUATION_PRIORITIES)[number];

const STEPS = [
  { label: 'Applicant & manufacturer' },
  { label: 'Instrument' },
  { label: 'Metrology parameters' },
  { label: 'Test plan' },
  { label: 'Assignment' },
];

function parseSampleSerials(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function specStateFromSnapshot(raw: unknown): SpecState {
  const result = instrumentMetrologySchema.safeParse(raw);
  return result.success ? specStateFromMetrology(result.data) : emptySpecState();
}

function validateStep(
  step: number,
  {
    manufacturerId,
    applicantId,
    modelId,
  }: { manufacturerId: string; applicantId: string; modelId: string },
): string | null {
  if (step === 0 && (!manufacturerId || !applicantId)) {
    return 'Choose a manufacturer and an applicant.';
  }
  if (step === 1 && !modelId) {
    return 'Choose or create an instrument model.';
  }
  return null;
}

/** The current step's fields — kept out of `Wizard` itself to keep that function's branching within the lint budget. */
function StepContent({
  step,
  manufacturers,
  applicants,
  models,
  testers,
  manufacturerId,
  applicantId,
  modelId,
  sampleSerials,
  spec,
  issues,
  resolvedSpec,
  testOverrides,
  assignedTesterId,
  dueAt,
  priority,
  onManufacturerChange,
  onApplicantChange,
  onManufacturerCreated,
  onApplicantCreated,
  onModelChange,
  onSampleSerialsChange,
  onModelCreated,
  onSpecChange,
  onOverridesChange,
  onAssignedTesterChange,
  onDueAtChange,
  onPriorityChange,
}: {
  step: number;
  manufacturers: Manufacturer[];
  applicants: Applicant[];
  models: Model[];
  testers: Tester[];
  manufacturerId: string;
  applicantId: string;
  modelId: string;
  sampleSerials: string;
  spec: SpecState;
  issues: ReturnType<typeof classifyInstrument>;
  resolvedSpec: ReturnType<typeof toInstrumentMetrology>;
  testOverrides: Record<string, string>;
  assignedTesterId: string;
  dueAt: string;
  priority: Priority;
  onManufacturerChange: (id: string) => void;
  onApplicantChange: (id: string) => void;
  onManufacturerCreated: (m: Manufacturer) => void;
  onApplicantCreated: (a: Applicant) => void;
  onModelChange: (id: string) => void;
  onSampleSerialsChange: (v: string) => void;
  onModelCreated: (m: Model) => void;
  onSpecChange: (s: SpecState) => void;
  onOverridesChange: (next: Record<string, string>) => void;
  onAssignedTesterChange: (id: string) => void;
  onDueAtChange: (v: string) => void;
  onPriorityChange: (p: Priority) => void;
}) {
  switch (step) {
    case 0:
      return (
        <Step1ApplicantManufacturer
          manufacturers={manufacturers}
          applicants={applicants}
          manufacturerId={manufacturerId}
          applicantId={applicantId}
          onManufacturerChange={onManufacturerChange}
          onApplicantChange={onApplicantChange}
          onManufacturerCreated={onManufacturerCreated}
          onApplicantCreated={onApplicantCreated}
        />
      );
    case 1:
      return (
        <Step2Instrument
          models={models}
          manufacturerId={manufacturerId}
          manufacturerName={manufacturers.find((m) => m.id === manufacturerId)?.name ?? ''}
          modelId={modelId}
          sampleSerials={sampleSerials}
          onModelChange={onModelChange}
          onSampleSerialsChange={onSampleSerialsChange}
          onModelCreated={onModelCreated}
        />
      );
    case 2:
      return <Step3Metrology spec={spec} onChange={onSpecChange} issues={issues} />;
    case 3:
      return resolvedSpec ? (
        <Step4TestPlan
          spec={resolvedSpec}
          overrides={testOverrides}
          onOverridesChange={onOverridesChange}
        />
      ) : null;
    case 4:
      return (
        <Step5Assignment
          testers={testers}
          assignedTesterId={assignedTesterId}
          dueAt={dueAt}
          priority={priority}
          onAssignedTesterChange={onAssignedTesterChange}
          onDueAtChange={onDueAtChange}
          onPriorityChange={onPriorityChange}
        />
      );
    default:
      return null;
  }
}

export function Wizard({
  activeLabId,
  manufacturers: initialManufacturers,
  applicants: initialApplicants,
  models: initialModels,
  testers,
  draft,
}: {
  activeLabId: string;
  manufacturers: Manufacturer[];
  applicants: Applicant[];
  models: Model[];
  testers: Tester[];
  draft: Draft;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [manufacturers, setManufacturers] = useState(initialManufacturers);
  const [applicants, setApplicants] = useState(initialApplicants);
  const [models, setModels] = useState(initialModels);

  const [manufacturerId, setManufacturerId] = useState(draft?.manufacturerId ?? '');
  const [applicantId, setApplicantId] = useState(draft?.applicantId ?? '');
  const [modelId, setModelId] = useState(draft?.modelId ?? '');
  const [sampleSerials, setSampleSerials] = useState((draft?.sampleSerials ?? []).join(', '));
  const [spec, setSpec] = useState<SpecState>(() =>
    draft ? specStateFromSnapshot(draft.specSnapshot) : emptySpecState(),
  );
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const [refNo, setRefNo] = useState<string | null>(draft?.refNo ?? null);
  const [testOverrides, setTestOverrides] = useState<Record<string, string>>({});
  const [assignedTesterId, setAssignedTesterId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSpec = useMemo(() => toInstrumentMetrology(spec), [spec]);
  const issues = useMemo(
    () => (resolvedSpec ? classifyInstrument(resolvedSpec) : []),
    [resolvedSpec],
  );
  const specBlocked = !resolvedSpec || hasBlockingIssues(issues);

  async function handleModelChange(id: string) {
    setModelId(id);
    const defaultSpec = await getInstrumentModelSpecAction(id);
    setSpec(defaultSpec ? specStateFromSnapshot(defaultSpec) : emptySpecState());
  }

  /** Saves/updates the DRAFT row once the spec classifies cleanly. Returns an error message, or null on success. */
  async function persistDraft(): Promise<string | null> {
    if (specBlocked || !resolvedSpec) {
      return 'Fix the blocking classification issues before continuing.';
    }
    setPending(true);
    const result = await saveDraftEvaluationAction({
      id: draftId ?? undefined,
      labId: activeLabId,
      applicantId,
      manufacturerId,
      modelId,
      sampleSerials: parseSampleSerials(sampleSerials),
      defaultSpec: resolvedSpec,
    });
    setPending(false);
    if (!result.ok) {
      return result.code === 'RULE'
        ? 'Fix the blocking classification issues before continuing.'
        : 'Could not save this draft. Try again.';
    }
    setDraftId(result.data.id);
    if ('refNo' in result.data) setRefNo(result.data.refNo);
    return null;
  }

  async function goNext() {
    setError(null);

    const validationError = validateStep(step, { manufacturerId, applicantId, modelId });
    if (validationError) {
      setError(validationError);
      return;
    }

    if (step === 2) {
      const draftError = await persistDraft();
      if (draftError) {
        setError(draftError);
        return;
      }
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleCreateEvaluation() {
    if (!draftId) return;
    setPending(true);
    setError(null);
    const result = await submitEvaluationAction({
      draftId,
      testOverrides: Object.entries(testOverrides).map(([code, naReason]) => ({ code, naReason })),
      assignedTesterId: assignedTesterId || undefined,
      dueAt: dueAt || undefined,
      priority,
    });
    setPending(false);
    if (!result.ok) {
      setError('Could not create the evaluation. Try again.');
      return;
    }
    toast.success(`Evaluation ${result.data.refNo} created`);
    router.push(`/evaluations/${result.data.id}`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <Stepper steps={STEPS} currentStep={step} />

      <div className="space-y-6">
        {refNo ? (
          <p className="tabular text-sm text-muted-foreground">Draft reference: {refNo}</p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] bg-fail-bg px-3 py-2 text-sm text-fail"
          >
            {error}
          </p>
        ) : null}

        <StepContent
          step={step}
          manufacturers={manufacturers}
          applicants={applicants}
          models={models}
          testers={testers}
          manufacturerId={manufacturerId}
          applicantId={applicantId}
          modelId={modelId}
          sampleSerials={sampleSerials}
          spec={spec}
          issues={issues}
          resolvedSpec={resolvedSpec}
          testOverrides={testOverrides}
          assignedTesterId={assignedTesterId}
          dueAt={dueAt}
          priority={priority}
          onManufacturerChange={setManufacturerId}
          onApplicantChange={setApplicantId}
          onManufacturerCreated={(m) => {
            setManufacturers((prev) => [...prev, m]);
            setManufacturerId(m.id);
          }}
          onApplicantCreated={(a) => {
            setApplicants((prev) => [...prev, a]);
            setApplicantId(a.id);
          }}
          onModelChange={handleModelChange}
          onSampleSerialsChange={setSampleSerials}
          onModelCreated={(m) => {
            setModels((prev) => [...prev, m]);
            setModelId(m.id);
          }}
          onSpecChange={setSpec}
          onOverridesChange={setTestOverrides}
          onAssignedTesterChange={setAssignedTesterId}
          onDueAtChange={setDueAt}
          onPriorityChange={setPriority}
        />

        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 0 || pending}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={pending}>
              {pending ? 'Saving…' : 'Next'}
            </Button>
          ) : (
            <Button type="button" onClick={handleCreateEvaluation} disabled={pending || !draftId}>
              {pending ? 'Creating…' : 'Create evaluation'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
