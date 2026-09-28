'use client';

import type { CalcStep } from '@tula/engine';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * "Show calculation" popover (implementation.md §7.5): renders the exact
 * `CalcStep[]` trail the engine computed — never a re-derived explanation,
 * so what the tester reads can never drift from what was actually
 * calculated (§11: "the server engine result is authoritative").
 */
export function CalcExplainer({ steps }: { steps: CalcStep[] }) {
  if (steps.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Show calculation"
          className="text-muted-foreground"
        >
          <Calculator className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <ol className="space-y-2">
          {steps.map((step) => (
            <li key={step.label} className="text-sm">
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{step.label}</span>
                {step.clause ? (
                  <span className="tabular text-xs text-muted-foreground">
                    clause {step.clause}
                  </span>
                ) : null}
              </p>
              <p className="tabular text-muted-foreground">{step.formula}</p>
              <p className="tabular">
                {step.substituted} ={' '}
                <span className="font-medium text-foreground">{step.result}</span>
              </p>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
