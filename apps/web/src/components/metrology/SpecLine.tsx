import type { AccuracyClass, Dec, DisplayUnit } from '@tula/engine';
import { cn } from '@/lib/utils';
import { ClassBadge } from './ClassBadge';
import { MassValue } from './MassValue';

/**
 * The one-line instrument summary used across the app (implementation.md
 * §7.6): class, Max, Min, e/d, and n. Takes already-computed display values
 * rather than an `InstrumentMetrology` — n and any multi-range breakdown are
 * engine logic (implementation.md §11: "All OIML logic lives in
 * packages/engine"), not something this component derives.
 */
export function SpecLine({
  accuracyClass,
  max,
  min,
  e,
  d,
  n,
  unit,
  className,
}: {
  accuracyClass: AccuracyClass;
  max: Dec;
  min: Dec;
  e: Dec;
  d: Dec;
  n?: number | string;
  unit: DisplayUnit;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', className)}>
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Class</span>
        <ClassBadge value={accuracyClass} />
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-muted-foreground">Max</span>
        <MassValue grams={max} unit={unit} decimalPlaces={0} />
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-muted-foreground">Min</span>
        <MassValue grams={min} unit={unit} decimalPlaces={0} />
      </span>
      {e === d ? (
        <span className="flex items-baseline gap-1">
          <span className="text-muted-foreground">e = d</span>
          <MassValue grams={e} unit={unit} decimalPlaces={0} />
        </span>
      ) : (
        <>
          <span className="flex items-baseline gap-1">
            <span className="text-muted-foreground">e</span>
            <MassValue grams={e} unit={unit} decimalPlaces={0} />
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-muted-foreground">d</span>
            <MassValue grams={d} unit={unit} decimalPlaces={0} />
          </span>
        </>
      )}
      {n !== undefined ? (
        <span className="flex items-baseline gap-1">
          <span className="text-muted-foreground">n</span>
          <span className="tabular">{n}</span>
        </span>
      ) : null}
    </div>
  );
}
