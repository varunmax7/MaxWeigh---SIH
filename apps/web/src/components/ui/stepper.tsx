import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepperStep {
  label: string;
  description?: string;
}

type StepState = 'complete' | 'current' | 'upcoming';

function StepperItem({
  step,
  index,
  state,
  isLast,
}: {
  step: StepperStep;
  index: number;
  state: StepState;
  isLast: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular',
            state === 'complete' && 'border-primary bg-primary text-primary-foreground',
            state === 'current' && 'border-primary text-primary',
            state === 'upcoming' && 'border-border text-muted-foreground',
          )}
        >
          {state === 'complete' ? <Check className="size-4" /> : index + 1}
        </span>
        {!isLast ? (
          <span
            aria-hidden="true"
            className={cn('my-1 w-px flex-1', state === 'complete' ? 'bg-primary' : 'bg-border')}
          />
        ) : null}
      </div>
      <div className={cn('pb-6', isLast && 'pb-0')}>
        <p
          className={cn(
            'text-sm font-medium',
            state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
          )}
          aria-current={state === 'current' ? 'step' : undefined}
        >
          {step.label}
        </p>
        {step.description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
        ) : null}
      </div>
    </li>
  );
}

function stepState(index: number, currentStep: number): StepState {
  if (index < currentStep) return 'complete';
  if (index === currentStep) return 'current';
  return 'upcoming';
}

/**
 * A vertical, left-aligned stepper (implementation.md §7.5: "New evaluation
 * wizard (stepper, left-aligned, one column)"). Not in shadcn/ui's registry
 * — built to the same token/variant conventions as the rest of `ui/`.
 */
export function Stepper({
  steps,
  currentStep,
  className,
}: {
  steps: StepperStep[];
  /** 0-indexed; steps before it are complete, the step at it is current. */
  currentStep: number;
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step, index) => (
        <StepperItem
          key={step.label}
          step={step}
          index={index}
          state={stepState(index, currentStep)}
          isLast={index === steps.length - 1}
        />
      ))}
    </ol>
  );
}
